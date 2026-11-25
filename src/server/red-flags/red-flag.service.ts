// SEÑALES DE ALARMA DE LA CLÍNICA: reglas de negocio.
//
// Diseño de seguridad "monótona": desde la interfaz el triaje solo puede volverse MÁS estricto.
//   · La lista base (código) no se puede ver alterada desde aquí.
//   · Las frases de la clínica solo SUMAN señales a la base.
//   · Nada se borra: una frase mal escrita se desactiva, con auditoría de quién y cuándo.
//   · Desactivar (lo único que AFLOJA el triaje) exige CUATRO OJOS: una persona lo pide con
//     motivo y OTRA lo aprueba. Y un ADMIN puede PROTEGER una alerta para que nadie la toque.
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "../auth/session";
import { type ClinicRedFlag, detectRedFlags } from "@/domain/triage";
import { DomainError } from "../shared/errors";
import type { AddRedFlagInput } from "./red-flag.schemas";

// Defensa en profundidad: la acción ya exige el rol, pero el servicio no confía en quien lo llame.
function assertCanManage(user: CurrentUser) {
  if (user.role !== "VET" && user.role !== "ADMIN") {
    throw new DomainError("FORBIDDEN", "Solo el personal veterinario puede gestionar alertas");
  }
}

// Proteger es más delicado que gestionar: no tiene vuelta atrás desde la interfaz.
function assertIsAdmin(user: CurrentUser) {
  if (user.role !== "ADMIN") throw new DomainError("FORBIDDEN", "Solo un administrador puede proteger alertas");
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
      deactivationRequestedById: true, // La UI lo compara con el usuario actual (¿la pedí yo?)
      deactivationRequestedAt: true,
      deactivationReason: true,
      locked: true,
      lockedAt: true,
      createdBy: { select: { name: true } },
      deactivatedBy: { select: { name: true } },
      deactivationRequestedBy: { select: { name: true } },
      lockedBy: { select: { name: true } },
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
      // Vuelve como nueva: limpiamos la baja anterior (pedido y aprobación) para que no se mezcle
      // con la siguiente. (Si alguna vez hiciera falta el historial completo: tabla de eventos.)
      data: {
        active: true,
        label: input.label,
        createdById: user.id,
        deactivatedById: null,
        deactivatedAt: null,
        deactivationRequestedById: null,
        deactivationRequestedAt: null,
        deactivationReason: null,
      },
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

// ---------------------------------------------------------------------------------------------
// BAJA CON CUATRO OJOS
//
// Patrón de todas estas funciones: la REGLA va en el WHERE de un updateMany, no en un `if` previo.
// Leer la fila, comprobar y luego escribir deja una ventana (TOCTOU): entre la lectura y la escritura
// otra persona puede haber cambiado la alerta. Con la condición en el WHERE, Postgres comprueba y
// escribe en UNA sola operación atómica: o se cumple todo y se actualiza, o count = 0.
// Solo si count = 0 leemos la fila, para explicarle al usuario POR QUÉ no se pudo.
// ---------------------------------------------------------------------------------------------

// Paso 1: solicitar. La alerta SIGUE ACTIVA mientras nadie apruebe (falla segura).
export async function requestRedFlagDeactivation(user: CurrentUser, id: string, reason: string) {
  assertCanManage(user);
  const { count } = await prisma.redFlagKeyword.updateMany({
    where: { id, active: true, locked: false, deactivationRequestedById: null },
    data: { deactivationRequestedById: user.id, deactivationRequestedAt: new Date(), deactivationReason: reason },
  });
  if (count === 0) await explainRejection(id);
}

// Paso 2: aprobar. Solo OTRA persona distinta de la que la pidió.
export async function approveRedFlagDeactivation(user: CurrentUser, id: string) {
  assertCanManage(user);
  const { count } = await prisma.redFlagKeyword.updateMany({
    where: {
      id,
      active: true,
      locked: false,
      // Hay una solicitud pendiente... y NO es mía. Las dos condiciones explícitas: en SQL,
      // `NULL <> 'x'` no es verdadero, y no queremos depender de cómo Prisma traduce `not`.
      AND: [{ deactivationRequestedById: { not: null } }, { NOT: { deactivationRequestedById: user.id } }],
    },
    data: { active: false, deactivatedById: user.id, deactivatedAt: new Date() },
  });
  if (count === 0) await explainRejection(id, user.id);
}

// Rechazar / retirar la solicitud. Cualquiera del personal puede, incluida quien la pidió:
// es la dirección SEGURA (la alerta se queda activa), así que no necesita cuatro ojos.
export async function cancelRedFlagDeactivation(user: CurrentUser, id: string) {
  assertCanManage(user);
  const { count } = await prisma.redFlagKeyword.updateMany({
    where: { id, active: true, deactivationRequestedById: { not: null } },
    data: { deactivationRequestedById: null, deactivationRequestedAt: null, deactivationReason: null },
  });
  if (count === 0) throw new DomainError("NOT_FOUND", "Esa alerta no tiene una baja pendiente");
}

// Proteger (solo ADMIN). Unidireccional: desde la interfaz no existe "desproteger". Si una alerta
// protegida estuviera mal, se corrige con un cambio de código o de BD revisado, no con un clic.
// Si tenía una baja pendiente, se descarta: proteger significa "esta se queda".
export async function lockRedFlag(user: CurrentUser, id: string) {
  assertIsAdmin(user);
  const { count } = await prisma.redFlagKeyword.updateMany({
    where: { id, active: true, locked: false },
    data: {
      locked: true,
      lockedById: user.id,
      lockedAt: new Date(),
      deactivationRequestedById: null,
      deactivationRequestedAt: null,
      deactivationReason: null,
    },
  });
  if (count === 0) throw new DomainError("CONFLICT", "La alerta no existe, está inactiva o ya estaba protegida");
}

// Solo se llama cuando el updateMany no tocó nada: traduce el estado real a un mensaje claro.
// Siempre LANZA (el tipo `never` obliga a que así sea).
async function explainRejection(id: string, approverId?: string): Promise<never> {
  const flag = await prisma.redFlagKeyword.findUnique({
    where: { id },
    select: { active: true, locked: true, deactivationRequestedById: true },
  });
  if (!flag) throw new DomainError("NOT_FOUND", "La alerta no existe");
  if (!flag.active) throw new DomainError("CONFLICT", "La alerta ya estaba desactivada");
  if (flag.locked) throw new DomainError("FORBIDDEN", "Esta alerta está protegida y no se puede desactivar");
  if (approverId === undefined) throw new DomainError("CONFLICT", "Ya hay una solicitud de baja pendiente");
  if (flag.deactivationRequestedById === approverId) {
    throw new DomainError("FORBIDDEN", "Otra persona del equipo debe aprobar tu solicitud");
  }
  throw new DomainError("CONFLICT", "No hay una solicitud de baja pendiente");
}
