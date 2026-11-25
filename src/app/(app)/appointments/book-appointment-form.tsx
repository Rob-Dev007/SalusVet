"use client";

import { useActionState, useState } from "react";
import { CLINIC_SLOTS } from "@/lib/clinic-time";
import { idleState } from "@/lib/action-state";
import { type BookAppointmentState, bookAppointmentAction } from "./actions";
import { buttonClass } from "@/lib/ui";

const initialState: BookAppointmentState = idleState;

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

type Option = { id: string; name: string };

export function BookAppointmentForm({ pets, vets }: { pets: Option[]; vets: Option[] }) {
  const [state, formAction, pending] = useActionState(bookAppointmentAction, initialState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  // Mismo patrón que el formulario de mascotas: remontar el form con cada respuesta para que los
  // <select> recuperen lo que eligió el usuario si hubo error.
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setFormKey(formKey + 1);
  }

  return (
    <form key={formKey} action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Mascota *" htmlFor="petId" errors={errors?.petId}>
        <select id="petId" name="petId" defaultValue={values?.petId ?? ""} className={inputClass}>
          <option value="" disabled>
            Selecciona…
          </option>
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Veterinario *" htmlFor="vetId" errors={errors?.vetId}>
        <select id="vetId" name="vetId" defaultValue={values?.vetId ?? ""} className={inputClass}>
          <option value="" disabled>
            Selecciona…
          </option>
          {vets.map((vet) => (
            <option key={vet.id} value={vet.id}>
              {vet.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Fecha y turno por separado. Antes era un <input type="datetime-local" step={1800}>, pero
          `step` es solo una SUGERENCIA: el navegador deja escribir 16:10 y el error llegaba recién al
          enviar. Con una lista de turnos, la hora inválida directamente no se puede elegir.
          (El servidor sigue validando igual: un formulario se puede falsificar.) */}
      {/* Ocupa la fila completa y usa las MISMAS dos columnas que el form: la fecha queda bajo
          "Mascota" y el turno bajo "Veterinario", alineados. */}
      <fieldset className="flex flex-col gap-1 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Fecha y turno (hora de la clínica) *</legend>
        <div className="grid grid-cols-2 gap-4">
          <label htmlFor="date" className="sr-only">
            Fecha
          </label>
          <input id="date" name="date" type="date" defaultValue={values?.date} className={inputClass} />
          <label htmlFor="time" className="sr-only">
            Turno
          </label>
          <select id="time" name="time" defaultValue={values?.time ?? ""} className={inputClass}>
            <option value="" disabled>
              Turno…
            </option>
            {CLINIC_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
        {errors?.scheduledAt?.map((message) => (
          <p key={message} className="text-xs text-danger">
            {message}
          </p>
        ))}
      </fieldset>

      <div className="sm:col-span-2">
        <Field label="Motivo de la consulta *" htmlFor="reason" errors={errors?.reason}>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            placeholder="Ej. Vómitos desde ayer, no quiere comer"
            defaultValue={values?.reason}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass()}
        >
          {pending ? "Agendando…" : "Solicitar cita"}
        </button>
        <p
          aria-live="polite"
          className={`text-sm ${state.status === "error" ? "text-danger" : "text-brand"}`}
        >
          {state.status !== "idle" && state.message}
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  errors,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {errors?.map((message) => (
        <p key={message} className="text-xs text-danger">
          {message}
        </p>
      ))}
    </div>
  );
}
