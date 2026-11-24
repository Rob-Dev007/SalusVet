// SERVICIO DE PRE-CONSULTA. Mismas capas que antes: aquí viven las reglas de negocio;
// la ruta HTTP y la Server Action solo autentican, validan y delegan.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Prisma } from "@/generated/prisma/client";
import { AI_FALLBACK, AI_MODEL, anthropic, isAiConfigured } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { DomainError } from "../shared/errors";
import {
  CHAT_SYSTEM_PROMPT,
  emergencyInstruction,
  petContext,
  SUMMARY_SYSTEM_PROMPT,
} from "./pre-consultation.prompt";
import { type AiSummary, AiSummarySchema, type Transcript } from "./pre-consultation.schemas";
import { detectAllRedFlags } from "../red-flags/red-flag.service";
import {
  buildQuestionnaireSummary,
  QUESTIONNAIRE_VERSION,
  type QuestionnaireAnswers,
  questionnaireFreeTexts,
  questionnaireUrgency,
} from "./questionnaire";
import { resolveUrgency } from "./triage";

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
function assertAiAvailable() {
  if (!isAiConfigured()) {
    throw new DomainError("UNAVAILABLE", "El asistente no está disponible en este momento");
  }
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

// El bloque system en dos partes: [reglas fijas, CACHEADAS] + [datos de esta mascota, variables].
// El orden importa: el caché funciona por PREFIJO; lo que cambia va después del punto de corte.
function buildSystem(appointment: Awaited<ReturnType<typeof loadOwnedAppointment>>, rules: string) {
  const { pet } = appointment;
  return [
    { type: "text", text: rules, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: petContext({
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        sex: pet.sex,
        ageText: approximateAge(pet.birthDate),
        weightKg: pet.weightKg?.toString() ?? null, // Decimal → texto (no se serializa solo)
        notes: pet.notes,
        reason: appointment.reason,
      }),
    },
  ] satisfies Anthropic.Beta.BetaTextBlockParam[];
}

const ownerTexts = (transcript: Transcript) => transcript.filter((m) => m.role === "user").map((m) => m.content);

// ---------------------------------------------------------------------------------------------
// CASO DE USO 1: el dueño envía un mensaje → respondemos EN STREAMING (palabra por palabra).
// ---------------------------------------------------------------------------------------------
export async function streamPreConsultationReply(
  ownerId: string,
  appointmentId: string,
  transcript: Transcript,
  signal: AbortSignal, // Si el dueño cierra la pestaña, cortamos la llamada y dejamos de pagar tokens
) {
  const appointment = await loadOwnedAppointment(ownerId, appointmentId);
  assertAiAvailable();

  // TRIAJE DETERMINISTA, ANTES de llamar a la IA. Si hay alarma, nuestro código añade una
  // instrucción de operador: la IA no "decide" la emergencia, solo la comunica.
  const redFlags = await detectAllRedFlags(ownerTexts(transcript));
  const messages: Anthropic.Beta.BetaMessageParam[] = [...transcript];
  if (redFlags.length > 0) {
    messages.push({ role: "system", content: emergencyInstruction(redFlags) });
  }

  const aiStream = anthropic().beta.messages.stream(
    {
      model: AI_MODEL,
      max_tokens: 8000, // Incluye el razonamiento interno del modelo, no solo el texto visible
      output_config: { effort: "low" }, // Una pregunta corta no necesita razonamiento profundo: más rápido y barato
      system: buildSystem(appointment, CHAT_SYSTEM_PROMPT),
      messages,
      ...AI_FALLBACK,
    },
    { signal },
  );

  const encoder = new TextEncoder();
  // Convertimos los eventos del SDK en un stream de TEXTO plano para el navegador.
  // El cliente no necesita saber nada de la API de Claude: solo recibe palabras.
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of aiStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await aiStream.finalMessage();
        // Siempre revisar stop_reason: si el modelo (y su fallback) declinaron, no dejamos al
        // dueño frente a una burbuja vacía.
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("No puedo ayudarte con eso. Cuéntame cómo está tu mascota."));
        }
        controller.close();
      } catch (error) {
        // Los encabezados HTTP ya se enviaron: no podemos cambiar el status a 500. Registramos el
        // error real en el servidor y le damos al dueño un mensaje genérico (sin detalles internos).
        console.error("[pre-consultation] stream failed", error);
        controller.enqueue(encoder.encode("\n\n⚠️ Se interrumpió la respuesta. Intenta de nuevo."));
        controller.close();
      }
    },
    cancel() {
      aiStream.abort(); // El navegador cerró la conexión
    },
  });

  return { body, redFlags };
}

// ---------------------------------------------------------------------------------------------
// CASO DE USO 2: el dueño termina → resumen ESTRUCTURADO, triaje final y guardado.
// ---------------------------------------------------------------------------------------------
export async function finalizePreConsultation(ownerId: string, appointmentId: string, transcript: Transcript) {
  const appointment = await loadOwnedAppointment(ownerId, appointmentId);
  assertAiAvailable();

  // La conversación va como UN mensaje con etiquetas, no como turnos user/assistant: queremos que
  // el modelo la ANALICE desde fuera, no que la continúe.
  const conversation = transcript
    .map((m) => `${m.role === "user" ? "Dueño" : "Asistente"}: ${m.content}`)
    .join("\n\n");

  const response = await anthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    output_config: {
      effort: "medium", // Resumir y clasificar urgencia sí merece algo más de razonamiento
      format: betaZodOutputFormat(AiSummarySchema), // Structured outputs: JSON que DEBE cumplir el schema
    },
    system: buildSystem(appointment, SUMMARY_SYSTEM_PROMPT),
    messages: [{ role: "user", content: `<conversacion>\n${conversation}\n</conversacion>` }],
    ...AI_FALLBACK,
  });

  if (response.stop_reason === "refusal") {
    throw new DomainError("UNAVAILABLE", "No pudimos generar el resumen. Tu cita sigue en pie.");
  }
  const ai: AiSummary | null = response.parsed_output;
  // null = el JSON no pasó la validación de Zod. Es un fallo técnico, no del usuario: lo dejamos
  // propagar (Next lo enmascara con un digest).
  if (!ai) throw new Error(`Pre-consultation summary failed to parse (stop_reason=${response.stop_reason})`);

  // LA DECISIÓN FINAL: máximo entre lo que dice la IA y lo que detectan nuestras reglas.
  const redFlags = await detectAllRedFlags(ownerTexts(transcript));
  const urgency = resolveUrgency(ai.urgency, redFlags);

  return savePreConsultation({
    appointmentId: appointment.id,
    chiefComplaint: ai.chiefComplaint,
    summary: ai.summary,
    symptoms: ai.symptoms,
    urgency,
    // Guardamos lo que propuso la IA Y lo que decidió el código: si difieren, queda la evidencia.
    structuredData: { source: "ai", ai, redFlags, aiUrgency: ai.urgency, transcript },
    aiModel: response.model, // El modelo que REALMENTE respondió (podría ser el de fallback)
  });
}

// ---------------------------------------------------------------------------------------------
// CASO DE USO 3 (por defecto, $0): el dueño envía el CUESTIONARIO guiado.
// Mismo destino que la IA (tabla PreConsultation): la agenda del vet no distingue de dónde vino,
// y pasar a la versión con IA no exige migrar datos ni cambiar pantallas.
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
