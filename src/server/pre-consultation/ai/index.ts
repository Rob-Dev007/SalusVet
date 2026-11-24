// FÁBRICA: lee la configuración y entrega el adaptador correcto (o null = sin IA).
//
//   AI_PROVIDER="gemini" + GEMINI_API_KEY     → chat con Gemini (gratis)
//   AI_PROVIDER="claude" + ANTHROPIC_API_KEY  → chat con Claude (de pago)
//   vacío o sin key                           → cuestionario guiado ($0)
//
// Pedimos proveedor Y key: tener una key cargada no debe encender la IA por accidente.
import "server-only";
import { createClaudeAdapter } from "./claude";
import { createGeminiAdapter } from "./gemini";
import type { PreConsultationAI } from "./provider";

let cached: { key: string; adapter: PreConsultationAI | null } | undefined;

export function getPreConsultationAI(): PreConsultationAI | null {
  const provider = process.env.AI_PROVIDER;
  const key =
    provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "claude" ? process.env.ANTHROPIC_API_KEY : undefined;

  // Memoizamos por configuración: el adaptador (y su cliente HTTP) se crea una vez, no por petición.
  const cacheKey = `${provider}:${key ? "set" : "unset"}`;
  if (cached?.key === cacheKey) return cached.adapter;

  const adapter = !key ? null : provider === "gemini" ? createGeminiAdapter(key) : createClaudeAdapter(key);
  cached = { key: cacheKey, adapter };
  return adapter;
}

export { AiUnavailableError } from "./provider";
export type { PreConsultationAI } from "./provider";
