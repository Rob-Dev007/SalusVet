// ADAPTADOR GEMINI (Google). Nivel gratuito: ideal para una clínica que recién empieza.
// ⚠️ En el nivel gratuito Google puede usar los datos para mejorar sus productos: por eso
// la pantalla avisa al dueño y solo enviamos datos de la MASCOTA (nunca nombre, email ni teléfono).
import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { AiSummarySchema } from "../pre-consultation.schemas";
import { AiUnavailableError, type ChatInput, type PreConsultationAI, type SummaryInput } from "./provider";

// Flash-Lite: el más rápido y económico de su familia, estable, recomendado para proyectos nuevos.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

// CUALQUIER error de la API de Google → AiUnavailableError: el dueño nunca se queda bloqueado,
// el servicio le ofrece el cuestionario. El status queda en el log para el programador:
//   429 = cuota gratuita agotada · 5xx = Google caído o saturado · 400/403 = key inválida o
//   revocada, o un schema que Google no acepta (estos dos últimos son para arreglar nosotros).
// Errores que NO vienen de la API (un bug en nuestro código) se relanzan tal cual.
function translate(error: unknown): never {
  if (error instanceof ApiError) {
    throw new AiUnavailableError(`Gemini ${error.status}: ${error.message.slice(0, 200)}`, { cause: error });
  }
  throw error;
}

export function createGeminiAdapter(apiKey: string): PreConsultationAI {
  const ai = new GoogleGenAI({ apiKey });

  return {
    model: GEMINI_MODEL,

    async *streamReply({ rules, context, transcript, operatorNote, signal }: ChatInput) {
      // Gemini no tiene mensajes "system" a mitad de conversación (Claude sí). La instrucción de
      // nuestro código va al final de systemInstruction, marcada como prioritaria.
      const systemInstruction = [rules, context, operatorNote && `INSTRUCCIÓN PRIORITARIA DEL SISTEMA: ${operatorNote}`]
        .filter(Boolean)
        .join("\n\n");

      let stream;
      try {
        stream = await ai.models.generateContentStream({
          model: GEMINI_MODEL,
          // Gemini llama "model" a lo que Claude llama "assistant": el adaptador traduce.
          contents: transcript.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          config: {
            systemInstruction,
            maxOutputTokens: 1024, // Una pregunta corta; incluye el razonamiento interno
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }, // Rápido: no hace falta pensar mucho
            abortSignal: signal, // Si el dueño cierra la pestaña, cortamos la petición
          },
        });
      } catch (error) {
        translate(error);
      }

      try {
        for await (const chunk of stream) {
          if (chunk.text) yield chunk.text; // .text es undefined en trozos sin texto (o bloqueados)
        }
      } catch (error) {
        translate(error);
      }
    },

    async summarize({ rules, context, conversation }: SummaryInput) {
      let text: string | undefined;
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `<conversacion>\n${conversation}\n</conversacion>`,
          config: {
            systemInstruction: `${rules}\n\n${context}`,
            // Salida estructurada: Gemini debe responder JSON que cumpla este JSON Schema,
            // generado DESDE nuestro schema Zod (una sola fuente de verdad).
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(AiSummarySchema),
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        text = response.text;
      } catch (error) {
        translate(error);
      }

      // Que el proveedor "prometa" respetar el schema no basta: VALIDAMOS igual con Zod.
      // (Gemini ignora en silencio algunas reglas del schema, como longitudes mínimas.)
      try {
        return AiSummarySchema.parse(JSON.parse(text ?? ""));
      } catch (error) {
        throw new AiUnavailableError("Gemini devolvió un resumen inválido", { cause: error });
      }
    },
  };
}
