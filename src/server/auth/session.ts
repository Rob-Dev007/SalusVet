import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { homePathFor } from "@/lib/routes";

export type CurrentUser = { id: string; name: string; role: Role };

// Lee la sesión del usuario que hace ESTA petición.
// cache() de React: si en un mismo render la llaman la página, el layout y un componente,
// la consulta a la BD se hace UNA vez. (Solo dura lo que dura la petición, no se comparte.)
const getSession = cache(async () =>
  // headers() incluye la cookie de sesión. Better Auth busca su token en la tabla Session:
  // si la fila no existe o expiró, devuelve null. Por eso revocar una sesión es inmediato.
  auth.api.getSession({ headers: await headers() }),
);

// Para páginas y acciones que EXIGEN sesión: si no hay, redirige al login.
// Esta es la verificación REAL de seguridad (la del proxy es solo optimista).
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) redirect("/sign-in"); // redirect() lanza una excepción especial de Next: corta aquí

  const { id, name, role } = session.user;
  return { id, name, role };
}

// Para partes que funcionan con o sin sesión (ej. el menú del encabezado).
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const { id, name, role } = session.user;
  return { id, name, role };
}

// Para páginas exclusivas de un rol. Un VET que entra a /appointments (de dueños) no ve un
// error: lo llevamos a SU inicio. La autorización fina (¿esta cita es tuya?) sigue en el servicio.
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}
