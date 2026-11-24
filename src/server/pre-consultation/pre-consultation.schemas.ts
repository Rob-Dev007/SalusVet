// CONTRATOS de la pre-consulta. Dos fronteras de confianza, dos schemas:
//   1. Lo que llega del NAVEGADOR (la conversación): no confiamos → validamos forma y LÍMITES.
//   2. Lo que devuelve la IA (el resumen): tampoco confiamos → el SDK lo valida con Zod.
// "Parse, don't validate" aplica igual a un humano malicioso que a un modelo que se equivoca.
import { z } from "zod";
import { UrgencyLevel } from "@/generated/prisma/enums";

// ---- Límites: cada mensaje enviado a la IA cuesta dinero. Sin topes, un usuario (o un script)
// podría mandar una novela de 1 MB o 500 turnos y vaciarnos el presupuesto (abuso de costos).
export const MAX_MESSAGE_CHARS = 1500;
export const MAX_TURNS = 24; // 12 preguntas + 12 respuestas: suficiente para una pre-consulta

const ChatMessageSchema = z.object({
  // Solo dos roles. Si alguien envía role: "system" para inyectar instrucciones, Zod lo rechaza.
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS, { error: `Máximo ${MAX_MESSAGE_CHARS} caracteres` }),
});

export const TranscriptSchema = z
  .array(ChatMessageSchema)
  .min(1)
  .max(MAX_TURNS, { error: "La conversación es demasiado larga" })
  // La API exige alternar user/assistant empezando por user. Lo comprobamos aquí para devolver
  // un error claro en vez de un 400 críptico de la API.
  .refine((messages) => messages.every((m, i) => m.role === (i % 2 === 0 ? "user" : "assistant")), {
    error: "La conversación no tiene un orden válido",
  });

export type Transcript = z.infer<typeof TranscriptSchema>;

// Cuerpo del POST del chat: la conversación DEBE terminar en un mensaje del dueño (le toca a la IA).
export const ChatRequestSchema = z.object({
  messages: TranscriptSchema.refine((messages) => messages.at(-1)?.role === "user", {
    error: "El último mensaje debe ser del dueño",
  }),
});

// ---- Salida estructurada de la IA. El SDK convierte este schema a JSON Schema, la API obliga al
// modelo a respetarlo (structured outputs) y el SDK vuelve a parsear con Zod al recibirlo.
// .describe() no es decoración: viaja al modelo como instrucción de qué poner en cada campo.
export const AiSummarySchema = z.object({
  chiefComplaint: z.string().describe("Motivo principal en una frase corta, en español"),
  summary: z
    .string()
    .describe("Resumen clínico para el veterinario: 3 a 6 frases, en español, solo hechos que contó el dueño"),
  symptoms: z.array(z.string()).describe("Síntomas observados, en minúsculas y en español"),
  symptomDuration: z.string().nullable().describe("Desde cuándo ocurre, si el dueño lo dijo; null si no"),
  urgency: z.enum(UrgencyLevel).describe("Urgencia estimada según los criterios del sistema"),
  urgencyReason: z.string().describe("Por qué elegiste ese nivel de urgencia, en una frase"),
  questionsForVet: z.array(z.string()).describe("Dudas del dueño o datos que el veterinario debería confirmar"),
});

export type AiSummary = z.infer<typeof AiSummarySchema>;

// Lo que guardamos en la columna JSONB structuredData. Se valida al LEER también (la BD no
// conoce la forma interna de un JSON): si mañana cambia el schema, los registros viejos no
// rompen la página en silencio.
export const StoredPreConsultationSchema = z.object({
  ai: AiSummarySchema,
  redFlags: z.array(z.string()), //  Señales que detectó NUESTRO código
  aiUrgency: z.enum(UrgencyLevel), // Lo que propuso la IA (puede diferir del final: auditoría)
  transcript: TranscriptSchema, //   La conversación completa, para que el vet la pueda revisar
});
