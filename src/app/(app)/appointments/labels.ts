import type { AppointmentStatus } from "@/generated/prisma/enums";

export const statusLabels: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  ATTENDED: "Atendida",
  NO_SHOW: "No se presentó",
};

// Texto del BOTÓN que lleva a cada estado (la acción, no el estado).
export const transitionLabels: Record<AppointmentStatus, string> = {
  PENDING: "Reabrir",
  CONFIRMED: "Confirmar",
  CANCELLED: "Cancelar",
  ATTENDED: "Marcar atendida",
  NO_SHOW: "No se presentó",
};

export const statusBadgeClass: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CONFIRMED: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  CANCELLED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  ATTENDED: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  NO_SHOW: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
