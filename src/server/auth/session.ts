import "server-only";
import { connection } from "next/server";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type CurrentUser = { id: string; role: Role };

// ⚠️ STUB TEMPORAL — se reemplaza en la fase de autenticación.
// Devuelve siempre un dueño de desarrollo fijo. El resto de la app (servicios, actions)
// solo conoce la FIRMA de esta función: cuando llegue la auth real, nada más cambia.
const DEV_OWNER_EMAIL = "dev-owner@salusvet.local";

export async function requireUser(): Promise<CurrentUser> {
  // Con cacheComponents, Next intenta prerenderizar en el build. connection() le dice:
  // "esto depende de QUIÉN hace la petición, espera a que haya una". La auth real usará
  // cookies(), que tiene el mismo efecto.
  await connection();

  // Candado: si este stub llegara a producción, cualquiera sería "dev-owner". Mejor romper.
  if (process.env.NODE_ENV === "production") {
    throw new Error("requireUser() es un stub de desarrollo: implementa la autenticación real");
  }

  // upsert = "créalo si no existe, si existe no toques nada". Idempotente.
  return prisma.user.upsert({
    where: { email: DEV_OWNER_EMAIL },
    update: {},
    create: { email: DEV_OWNER_EMAIL, name: "Dueño de desarrollo", role: "OWNER" },
    select: { id: true, role: true }, // Nunca devolvemos passwordHash ni datos que no hacen falta
  });
}
