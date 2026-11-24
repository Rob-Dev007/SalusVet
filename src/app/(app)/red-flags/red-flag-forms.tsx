"use client";

import { useActionState, useState } from "react";
import { idleState } from "@/server/shared/action-state";
import { addRedFlagAction, deactivateRedFlagAction, type RedFlagState } from "./actions";

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

export function DeactivateButton({ id, phrase }: { id: string; phrase: string }) {
  const [state, formAction, pending] = useActionState(deactivateRedFlagAction, initialState);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // Confirmación: desactivar una alerta hace el triaje menos estricto.
        if (!window.confirm(`¿Desactivar la alerta "${phrase}"? Quedará registrado quién lo hizo.`)) {
          event.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface disabled:opacity-60"
      >
        {pending ? "…" : "Desactivar"}
      </button>
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}
    </form>
  );
}
