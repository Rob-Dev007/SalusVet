import { describe, expect, it } from "vitest";
import {
  AI_RATE_LIMITS,
  evaluateRateLimit,
  formatRetryAfter,
  type RateLimitRule,
  retryAfterSeconds,
  windowStart,
} from "./rate-limit";

const TEN_MIN = 10 * 60_000;
const DAY = 24 * 60 * 60_000;
const at = (iso: string) => new Date(iso);

describe("windowStart", () => {
  it("redondea hacia abajo al inicio de la ventana", () => {
    expect(windowStart(at("2026-11-26T10:07:42Z"), TEN_MIN).toISOString()).toBe("2026-11-26T10:00:00.000Z");
  });

  it("el instante exacto del borde ya pertenece a la ventana NUEVA", () => {
    expect(windowStart(at("2026-11-26T10:10:00Z"), TEN_MIN).toISOString()).toBe("2026-11-26T10:10:00.000Z");
  });
});

describe("retryAfterSeconds", () => {
  it("cuenta los segundos hasta la próxima ventana", () => {
    expect(retryAfterSeconds(at("2026-11-26T10:07:00Z"), TEN_MIN)).toBe(180);
  });

  it("nunca devuelve 0 (redondea hacia arriba)", () => {
    expect(retryAfterSeconds(at("2026-11-26T10:09:59.800Z"), TEN_MIN)).toBe(1);
  });
});

describe("evaluateRateLimit", () => {
  const burst: RateLimitRule = { scope: "user", limit: 30, windowMs: TEN_MIN };
  const daily: RateLimitRule = { scope: "user-day", limit: 100, windowMs: DAY };
  const now = at("2026-11-26T10:07:00Z");

  it("justo en el límite todavía se permite (la llamada 30 de 30)", () => {
    expect(evaluateRateLimit([{ rule: burst, count: 30 }], now)).toEqual({ allowed: true });
  });

  it("la llamada 31 se rechaza y dice cuándo reintentar", () => {
    expect(evaluateRateLimit([{ rule: burst, count: 31 }], now)).toEqual({ allowed: false, retryAfterSeconds: 180 });
  });

  it("si se pasan varias reglas, devuelve la espera más larga", () => {
    const result = evaluateRateLimit([{ rule: burst, count: 31 }, { rule: daily, count: 101 }], now);
    // Hasta la medianoche UTC: 13 h 53 min.
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 13 * 3600 + 53 * 60 });
  });
});

describe("AI_RATE_LIMITS", () => {
  it("una pre-consulta completa (12 mensajes + resumen) cabe en cualquier límite", () => {
    for (const rule of AI_RATE_LIMITS) expect(rule.limit).toBeGreaterThanOrEqual(13);
  });
});

describe("formatRetryAfter", () => {
  it.each([
    [1, "en 1 minuto"],
    [60, "en 1 minuto"],
    [61, "en 2 minutos"],
    [180, "en 3 minutos"],
    [3600, "en aproximadamente 1 hora"],
    [13 * 3600 + 53 * 60, "en unas 14 horas"],
  ])("%i s → «%s»", (seconds, expected) => {
    expect(formatRetryAfter(seconds)).toBe(expected);
  });
});
