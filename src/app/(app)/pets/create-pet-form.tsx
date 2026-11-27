"use client"; // Necesita estado (errores, pending) → Client Component

import { useActionState, useState } from "react";
import { idleState } from "@/lib/action-state";
import { createPetAction, type CreatePetState } from "./actions";
import { sexLabels, speciesLabels } from "./labels";
import { buttonClass } from "@/lib/ui";

const initialState: CreatePetState = idleState;

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function CreatePetForm() {
  // state = lo último que devolvió la action · formAction = lo que va en <form action> · pending = enviando
  const [state, formAction, pending] = useActionState(createPetAction, initialState);

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  // React resetea el formulario al terminar cada action. Para no borrarle los datos al usuario
  // cuando hay error, volvemos a MONTAR el <form> con cada respuesta (key nueva): así todos los
  // campos, incluidos los <select>, arrancan desde su defaultValue = lo que el usuario envió.
  // (Un <select> ya montado ignora los cambios de defaultValue; por eso no basta con re-renderizar.)
  // Patrón "ajustar estado durante el render" cuando cambia una prop/valor: sin useEffect.
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setFormKey(formKey + 1);
  }

  return (
    <form key={formKey} action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Nombre *" name="name" errors={errors?.name}>
        <input id="name" name="name" defaultValue={values?.name} className={inputClass} />
      </Field>

      <Field label="Especie *" name="species" errors={errors?.species}>
        <select id="species" name="species" defaultValue={values?.species ?? ""} className={inputClass}>
          <option value="" disabled>
            Selecciona…
          </option>
          {Object.entries(speciesLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Raza" name="breed" errors={errors?.breed}>
        <input id="breed" name="breed" defaultValue={values?.breed} className={inputClass} />
      </Field>

      <Field label="Sexo" name="sex" errors={errors?.sex}>
        <select id="sex" name="sex" defaultValue={values?.sex ?? "UNKNOWN"} className={inputClass}>
          {Object.entries(sexLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Fecha de nacimiento" name="birthDate" errors={errors?.birthDate}>
        <input id="birthDate" name="birthDate" type="date" defaultValue={values?.birthDate} className={inputClass} />
      </Field>

      <Field label="Peso (kg)" name="weightKg" errors={errors?.weightKg}>
        <input
          id="weightKg"
          name="weightKg"
          inputMode="decimal"
          placeholder="12.5"
          defaultValue={values?.weightKg}
          className={inputClass}
        />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Notas (alergias, antecedentes…)" name="notes" errors={errors?.notes}>
          <textarea id="notes" name="notes" rows={3} defaultValue={values?.notes} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass()}
        >
          {pending ? "Guardando…" : "Registrar mascota"}
        </button>

        {/* aria-live: los lectores de pantalla anuncian el mensaje cuando cambia */}
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
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
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
