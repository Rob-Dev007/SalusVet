// SERVICIO DE PRE-CONSULTA. Mismas capas que antes: aquí viven las reglas de negocio;
// la ruta HTTP y las Server Actions solo autentican, validan y delegan.
//
// Ya no importa ningún SDK de IA: habla con la interfaz PreConsultationAI (ver ./ai/provider.ts).
// Gemini, Claude o "sin IA" se deciden en la configuración, no aquí.
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { detectAllRedFlags } from "../red-flags/red-flag.service";
import { DomainError } from "../shared/errors";
import { AiUnavailableError, getPreConsultationAI, type PreConsultationAI } from "./ai";
import { CHAT_SYSTEM_PROMPT, emergencyInstruction, petContext, SUMMARY_SYSTEM_PROMPT } from "./pre-consultation.prompt";
import type { Transcript } from "./pre-consultation.schemas";
import {
  buildQuestionnaireSummary,
  QUESTIONNAIRE_VERSION,
  type QuestionnaireAnswers,
  questionnaireFreeTexts,
  questionnaireUrgency,
} from "@/domain/questionnaire";
import { resolveUrgency } from "@/domain/triage";

const AI_UNAVAILABLE_MESSAGE = "El asistente no está disponible en este momento. Puedes responder el cuestionario.";

// ---------------------------------------------------------------------------------------------
// AUTORIZACIÓN + REGLAS: ¿puede ESTE dueño hacer la pre-consulta de ESTA cita?
// ---------------------------------------------------------------------------------------------
async function loadOwnedAppointment(ownerId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    // El filtro por dueño va EN LA CONSULTA (prevención de IDOR, como en la Fase 2): si la cita
    // es de otro, para nosotros "no existe". Nunca confirmamos que un id ajeno es válido.
    where: { id: appointmentId, pet: { ownerId } },
    select: {
      id: true,
      status: true,
      reason: true,
      preConsultation: { select: { id: true } },
      pet: {
        select: { name: true, species: true, breed: true, sex: true, birthDate: true, weightKg: true, notes: true },
      },
    },
  });
  if (!appointment) throw new DomainError("NOT_FOUND", "Cita no encontrada");

  // Solo tiene sentido antes de la consulta: una cita cancelada o atendida no la necesita.
  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    throw new DomainError("INVALID_TRANSITION", "La pre-consulta solo está disponible para citas activas");
  }
  if (appointment.preConsultation) {
    throw new DomainError("CONFLICT", "Esta cita ya tiene una pre-consulta enviada");
  }
  return appointment;
}

// Solo para los caminos CON IA. El cuestionario (gratis) no pasa por aquí.
function requireAi(): PreConsultationAI {
  const ai = getPreConsultationAI();
  if (!ai) throw new DomainError("UNAVAILABLE", AI_UNAVAILABLE_MESSAGE);
  return ai;
}

// "3 años", "5 meses"... a partir de la fecha de nacimiento (si el dueño la registró).
function approximateAge(birthDate: Date | null, now = new Date()) {
  if (!birthDate) return null;
  const months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - birthDate.getUTCMonth());
  if (months < 1) return "menos de un mes";
  if (months < 24) return `${months} ${months === 1 ? "mes" : "meses"}`;
  return `${Math.floor(months / 12)} años`;
}

// Datos de la mascota para la IA. Solo de la MASCOTA: nunca nombre, email ni teléfono del dueño
// (minimización de datos: lo que no se envía, no se puede filtrar).
function buildContext(appointment: Awaited<ReturnType<typeof loadOwnedAppointment>>) {
  const { pet } = appointment;
  return petContext({
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    ageText: approximateAge(pet.birthDate),
    weightKg: pet.weightKg?.toString() ?? null, // Decimal → texto (no se serializa solo)
    notes: pet.notes,
    reason: appointment.reason,
  });
}

const ownerTexts = (transcript: Transcript) => transcript.filter((m) => m.role === "user").map((m) => m.content);

// ---------------------------------------------------------------------------------------------
// CASO DE USO 1: el dueño envía un mensaje → respondemos EN STREAMING (palabra por palabra).
// ---------------------------------------------------------------------------------------------
export async function streamPreConsultationReply(
  ownerId: string,
  appointmentId: string,
  transcript: Transcript,
  signal: AbortSignal, // Si el dueño cierra la pestaña, cortamos la llamada
) {
  const appointment = await loadOwnedAppointment(ownerId, appointmentId);
  const ai = requireAi();

  // TRIAJE DETERMINISTA, ANTES de llamar a la IA. Si hay alarma, nuestro código añade una
  // instrucción de operador: la IA no "decide" la emergencia, solo la comunica.
  const redFlags = await detectAllRedFlags(ownerTexts(transcript));

  const chunks = ai.streamReply({
    rules: CHAT_SYSTEM_PROMPT,
    context: buildContext(appointment),
    transcript,
    operatorNote: redFlags.length > 0 ? emergencyInstruction(redFlags) : null,
    signal,
  });

  // Pedimos el PRIMER trozo antes de responder. ¿Por qué? Una vez enviados los encabezados HTTP
  // (status 200) ya no podemos decir "503". Si el proveedor está caído o sin cuota, casi siempre
  // falla aquí, al inicio: así respondemos un error limpio y el navegador ofrece el cuestionario.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      console.error("[pre-consultation] AI unavailable", error.message);
      throw new DomainError("UNAVAILABLE", AI_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }

  const encoder = new TextEncoder();
  // Convertimos los trozos en un stream de TEXTO plano para el navegador.
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const text of chunks) controller.enqueue(encoder.encode(text));
        controller.close();
      } catch (error) {
        // Falló a MITAD de la respuesta: los encabezados ya salieron, no podemos cambiar el
        // status. Registramos el error real y damos al dueño un mensaje genérico.
        console.error("[pre-consultation] stream failed", error);
        controller.enqueue(encoder.encode("\n\n⚠️ Se interrumpió la respuesta. Intenta de nuevo."));
        controller.close();
      }
    },
    async cancel() {
      await chunks.return(undefined); // El navegador cerró la conexión: cerramos el generador
    },
  });

  return { body, redFlags };
}

// ---------------------------------------------------------------------------------------------
// CASO DE USO 2: el dueño termina el chat → resumen ESTRUCTURADO, triaje final y guardado.
// ---------------------------------------------------------------------------------------------
export async function finalizePreConsultation(ownerId: string, appointmentId: string, transcript: Transcript) {
  const appointment = await loadOwnedAppointment(ownerId, appointmentId);
  const ai = requireAi();

  // La conversación va como UN texto con etiquetas, no como turnos: queremos que el modelo la
  // ANALICE desde fuera, no que la continúe.
  const conversation = transcript
    .map((m) => `${m.role === "user" ? "Dueño" : "Asistente"}: ${m.content}`)
    .join("\n\n");

  let summary;
  try {
    summary = await ai.summarize({ rules: SUMMARY_SYSTEM_PROMPT, context: buildContext(appointment), conversation });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      console.error("[pre-consultation] summary unavailable", error.message);
      throw new DomainError("UNAVAILABLE", "No pudimos generar el resumen ahora. Puedes responder el cuestionario.");
    }
    throw error;
  }

  // LA DECISIÓN FINAL: máximo entre lo que dice la IA y lo que detectan nuestras reglas.
  const redFlags = await detectAllRedFlags(ownerTexts(transcript));
  const urgency = resolveUrgency(summary.urgency, redFlags);

  return savePreConsultation({
    appointmentId: appointment.id,
    chiefComplaint: summary.chiefComplaint,
    summary: summary.summary,
    symptoms: summary.symptoms,
    urgency,
    // Guardamos lo que propuso la IA Y lo que decidió el código: si difieren, queda la evidencia.
    structuredData: { source: "ai", ai: summary, redFlags, aiUrgency: summary.urgency, transcript },
    aiModel: ai.model, // Qué proveedor y modelo generó el resumen (trazabilidad)
  });
}

// ---------------------------------------------------------------------------------------------
// CASO DE USO 3 ($0, y RESPALDO si la IA falla): el dueño envía el CUESTIONARIO guiado.
// Mismo destino que la IA (tabla PreConsultation): la agenda del vet no distingue de dónde vino.
// ---------------------------------------------------------------------------------------------
export async function submitQuestionnaire(ownerId: string, appointmentId: string, answers: QuestionnaireAnswers) {
  const appointment = await loadOwnedAppointment(ownerId, appointmentId);

  // Dos reglas deterministas, combinadas con el mismo MÁXIMO que usamos con la IA:
  //   1. Las opciones marcadas (pesos) → urgencia "propuesta".
  //   2. Las palabras de alarma en los textos libres (lista base + clínica).
  const proposed = questionnaireUrgency(answers);
  const redFlags = await detectAllRedFlags(questionnaireFreeTexts(answers));
  const urgency = resolveUrgency(proposed, redFlags);

  return savePreConsultation({
    appointmentId: appointment.id,
    ...buildQuestionnaireSummary(answers),
    urgency,
    structuredData: { source: "questionnaire", answers, redFlags, proposedUrgency: proposed },
    // La columna se llama aiModel por la Fase 1; aquí guarda la VERSIÓN del cuestionario.
    // Renombrarla a "source" sería una migración expand-and-contract (ver Fase 1); por ahora
    // el valor ya distingue el origen sin tocar el schema.
    aiModel: QUESTIONNAIRE_VERSION,
  });
}

// Guardado común. Doble clic en "Enviar": el @unique de appointmentId rechaza la segunda.
async function savePreConsultation(data: Prisma.PreConsultationUncheckedCreateInput) {
  try {
    return await prisma.preConsultation.create({ data, select: { id: true, urgency: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("CONFLICT", "Esta cita ya tiene una pre-consulta enviada");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// LECTURA: datos para la página del dueño (la cita y, si existe, su pre-consulta).
// ---------------------------------------------------------------------------------------------
export async function getPreConsultationView(ownerId: string, appointmentId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, pet: { ownerId } }, // Mismo filtro anti-IDOR
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      reason: true,
      pet: { select: { name: true } },
      preConsultation: { select: { urgency: true, chiefComplaint: true, summary: true, symptoms: true } },
    },
  });
}
