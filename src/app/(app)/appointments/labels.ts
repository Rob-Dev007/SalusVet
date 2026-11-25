import type { AppointmentStatus, UrgencyLevel } from "@/generated/prisma/enums";

export const statusLabels: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  ATTENDED: "Atendida",
  NO_SHOW: "No se presentó",
};

// Explicación en palabras del DUEÑO: la insignia dice "Pendiente", pero ¿pendiente de qué?
// La frase responde la pregunta que se hace quien la lee: "¿y ahora qué pasa?".
export const statusDescriptions: Record<AppointmentStatus, string> = {
  PENDING: "Esperando que la clínica confirme tu cita.",
  CONFIRMED: "La clínica confirmó tu cita. ¡Te esperamos!",
  CANCELLED: "Esta cita fue cancelada.",
  ATTENDED: "Tu mascota ya fue atendida en esta cita.",
  NO_SHOW: "La cita se registró como no asistida.",
};

// Franja de color a la izquierda de cada tarjeta: el estado se reconoce de un vistazo.
export const statusAccentClass: Record<AppointmentStatus, string> = {
  PENDING: "border-l-amber-500",
  CONFIRMED: "border-l-primary",
  CANCELLED: "border-l-border",
  ATTENDED: "border-l-emerald-500",
  NO_SHOW: "border-l-red-500",
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

// Urgencia de la pre-consulta. EMERGENCY es la única insignia sólida: tiene que saltar a la vista.
export const urgencyLabels: Record<UrgencyLevel, string> = {
  LOW: "Rutina",
  MEDIUM: "Leve",
  HIGH: "Prioritaria",
  EMERGENCY: "Emergencia",
};

export const urgencyBadgeClass: Record<UrgencyLevel, string> = {
  LOW: "bg-surface text-muted ring-1 ring-border",
  MEDIUM: "bg-accent text-accent-foreground",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  EMERGENCY: "bg-red-700 text-white", // Rojo sólido con texto blanco: contraste > 6:1 en ambos temas
};
