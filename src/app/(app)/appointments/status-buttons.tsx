"use client";

import { useActionState } from "react";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { type AppointmentActor, availableTransitions } from "@/domain/appointment-transitions";
import { idleState } from "@/lib/action-state";
import { type ChangeStatusState, changeAppointmentStatusAction } from "./actions";
import { transitionLabels } from "./labels";

const initialState: ChangeStatusState = idleState;

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
          className={
            to === "CANCELLED" || to === "NO_SHOW"
              ? "rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface disabled:opacity-60"
              : "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          }
        >
          {transitionLabels[to]}
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
