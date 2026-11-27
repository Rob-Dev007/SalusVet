// RATE LIMITING contra la BD. Las reglas y la aritmética viven en @/domain/rate-limit (puras);
// aquí solo contamos de forma ATÓMICA.
import "server-only";
import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AI_RATE_LIMITS,
  evaluateRateLimit,
  formatRetryAfter,
  type RateLimitRule,
  windowStart,
} from "@/domain/rate-limit";
import { RateLimitError } from "../shared/errors";

const DAY_MS = 24 * 60 * 60_000;

// Suma 1 a cada contador y devuelve el total NUEVO, todo en UNA sentencia:
//
//   INSERT ... ON CONFLICT (key, windowStart) DO UPDATE SET count = count + 1 RETURNING count
//
// ¿Por qué no "leer el contador, comparar y luego sumar"? Es el mismo TOCTOU de siempre: diez
// peticiones simultáneas leerían todas "29", todas pasarían, y el límite de 30 dejaría pasar 39.
// Con el upsert, Postgres bloquea la fila mientras suma: cada petición ve SU número (30, 31, 32...).
//
// Es SQL a mano porque Prisma no garantiza un upsert atómico con clave compuesta. $queryRaw con
// plantilla (`...${valor}`) envía los valores como PARÁMETROS, nunca concatenados: sin inyección SQL.
async function hit(buckets: ReadonlyArray<{ key: string; windowStart: Date }>) {
  const rows = Prisma.join(buckets.map((b) => Prisma.sql`(${b.key}, ${b.windowStart}, 1)`));
  return prisma.$queryRaw<Array<{ key: string; count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES ${rows}
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "key", "count"`;
}

// Cada llamada a la IA pasa por aquí ANTES de llamar al proveedor. Lanza RateLimitError si el
// dueño (o su IP) superó algún límite.
//
// Nota: las llamadas RECHAZADAS también suman. Es a propósito: quien insiste en plena espera no
// consigue colarse en cuanto el contador baja, porque en ventana fija el contador nunca baja.
export async function enforceAiRateLimit(client: { userId: string; ip: string | null }, now = new Date()) {
  const keyFor = (rule: RateLimitRule) =>
    rule.scope === "ip" ? (client.ip ? `ai:ip:${client.ip}` : null) : `ai:${rule.scope}:${client.userId}`;

  // Sin IP conocida (en local) se omite esa regla: no metemos a "todos los desconocidos" en el
  // mismo contador, o un solo abusador bloquearía a todos.
  const checks = AI_RATE_LIMITS.flatMap((rule) => {
    const key = keyFor(rule);
    return key ? [{ rule, key, windowStart: windowStart(now, rule.windowMs) }] : [];
  });

  const counts = new Map((await hit(checks)).map((row) => [row.key, row.count]));
  const result = evaluateRateLimit(
    checks.map(({ rule, key }) => ({ rule, count: counts.get(key) ?? 0 })),
    now,
  );

  // Limpieza: las ventanas viejas no sirven para nada. Se borra DESPUÉS de responder (after) y solo
  // de vez en cuando, para no sumar una escritura a cada mensaje del chat.
  if (Math.random() < 0.02) {
    after(() =>
      prisma.rateLimitBucket
        .deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 2 * DAY_MS) } } })
        .catch((error) => console.error("[rate-limit] cleanup failed", error)),
    );
  }

  if (!result.allowed) {
    throw new RateLimitError(
      `Has usado mucho el asistente en poco tiempo. Puedes volver a intentarlo ${formatRetryAfter(
        result.retryAfterSeconds,
      )} o responder ahora el cuestionario guiado.`,
      result.retryAfterSeconds,
    );
  }
}
