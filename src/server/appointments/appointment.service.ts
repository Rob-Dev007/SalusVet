import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "../auth/session";
import { DomainError } from "../shared/errors";
import type { BookAppointmentInput, ChangeAppointmentStatusInput } from "./appointment.schemas";
import { type AppointmentActor, canTransition } from "./appointment.transitions";

const appointmentSelect = {
  id: true,
  scheduledAt: true,
  reason: true,
  status: true,
  pet: { select: { id: true, name: true, species: true, owner: { select: { name: true } } } },
  vet: { select: { id: true, name: true } },
} as const;

// P2002 = Prisma tradujo una violación de UNIQUE de Postgres.
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

// ---------------------------------------------------------------------------------------------
// CASO DE USO: un dueño agenda una cita.
// ---------------------------------------------------------------------------------------------
export async function bookAppointment(ownerId: string, input: BookAppointmentInput) {
  // petId viene del formulario → verificamos que la mascota sea DE ESTE DUEÑO.
  // Si no lo es, respondemos "no encontrada" (no "no es tuya"): no confirmamos que exista.
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, ownerId, deletedAt: null },
    select: { id: true },
  });
  if (!pet) throw new DomainError("NOT_FOUND", "Mascota no encontrada");

  // vetId también viene del formulario → ¿es de verdad un veterinario activo?
  const vet = await prisma.user.findFirst({
    where: { id: input.vetId, role: "VET", deletedAt: null },
    select: { id: true },
  });
  if (!vet) throw new DomainError("NOT_FOUND", "Veterinario no encontrado");

  try {
    return await prisma.$transaction(async (tx) => {
      // DOBLE RESERVA: no preguntamos antes "¿está libre?" (entre la pregunta y el INSERT otro
      // dueño podría ganarnos el turno). Insertamos directamente y dejamos que Postgres decida:
      // el índice único parcial (vetId, scheduledAt) para citas activas rechaza al segundo.
      // La comprobación y la escritura son UNA operación atómica dentro de la base.
      const appointment = await tx.appointment.create({
        data: { petId: pet.id, vetId: vet.id, scheduledAt: input.scheduledAt, reason: input.reason },
        select: appointmentSelect,
      });

      // Primera fila del historial: nace en PENDING, la creó el dueño.
      await tx.appointmentStatusChange.create({
        data: { appointmentId: appointment.id, fromStatus: null, toStatus: "PENDING", changedById: ownerId },
      });

      return appointment;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("CONFLICT", "Ese horario acaba de ser reservado. Elige otro turno.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// CASO DE USO: alguien cambia el estado de una cita (confirmar, cancelar, atender, no show).
// ---------------------------------------------------------------------------------------------
export async function changeAppointmentStatus(user: CurrentUser, input: ChangeAppointmentStatusInput) {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { status: true, vetId: true, pet: { select: { ownerId: true } } },
    });

    // ¿Qué RELACIÓN tiene este usuario con ESTA cita? (no basta con su rol global)
    let actor: AppointmentActor | null = null;
    if (appointment?.pet.ownerId === user.id) actor = "OWNER";
    else if (user.role === "VET" && appointment?.vetId === user.id) actor = "VET";

    // Sin relación = como si la cita no existiera. Un vet no puede tocar la agenda de otro vet.
    if (!appointment || !actor) throw new DomainError("NOT_FOUND", "Cita no encontrada");

    const from = appointment.status;
    if (!canTransition(from, input.to, actor)) {
      throw new DomainError("INVALID_TRANSITION", "Esa acción no está disponible para esta cita");
    }

    // La guarda va en el WHERE (lo vimos en la Fase 1): solo actualiza si SIGUE en el estado que
    // leímos. Si otro usuario la cambió en este instante, count = 0 y abortamos.
    const { count } = await tx.appointment.updateMany({
      where: { id: input.appointmentId, status: from },
      data: { status: input.to },
    });
    if (count === 0) {
      throw new DomainError("CONFLICT", "La cita cambió mientras tanto. Recarga la página.");
    }

    // Auditoría: quién, cuándo, de qué a qué. Si esto falla, el UPDATE se deshace (ROLLBACK).
    await tx.appointmentStatusChange.create({
      data: { appointmentId: input.appointmentId, fromStatus: from, toStatus: input.to, changedById: user.id },
    });
  });
}

// ---------------------------------------------------------------------------------------------
// LECTURAS
// ---------------------------------------------------------------------------------------------
export async function listAppointmentsForOwner(ownerId: string) {
  return prisma.appointment.findMany({
    where: { pet: { ownerId } }, // Filtro por relación: solo citas de MIS mascotas
    orderBy: { scheduledAt: "desc" },
    select: appointmentSelect,
  });
}

export async function listAgendaForVet(vetId: string, from: Date) {
  return prisma.appointment.findMany({
    where: { vetId, scheduledAt: { gte: from } },
    orderBy: { scheduledAt: "asc" },
    select: appointmentSelect,
  });
}

export async function listVets() {
  return prisma.user.findMany({
    where: { role: "VET", deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
