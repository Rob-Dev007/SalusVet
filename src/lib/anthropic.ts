// Cliente de la API de Claude. "server-only" es CRÍTICO aquí: si por error un Client Component
// importara este archivo, el build falla en vez de mandar la API key al navegador, donde
// cualquiera podría copiarla y gastar a nuestra costa.
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

// ¿Está configurada la clave? Sin ella preferimos un mensaje claro a un error 401 críptico.
export const isAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Singleton perezoso: se crea en la primera llamada, no al importar el módulo. Así el build
// (que importa los módulos) no necesita la clave. new Anthropic() lee ANTHROPIC_API_KEY del entorno.
let client: Anthropic | undefined;
export function anthropic() {
  client ??= new Anthropic();
  return client;
}
