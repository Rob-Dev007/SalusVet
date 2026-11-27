// Configuración de Claude (la usa el adaptador src/server/pre-consultation/ai/claude.ts).
// "server-only": si un Client Component importara esto por error, el build falla en vez de
// arrastrar código de servidor al navegador.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Un solo lugar para el modelo: cambiarlo es una línea, y queda registrado en cada pre-consulta
// (columna aiModel) para saber qué modelo generó cada resumen.
export const AI_MODEL = "claude-opus-5-5";

// Fallback del lado del servidor: si el modelo principal declina una petición por sus filtros de
// seguridad (stop_reason "refusal"), la API la reintenta con otro modelo dentro de la misma
// llamada. "default" deja que la API elija según la categoría, sin mantener una lista nosotros.
export const AI_FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: Anthropic.Beta.BetaFallbacksParam } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};
