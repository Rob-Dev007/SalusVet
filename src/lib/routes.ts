// Página de inicio de cada rol. Compartido por servidor (redirecciones) y cliente (tras el login).
import type { Role } from "@/generated/prisma/enums";

export function homePathFor(role: Role) {
  return role === "VET" ? "/agenda" : "/pets";
}
