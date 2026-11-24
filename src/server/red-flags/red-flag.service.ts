// SEÑALES DE ALARMA DE LA CLÍNICA: reglas de negocio.
//
// Diseño de seguridad "monótona": desde la interfaz el triaje solo puede volverse MÁS estricto.
//   · La lista base (código) no se puede ver alterada desde aquí.
//   · Las frases de la clínica solo SUMAN señales a la base.
//   · Nada se borra: una frase mal escrita se desactiva, con auditoría de quién y cuándo.
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "../auth/session";
import { type ClinicRedFlag, detectRedFlags } from "../pre-consultation/triage";
import { DomainError } from "../shared/errors";
import type { AddRedFlagInput } from "./red-flag.schemas";

// Defensa en profundidad: la acción ya exige el rol, pero el servicio no confía en quien lo llame.
function assertCanManage(user: CurrentUser) {
  if (user.role !== "VET" && user.role !== "ADMIN") {
    throw new DomainError("FORBIDDEN", "Solo el personal veterinario puede gestionar alertas");
  }
}

// ---------------------------------------------------------------------------------------------
// TRIAJE: frases activas + detección completa.
// ---------------------------------------------------------------------------------------------
async function listActiveClinicFlags(): Promise<ClinicRedFlag[]> {
  try {
    return await prisma.redFlagKeyword.findMany({ where: { active: true }, select: { label: true, phrase: true } });
  } catch (error) {
    // FALLA SEGURA: antes el triaje era una función pura que no podía caerse; ahora depende de la
    // BD. Si la BD falla, seguimos con la lista BASE en vez de romper el chat: perdemos las frases
    // de la clínica un momento, pero nunca la red de seguridad mínima.
    console.error("[red-flags] could not load clinic flags, using base list only", error);
    return [];
  }
}

export async function detectAllRedFlags(ownerTexts: readonly string[]) {
  return detectRedFlags(ownerTexts, await listActiveClinicFlags());
}

// ---------------------------------------------------------------------------------------------
// GESTIÓN (página de alertas del vet)
// ---------------------------------------------------------------------------------------------
export async function listRedFlagsForManagement() {
  return prisma.redFlagKeyword.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      phrase: true,
      active: true,
      createdAt: true,
      deactivatedAt: true,
      createdBy: { select: { name: true } },
      deactivatedBy: { select: { name: true } },
    },
  });
}

export async function addRedFlag(user: CurrentUser, input: AddRedFlagInput) {
  assertCanManage(user);

  // ¿La lista base ya la cubre? (ej. "chocolate"). Evitamos duplicar y se lo decimos al vet.
  if (detectRedFlags([input.phrase]).length > 0) {
    throw new DomainError("CONFLICT", "Esa frase ya está cubierta por la lista base");
  }

  // Si existía y estaba desactivada, la reactivamos (el UNIQUE impide crear otra igual).
  const existing = await prisma.redFlagKeyword.findUnique({ where: { phrase: input.phrase }, select: { id: true, active: true } });
  if (existing?.active) throw new DomainError("CONFLICT", "Esa frase ya está en la lista");
  if (existing) {
    return prisma.redFlagKeyword.update({
      where: { id: existing.id },
      data: { active: true, label: input.label, createdById: user.id, deactivatedById: null, deactivatedAt: null },
    });
  }

  try {
    return await prisma.redFlagKeyword.create({ data: { ...input, createdById: user.id } });
  } catch (error) {
    // Dos vets añadiendo la misma frase a la vez: el UNIQUE decide (misma idea que las citas).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("CONFLICT", "Esa frase ya está en la lista");
    }
    throw error;
  }
}

// Desactivar (no borrar). La guarda va en el WHERE: solo si SIGUE activa.
export async function deactivateRedFlag(user: CurrentUser, id: string) {
  assertCanManage(user);
  const { count } = await prisma.redFlagKeyword.updateMany({
    where: { id, active: true },
    data: { active: false, deactivatedById: user.id, deactivatedAt: new Date() },
  });
  if (count === 0) throw new DomainError("NOT_FOUND", "La alerta no existe o ya estaba desactivada");
}
