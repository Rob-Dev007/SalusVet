"use client";

import { useActionState } from "react";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { buttonClass } from "@/lib/ui";
import { type AppointmentActor, availableTransitions } from "@/domain/appointment-transitions";
import { idleState } from "@/lib/action-state";
import { type ChangeStatusState, changeAppointmentStatusAction } from "./actions";
import { transitionLabels } from "./labels";

const initialState: ChangeStatusState = idleState;

const DESTRUCTIVE = new Set<AppointmentStatus>(["CANCELLED", "NO_SHOW"]);
const confirmMessages: Partial<Record<AppointmentStatus, string>> = {
  CANCELLED: "¿Seguro que quieres cancelar esta cita? Se liberará el turno.",
  NO_SHOW: "¿Marcar que la mascota no se presentó a la cita?",
};

// Los botones salen de la MISMA tabla de transiciones que usa el servidor para autorizar.
// Ocultarlos es comodidad; si alguien fuerza la petición, el servicio la rechaza igual.
export function StatusButtons({
  appointmentId,
  status,
  actor,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  actor: AppointmentActor;
}) {
  const [state, formAction, pending] = useActionState(changeAppointmentStatusAction, initialState);
  const transitions = availableTransitions(status, actor);
  if (transitions.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      {transitions.map((to) => (
        // Varios botones submit en un form: FormData incluye el name/value del que se pulsó
        <button
          key={to}
          type="submit"
          name="to"
          value={to}
          disabled={pending}
          onClick={(event) => {
            // Cancelar o marcar "no se presentó" no se deshace con un clic: pedimos confirmación.
            // (onClick y no onSubmit: así sabemos QUÉ botón se pulsó.)
            if (DESTRUCTIVE.has(to) && !window.confirm(confirmMessages[to])) event.preventDefault();
          }}
          className={buttonClass(to === "CANCELLED" ? "danger" : to === "NO_SHOW" ? "secondary" : "primary", "sm")}
        >
          {pending ? "…" : transitionLabels[to]}
        </button>
      ))}
      {state.status === "error" && (
        <p aria-live="polite" className="text-xs text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
