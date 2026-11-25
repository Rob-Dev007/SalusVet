"use client";

import { useActionState, useState } from "react";
import { idleState } from "@/lib/action-state";
import {
  addRedFlagAction,
  approveDeactivationAction,
  cancelDeactivationAction,
  lockRedFlagAction,
  type RedFlagState,
  requestDeactivationAction,
} from "./actions";

const initialState: RedFlagState = idleState;

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AddRedFlagForm() {
  const [state, formAction, pending] = useActionState(addRedFlagAction, initialState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  // Mismo patrón de las otras fases: remontar el form con cada respuesta. Si hubo error recupera
  // lo escrito; si salió bien, queda vacío para añadir la siguiente.
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setFormKey(formKey + 1);
  }

  return (
    <form key={formKey} action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="phrase" className="text-sm font-medium">
          Palabra o frase *
        </label>
        <input id="phrase" name="phrase" placeholder="paracetamol" defaultValue={values?.phrase} className={inputClass} />
        <p className="text-xs text-muted">Se busca como palabra completa, sin importar mayúsculas ni tildes.</p>
        {errors?.phrase?.map((message) => (
          <p key={message} className="text-xs text-danger">
            {message}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="label" className="text-sm font-medium">
          Qué indica *
        </label>
        <input id="label" name="label" placeholder="Ingesta de paracetamol" defaultValue={values?.label} className={inputClass} />
        <p className="text-xs text-muted">Aparece en el resumen de la pre-consulta.</p>
        {errors?.label?.map((message) => (
          <p key={message} className="text-xs text-danger">
            {message}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Añadir alerta"}
        </button>
        <p aria-live="polite" className={`text-sm ${state.status === "error" ? "text-danger" : "text-brand"}`}>
          {state.status !== "idle" && state.message}
        </p>
      </div>
    </form>
  );
}

const smallButton = "rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface disabled:opacity-60";

// PASO 1 de la baja: pedirla con un motivo. <details> lo mantiene plegado hasta que hace falta,
// sin JavaScript extra.
export function RequestDeactivationForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(requestDeactivationAction, initialState);
  const values = state.status === "error" ? state.values : undefined;
  const reasonErrors = state.status === "error" ? state.fieldErrors?.reason : undefined;
  return (
    <details className="w-full text-sm sm:w-auto">
      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">Solicitar baja</summary>
      <form action={formAction} className="mt-2 flex flex-col gap-2 sm:w-72" noValidate>
        <input type="hidden" name="id" value={id} />
        <label htmlFor={`reason-${id}`} className="text-xs font-medium">
          Motivo (lo verá quien apruebe)
        </label>
        <textarea
          id={`reason-${id}`}
          name="reason"
          rows={2}
          maxLength={300}
          defaultValue={values?.reason}
          placeholder="Ej.: da falsos positivos con «paracetamol infantil recetado»"
          className={inputClass}
        />
        {reasonErrors?.map((message) => (
          <p key={message} className="text-xs text-danger">
            {message}
          </p>
        ))}
        <p className="text-xs text-muted">La alerta seguirá activa hasta que otra persona del equipo apruebe.</p>
        <button type="submit" disabled={pending} className={`${smallButton} self-start`}>
          {pending ? "Enviando…" : "Enviar solicitud"}
        </button>
        {state.status === "error" && !reasonErrors && <p className="text-xs text-danger">{state.message}</p>}
      </form>
    </details>
  );
}

// Botón de un clic para las acciones que solo necesitan el id. `confirmText` pide confirmación
// para las que tienen consecuencias (aprobar una baja, proteger).
function FlagActionButton({
  id,
  action,
  label,
  confirmText,
  primary = false,
}: {
  id: string;
  action: (prev: RedFlagState, formData: FormData) => Promise<RedFlagState>;
  label: string;
  confirmText?: string;
  primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={primary ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60" : smallButton}
      >
        {pending ? "…" : label}
      </button>
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}
    </form>
  );
}

// PASO 2: otra persona aprueba. (Si quien pidió la baja intentara aprobar, el servidor lo rechaza;
// la UI ni siquiera le muestra el botón, pero la UI NO es la que protege.)
export function ApproveDeactivationButton({ id, phrase }: { id: string; phrase: string }) {
  return (
    <FlagActionButton
      id={id}
      action={approveDeactivationAction}
      label="Aprobar baja"
      primary
      confirmText={`¿Aprobar la baja de "${phrase}"? Desde ahora el triaje dejará de detectarla. Quedará registrado.`}
    />
  );
}

export function CancelDeactivationButton({ id, mine }: { id: string; mine: boolean }) {
  return <FlagActionButton id={id} action={cancelDeactivationAction} label={mine ? "Retirar solicitud" : "Rechazar"} />;
}

export function LockButton({ id, phrase }: { id: string; phrase: string }) {
  return (
    <FlagActionButton
      id={id}
      action={lockRedFlagAction}
      label="🔒 Proteger"
      confirmText={`¿Proteger "${phrase}"? Nadie podrá desactivarla desde la aplicación, tampoco tú. Solo se revierte con un cambio técnico.`}
    />
  );
}
