// PUERTO DE IA (patrón Puertos y Adaptadores / inversión de dependencias, la "D" de SOLID).
//
// El servicio de pre-consulta NO conoce a Google ni a Anthropic: solo conoce esta interfaz.
// Cada proveedor es un ADAPTADOR que la implementa (gemini.ts, claude.ts). Cambiar de proveedor
// = cambiar AI_PROVIDER en el .env. Cero cambios en el servicio, la ruta o las pantallas.
//
//                     ┌──────────────────────┐
//   servicio ───────▶ │  PreConsultationAI   │ ◀── interfaz (lo que NECESITAMOS)
//                     └──────────────────────┘
//                         ▲              ▲
//                  GeminiAdapter    ClaudeAdapter ◀── detalles (cómo lo da cada proveedor)
import "server-only";
import type { AiSummary, Transcript } from "../pre-consultation.schemas";

export type ChatInput = {
  rules: string; //               Instrucciones fijas (CHAT_SYSTEM_PROMPT)
  context: string; //             Datos de la mascota, ya delimitados con <mascota>
  transcript: Transcript;
  operatorNote: string | null; // Instrucción que añade NUESTRO código (ej. emergencia detectada)
  signal: AbortSignal;
};

export type SummaryInput = {
  rules: string; //        SUMMARY_SYSTEM_PROMPT
  context: string;
  conversation: string; // La conversación ya formateada como texto
};

export interface PreConsultationAI {
  readonly model: string; // Se guarda en cada pre-consulta (trazabilidad)
  // Un generador asíncrono de trozos de texto: el adaptador traduce los eventos de SU SDK a
  // simples strings. El servicio no ve nada específico del proveedor.
  streamReply(input: ChatInput): AsyncGenerator<string>;
  // Debe devolver un resumen YA VALIDADO con AiSummarySchema (Zod). Nunca JSON crudo.
  summarize(input: SummaryInput): Promise<AiSummary>;
}

// El proveedor falló de una forma "esperable" (caído, cuota agotada, declinó responder).
// El servicio la traduce a un DomainError y la interfaz ofrece el cuestionario de respaldo.
export class AiUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiUnavailableError";
  }
}
