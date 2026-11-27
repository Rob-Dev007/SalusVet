// RATE LIMITING: las REGLAS (cuántas llamadas, en qué ventana) y la aritmética de las ventanas.
// Funciones puras: el servicio pone la BD, aquí solo hay números. Por eso se prueban sin nada.
//
// Algoritmo: VENTANA FIJA. El tiempo se parte en bloques (10:00–10:10, 10:10–10:20...) y cada
// bloque tiene su contador. Es el más simple y basta para proteger un presupuesto. Su defecto
// conocido: en el borde se pueden juntar dos ventanas (10 llamadas a las 10:09 y 10 a las 10:10).
// Para un límite de costos eso es aceptable; para algo más fino existe la "ventana deslizante".

export type RateLimitRule = {
  scope: "user" | "user-day" | "ip"; // Prefijo de la clave en la BD
  limit: number; //                     Máximo de llamadas por ventana
  windowMs: number; //                  Tamaño de la ventana
};

const MINUTE = 60_000;

// Llamadas a la IA (cada mensaje del chat y el resumen final). Una pre-consulta completa usa como
// mucho 13: 12 mensajes del dueño (MAX_TURNS = 24) + 1 resumen. Los límites dejan margen para
// reintentos, pero frenan a un script que mande cientos.
export const AI_RATE_LIMITS = [
  { scope: "user", limit: 30, windowMs: 10 * MINUTE }, //        Ráfagas: ~2 pre-consultas cada 10 min
  // Tope diario por dueño. El "día" va de medianoche a medianoche UTC (19:00 en Loja): para un
  // tope de costos da igual dónde empiece el día, y así no dependemos de la zona horaria.
  { scope: "user-day", limit: 100, windowMs: 24 * 60 * MINUTE },
  // Por IP: sin verificación de email, alguien podría crear muchas cuentas. El límite es más alto
  // porque varias personas pueden compartir IP (la wifi de la clínica, una universidad).
  { scope: "ip", limit: 120, windowMs: 10 * MINUTE },
] as const satisfies readonly RateLimitRule[];

// Inicio de la ventana que contiene `now`. 10:07 con ventanas de 10 min → 10:00.
// Las ventanas se cuentan desde 1970 (epoch), así todas las instancias calculan la MISMA.
export function windowStart(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

// Segundos hasta que empiece la próxima ventana (para el encabezado HTTP Retry-After).
// Redondeamos hacia ARRIBA: decir "1" cuando faltan 0,2 s es mejor que decir "0".
export function retryAfterSeconds(now: Date, windowMs: number) {
  const nextWindow = windowStart(now, windowMs).getTime() + windowMs;
  return Math.max(1, Math.ceil((nextWindow - now.getTime()) / 1000));
}

// Dado lo que contó la BD para cada regla, ¿se pasó alguna? Si se pasan varias, devolvemos la
// espera MÁS LARGA: no sirve decir "vuelve en 2 min" si el tope diario sigue agotado.
export function evaluateRateLimit(
  counts: ReadonlyArray<{ rule: RateLimitRule; count: number }>,
  now: Date,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const exceeded = counts.filter(({ rule, count }) => count > rule.limit);
  if (exceeded.length === 0) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(...exceeded.map(({ rule }) => retryAfterSeconds(now, rule.windowMs))),
  };
}

// "en 1 minuto", "en 4 minutos", "en unas 3 horas": para el mensaje que lee el dueño.
export function formatRetryAfter(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "en 1 minuto" : `en ${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "en aproximadamente 1 hora" : `en unas ${hours} horas`;
}
