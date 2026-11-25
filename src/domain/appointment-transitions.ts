// MÁQUINA DE ESTADOS de una cita, como DATOS (una tabla), no como código (if/switch).
//
// Sin "server-only": es lógica pura. El servidor la usa para AUTORIZAR y la UI para decidir
// qué botones mostrar. Una sola fuente de verdad: imposible que la UI ofrezca un botón que
// el servidor luego rechaza (o al revés).
import type { AppointmentStatus } from "@/generated/prisma/enums";

// Quién actúa sobre la cita. No es el rol global: es la RELACIÓN con ESTA cita.
// "OWNER" = dueño de la mascota de esta cita · "VET" = veterinario asignado a esta cita.
export type AppointmentActor = "OWNER" | "VET";

// Desde → { Hasta: quién puede hacerlo }. Lo que no aparece, está prohibido.
export const appointmentTransitions = {
  PENDING: {
    CONFIRMED: ["VET"],
    CANCELLED: ["OWNER", "VET"], // La clínica también puede cancelar (ej. el vet enfermó)
  },
  CONFIRMED: {
    ATTENDED: ["VET"],
    NO_SHOW: ["VET"],
    CANCELLED: ["OWNER", "VET"],
  },
  // Estados TERMINALES: la historia no se reescribe. ¿Cancelaste por error? Agendas otra cita.
  CANCELLED: {},
  ATTENDED: {},
  NO_SHOW: {},
} as const satisfies Record<
  AppointmentStatus, // ← "satisfies" obliga a cubrir TODOS los estados del enum: si mañana
  //                       agregas RESCHEDULED a Prisma, TypeScript marca error aquí hasta
  //                       que decidas sus transiciones. Imposible olvidarlo.
  Partial<Record<AppointmentStatus, readonly AppointmentActor[]>>
>;

export function canTransition(from: AppointmentStatus, to: AppointmentStatus, actor: AppointmentActor) {
  const allowed: Partial<Record<AppointmentStatus, readonly AppointmentActor[]>> = appointmentTransitions[from];
  return allowed[to]?.includes(actor) ?? false;
}

// ¿Qué puede hacer este actor desde este estado? → los botones de la UI.
export function availableTransitions(from: AppointmentStatus, actor: AppointmentActor) {
  const allowed: Partial<Record<AppointmentStatus, readonly AppointmentActor[]>> = appointmentTransitions[from];
  return (Object.keys(allowed) as AppointmentStatus[]).filter((to) => allowed[to]?.includes(actor));
}
