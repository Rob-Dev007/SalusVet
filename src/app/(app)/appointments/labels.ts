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

// Insignias: cada estado conserva su "semáforo" (ámbar = espera, azul marca = confirmada...)
// con variantes oscuras explícitas. "dark:" responde al tema elegido (ver globals.css).
export const statusBadgeClass: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  CONFIRMED: "bg-accent text-accent-foreground",
  CANCELLED: "bg-surface text-muted ring-1 ring-border",
  ATTENDED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  NO_SHOW: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
};
