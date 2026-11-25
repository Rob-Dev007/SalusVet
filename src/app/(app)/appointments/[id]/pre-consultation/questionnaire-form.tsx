"use client";

import { useActionState, useState } from "react";
import { CHOICE_QUESTION_IDS, CHOICE_QUESTIONS, type ChoiceQuestionId } from "@/domain/questionnaire";
import { idleState } from "@/lib/action-state";
import { type QuestionnaireState, submitQuestionnaireAction } from "./actions";

const initialState: QuestionnaireState = idleState;

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function QuestionnaireForm({ appointmentId, petName }: { appointmentId: string; petName: string }) {
  // .bind(null, appointmentId): fija el primer argumento de la acción. useActionState añade los
  // otros dos (estado previo y FormData).
  const [state, formAction, pending] = useActionState(
    submitQuestionnaireAction.bind(null, appointmentId),
    initialState,
  );
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  // Mostrar el campo "¿qué comió?" solo si respondió "Sí". Estado de UI: el servidor valida
  // igual la regla (refine en el schema), aunque alguien manipule el formulario.
  const [ingestion, setIngestion] = useState(values?.ingestion ?? "");

  // Mismo patrón de remontar el form con cada respuesta, para recuperar lo marcado si hubo error.
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setFormKey(formKey + 1);
    setIngestion(state.status === "error" ? (state.values?.ingestion ?? "") : "");
  }

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-6" noValidate>
      <p className="text-sm text-muted">
        Responde estas preguntas sobre {petName}. Toma 2 minutos y el veterinario llegará preparado a la consulta.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="mainSymptom" className="text-sm font-medium">
          ¿Qué le pasa a {petName}? *
        </label>
        <textarea
          id="mainSymptom"
          name="mainSymptom"
          rows={3}
          maxLength={500}
          placeholder="Ej. Vomita después de comer y está decaído"
          defaultValue={values?.mainSymptom}
          className={inputClass}
        />
        <FieldErrors errors={errors?.mainSymptom} />
      </div>

      {/* Las preguntas de opción salen del objeto CHOICE_QUESTIONS: el formulario se GENERA. */}
      {CHOICE_QUESTION_IDS.map((id) => (
        <ChoiceQuestion
          key={id}
          id={id}
          defaultValue={values?.[id]}
          errors={errors?.[id]}
          onChange={id === "ingestion" ? setIngestion : undefined}
        />
      ))}

      {ingestion === "YES" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="ingestionDetail" className="text-sm font-medium">
            ¿Qué comió y cuándo? *
          </label>
          <input
            id="ingestionDetail"
            name="ingestionDetail"
            maxLength={300}
            placeholder="Ej. Una barra de chocolate, hace 1 hora"
            defaultValue={values?.ingestionDetail}
            className={inputClass}
          />
          <FieldErrors errors={errors?.ingestionDetail} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="medication" className="text-sm font-medium">
          ¿Toma algún medicamento? <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input id="medication" name="medication" maxLength={300} defaultValue={values?.medication} className={inputClass} />
        <FieldErrors errors={errors?.medication} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          ¿Algo más que deba saber el veterinario? <span className="font-normal text-muted">(opcional)</span>
        </label>
        <textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={values?.notes} className={inputClass} />
        <FieldErrors errors={errors?.notes} />
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar al veterinario"}
        </button>
        <p aria-live="polite" className={`text-sm ${state.status === "error" ? "text-danger" : "text-brand"}`}>
          {state.status !== "idle" && state.message}
        </p>
      </div>
    </form>
  );
}

// Una pregunta de opción única = un <fieldset> de radios. Es lo accesible: el lector de pantalla
// anuncia la pregunta (<legend>) y cada opción; en el celular, tocar es más fácil que un <select>.
function ChoiceQuestion({
  id,
  defaultValue,
  errors,
  onChange,
}: {
  id: ChoiceQuestionId;
  defaultValue?: string;
  errors?: string[];
  onChange?: (value: string) => void;
}) {
  const { question, options } = CHOICE_QUESTIONS[id];
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={errors ? true : undefined}>
      <legend className="mb-1 text-sm font-medium">{question} *</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([value, option]) => (
          // has-[:checked]: estiliza la "píldora" cuando su radio está marcado, sin JavaScript.
          <label
            key={value}
            className="cursor-pointer rounded-full px-3 py-1.5 text-sm ring-1 ring-border hover:bg-surface has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:ring-primary has-[:focus-visible]:ring-2"
          >
            <input
              type="radio"
              name={id}
              value={value}
              defaultChecked={defaultValue === value}
              onChange={onChange ? (e) => onChange(e.target.value) : undefined}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldErrors errors={errors} />
    </fieldset>
  );
}

function FieldErrors({ errors }: { errors?: string[] }) {
  return errors?.map((message) => (
    <p key={message} className="text-xs text-danger">
      {message}
    </p>
  ));
}
