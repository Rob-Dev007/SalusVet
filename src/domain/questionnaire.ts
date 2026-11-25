// CUESTIONARIO GUIADO DE PRE-CONSULTA (sin IA, costo $0).
//
// Idea clave: el cuestionario es DATOS, no JSX. Las preguntas viven en un objeto declarativo
// (igual que la tabla de transiciones de las citas); de aquí salen:
//   · el formulario que ve el dueño (se genera recorriendo QUESTIONS),
//   · el schema Zod que valida en el servidor,
//   · el resumen y la urgencia que calcula el código.
// Añadir una pregunta = añadir una entrada aquí. No hay tres lugares que mantener sincronizados.
//
// Sin "server-only": el formulario (cliente) también lo importa para pintar las preguntas.
// No contiene secretos ni acceso a la BD.
import { z } from "zod";
import type { UrgencyLevel } from "@/generated/prisma/enums";

// Versión del cuestionario. Se guarda con cada pre-consulta (columna aiModel, ver el servicio):
// si mañana cambian las preguntas, sabremos con qué versión se respondió cada una.
export const QUESTIONNAIRE_VERSION = "questionnaire-v1";

// Cada opción lleva su texto y su "peso" clínico. El peso lo usan las reglas de urgencia:
//   0 = normal · 1 = leve · 2 = preocupante · 3 = señal de emergencia
type Option = { label: string; weight: 0 | 1 | 2 | 3 };

export const CHOICE_QUESTIONS = {
  since: {
    short: "Duración", // Nombre corto para el resumen del vet
    question: "¿Desde cuándo ocurre?",
    options: {
      TODAY: { label: "Hoy", weight: 0 },
      DAYS_1_2: { label: "1 a 2 días", weight: 0 },
      DAYS_3_7: { label: "3 a 7 días", weight: 1 },
      OVER_WEEK: { label: "Más de una semana", weight: 1 },
    },
  },
  evolution: {
    short: "Evolución",
    question: "¿Cómo ha evolucionado?",
    options: {
      BETTER: { label: "Va mejorando", weight: 0 },
      SAME: { label: "Sigue igual", weight: 0 },
      WORSE: { label: "Está empeorando", weight: 2 },
    },
  },
  appetite: {
    short: "Apetito",
    question: "¿Cómo está comiendo?",
    options: {
      NORMAL: { label: "Normal", weight: 0 },
      LESS: { label: "Come menos", weight: 1 },
      NONE: { label: "No come nada", weight: 2 },
    },
  },
  water: {
    short: "Agua",
    question: "¿Y el agua?",
    options: {
      NORMAL: { label: "Normal", weight: 0 },
      MORE: { label: "Toma más que de costumbre", weight: 1 },
      LESS: { label: "Toma menos o nada", weight: 2 },
    },
  },
  vomiting: {
    short: "Vómitos",
    question: "¿Ha vomitado?",
    options: {
      NO: { label: "No", weight: 0 },
      ONCE: { label: "Una vez", weight: 1 },
      SEVERAL: { label: "Varias veces", weight: 2 },
      BLOOD: { label: "Sí, con sangre", weight: 3 },
    },
  },
  diarrhea: {
    short: "Diarrea",
    question: "¿Tiene diarrea?",
    options: {
      NO: { label: "No", weight: 0 },
      YES: { label: "Sí", weight: 1 },
      BLOOD: { label: "Sí, con sangre", weight: 3 },
    },
  },
  energy: {
    short: "Energía",
    question: "¿Cómo está de energía?",
    options: {
      NORMAL: { label: "Normal, juega como siempre", weight: 0 },
      LOW: { label: "Decaído", weight: 1 },
      COLLAPSED: { label: "No se levanta o casi no reacciona", weight: 3 },
    },
  },
  urination: {
    short: "Orina",
    question: "¿Cómo orina?",
    options: {
      NORMAL: { label: "Normal", weight: 0 },
      FREQUENT: { label: "Más seguido de lo normal", weight: 1 },
      UNABLE: { label: "Hace fuerza pero no le sale, o no orina", weight: 3 },
    },
  },
  ingestion: {
    short: "Posible ingesta",
    question: "¿Pudo haber comido algo extraño o tóxico? (chocolate, medicinas, veneno, plantas, huesos…)",
    options: {
      NO: { label: "No", weight: 0 },
      UNSURE: { label: "No estoy seguro", weight: 1 },
      YES: { label: "Sí", weight: 3 },
    },
  },
} as const satisfies Record<string, { short: string; question: string; options: Record<string, Option> }>;

export type ChoiceQuestionId = keyof typeof CHOICE_QUESTIONS;
export const CHOICE_QUESTION_IDS = Object.keys(CHOICE_QUESTIONS) as ChoiceQuestionId[];

// Un z.enum por pregunta, construido desde las claves de sus opciones: si añades una opción
// arriba, el schema la acepta automáticamente. Lo que no esté en la lista, Zod lo rechaza.
const choice = <Q extends ChoiceQuestionId>(id: Q) =>
  z.enum(Object.keys(CHOICE_QUESTIONS[id].options) as [keyof (typeof CHOICE_QUESTIONS)[Q]["options"] & string], {
    error: "Elige una opción",
  });

// .optional(): un campo que NO se pintó (ej. "¿qué comió?" cuando respondió "No") ni siquiera
// viaja en el FormData → llega undefined. Vacío y ausente significan lo mismo: "no respondió".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres` })
    .optional()
    .transform((value) => value || null); // "" o undefined → null: en la BD "no respondió" es null

export const QuestionnaireSchema = z
  .object({
    mainSymptom: z
      .string()
      .trim()
      .min(3, { error: "Cuéntanos brevemente qué le pasa" })
      .max(500, { error: "Máximo 500 caracteres" }),
    since: choice("since"),
    evolution: choice("evolution"),
    appetite: choice("appetite"),
    water: choice("water"),
    vomiting: choice("vomiting"),
    diarrhea: choice("diarrhea"),
    energy: choice("energy"),
    urination: choice("urination"),
    ingestion: choice("ingestion"),
    ingestionDetail: optionalText(300),
    medication: optionalText(300),
    notes: optionalText(500),
  })
  // Regla entre campos: si dijo que SÍ comió algo, necesitamos saber qué.
  .refine((data) => data.ingestion !== "YES" || data.ingestionDetail, {
    error: "Indica qué comió (aunque sea aproximado)",
    path: ["ingestionDetail"],
  });

export type QuestionnaireAnswers = z.infer<typeof QuestionnaireSchema>;

// Textos libres del dueño: los únicos que revisa el triaje por palabras (las opciones ya traen peso).
export function questionnaireFreeTexts(answers: QuestionnaireAnswers) {
  return [answers.mainSymptom, answers.ingestionDetail, answers.medication, answers.notes].filter(
    (text): text is string => Boolean(text),
  );
}

const optionOf = (id: ChoiceQuestionId, answers: QuestionnaireAnswers): Option =>
  (CHOICE_QUESTIONS[id].options as Record<string, Option>)[answers[id]];

// URGENCIA POR REGLAS (determinista, auditable, testeable):
//   · Cualquier respuesta de peso 3 → EMERGENCY
//   · Alguna de peso 2, o 3+ respuestas leves a la vez → HIGH
//   · Alguna leve → MEDIUM
//   · Todo normal → LOW
// El servicio luego aplica resolveUrgency con las palabras de alarma de los textos libres.
export function questionnaireUrgency(answers: QuestionnaireAnswers): UrgencyLevel {
  const weights = CHOICE_QUESTION_IDS.map((id) => optionOf(id, answers).weight);
  if (weights.includes(3)) return "EMERGENCY";
  if (weights.includes(2) || weights.filter((w) => w === 1).length >= 3) return "HIGH";
  if (weights.includes(1)) return "MEDIUM";
  return "LOW";
}

// RESUMEN para el vet, armado por código: frases cortas solo con lo que NO es normal
// (lo normal es ruido para quien lee 20 resúmenes al día).
export function buildQuestionnaireSummary(answers: QuestionnaireAnswers) {
  // Hallazgos = respuestas con peso > 0, sin contar duración y evolución (no son síntomas).
  const findings = CHOICE_QUESTION_IDS.filter(
    (id) => id !== "since" && id !== "evolution" && optionOf(id, answers).weight > 0,
  ).map((id) => ({ short: CHOICE_QUESTIONS[id].short, label: optionOf(id, answers).label.toLowerCase() }));

  const lines = [
    `Motivo: ${answers.mainSymptom}`,
    `Desde: ${optionOf("since", answers).label.toLowerCase()} · ${optionOf("evolution", answers).label.toLowerCase()}.`,
    findings.length > 0
      ? `Hallazgos: ${findings.map((f) => `${f.short}: ${f.label}`).join("; ")}.`
      : "Sin otros hallazgos: apetito, agua, digestión, energía y orina normales.",
    answers.ingestionDetail && `Posible ingesta: ${answers.ingestionDetail}.`,
    answers.medication && `Medicación actual: ${answers.medication}.`,
    answers.notes && `Notas del dueño: ${answers.notes}`,
  ].filter(Boolean);

  return {
    // El "titular" en la agenda del vet: el síntoma principal, cortado si es largo.
    chiefComplaint: answers.mainSymptom.length > 80 ? `${answers.mainSymptom.slice(0, 77)}…` : answers.mainSymptom,
    summary: lines.join("\n"),
    symptoms: findings.map((f) => `${f.short.toLowerCase()}: ${f.label}`),
  };
}
