// ADAPTADOR CLAUDE (Anthropic). La mejora de pago: se activa con AI_PROVIDER="claude" cuando la
// clínica decida invertir. Mismo contrato que Gemini: el servicio no nota la diferencia.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_FALLBACK, AI_MODEL } from "@/lib/anthropic";
import { AiSummarySchema } from "../pre-consultation.schemas";
import { AiUnavailableError, type ChatInput, type PreConsultationAI, type SummaryInput } from "./provider";

// System en dos bloques: [reglas fijas, CACHEADAS] + [datos de esta mascota, variables].
// El caché funciona por PREFIJO: lo que cambia va después del punto de corte.
const system = (rules: string, context: string): Anthropic.Beta.BetaTextBlockParam[] => [
  { type: "text", text: rules, cache_control: { type: "ephemeral" } },
  { type: "text", text: context },
];

// Mismo criterio que Gemini: cualquier error de la API (límite, caída, key inválida, sin conexión)
// → AiUnavailableError y el dueño pasa al cuestionario. APIConnectionError hereda de APIError.
// Los errores de NUESTRO código (no de la API) se relanzan tal cual.
function translate(error: unknown): never {
  if (error instanceof Anthropic.APIError) {
    throw new AiUnavailableError(`Claude ${error.status ?? "sin conexión"}: ${error.message.slice(0, 200)}`, { cause: error });
  }
  throw error;
}

export function createClaudeAdapter(apiKey: string): PreConsultationAI {
  const client = new Anthropic({ apiKey });

  return {
    model: AI_MODEL,

    async *streamReply({ rules, context, transcript, operatorNote, signal }: ChatInput) {
      const messages: Anthropic.Beta.BetaMessageParam[] = [...transcript];
      // Claude sí admite un mensaje "system" a mitad de conversación: autoridad de operador.
      if (operatorNote) messages.push({ role: "system", content: operatorNote });

      const stream = client.beta.messages.stream(
        {
          model: AI_MODEL,
          max_tokens: 8000, // Incluye el razonamiento interno, no solo el texto visible
          output_config: { effort: "low" }, // Una pregunta corta: rápido y barato
          system: system(rules, context),
          messages,
          ...AI_FALLBACK,
        },
        { signal },
      );

      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
        }
        // Siempre revisar stop_reason: si el modelo (y su fallback) declinaron, no dejamos una burbuja vacía.
        if ((await stream.finalMessage()).stop_reason === "refusal") {
          yield "No puedo ayudarte con eso. Cuéntame cómo está tu mascota.";
        }
      } catch (error) {
        translate(error);
      }
    },

    async summarize({ rules, context, conversation }: SummaryInput) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model: AI_MODEL,
          max_tokens: 16000,
          output_config: { effort: "medium", format: betaZodOutputFormat(AiSummarySchema) },
          system: system(rules, context),
          messages: [{ role: "user", content: `<conversacion>\n${conversation}\n</conversacion>` }],
          ...AI_FALLBACK,
        });
      } catch (error) {
        translate(error);
      }
      if (response.stop_reason === "refusal") throw new AiUnavailableError("Claude declinó resumir");
      // parsed_output ya viene validado con Zod por el SDK; null = no pasó la validación.
      if (!response.parsed_output) throw new AiUnavailableError(`Resumen inválido (stop_reason=${response.stop_reason})`);
      return response.parsed_output;
    },
  };
}
