// TESTS DEL CUESTIONARIO GUIADO: urgencia por reglas, validación y resumen para el vet.
import { describe, expect, it } from "vitest";
import {
  buildQuestionnaireSummary,
  CHOICE_QUESTION_IDS,
  CHOICE_QUESTIONS,
  type QuestionnaireAnswers,
  QuestionnaireSchema,
  questionnaireFreeTexts,
  questionnaireUrgency,
} from "./questionnaire";

// Respuestas "todo normal". Cada test cambia SOLO lo que le interesa: así se lee qué provoca qué.
const NORMAL = {
  mainSymptom: "Estornuda un poco",
  since: "TODAY",
  evolution: "SAME",
  appetite: "NORMAL",
  water: "NORMAL",
  vomiting: "NO",
  diarrhea: "NO",
  energy: "NORMAL",
  urination: "NORMAL",
  ingestion: "NO",
};

// Pasamos por el schema real, igual que el servidor: los tests usan datos ya validados.
const answers = (overrides: Record<string, string> = {}): QuestionnaireAnswers =>
  QuestionnaireSchema.parse({ ...NORMAL, ...overrides });

describe("questionnaireUrgency", () => {
  it("todo normal → LOW", () => {
    expect(questionnaireUrgency(answers())).toBe("LOW");
  });

  it("una respuesta leve → MEDIUM", () => {
    expect(questionnaireUrgency(answers({ appetite: "LESS" }))).toBe("MEDIUM");
  });

  it("tres respuestas leves a la vez → HIGH", () => {
    expect(questionnaireUrgency(answers({ appetite: "LESS", diarrhea: "YES", energy: "LOW" }))).toBe("HIGH");
  });

  it("una respuesta preocupante → HIGH", () => {
    expect(questionnaireUrgency(answers({ evolution: "WORSE" }))).toBe("HIGH");
  });

  // Test DERIVADO DE LOS DATOS: recorre todas las opciones de peso 3. Si mañana alguien agrega
  // una opción de emergencia nueva, queda cubierta sin escribir otro test.
  const emergencyOptions = CHOICE_QUESTION_IDS.flatMap((id) =>
    Object.entries(CHOICE_QUESTIONS[id].options)
      .filter(([, option]) => option.weight === 3)
      .map(([value]) => [id, value] as const),
  );

  it.each(emergencyOptions)("%s = %s → EMERGENCY", (id, value) => {
    const overrides: Record<string, string> = { [id]: value };
    if (id === "ingestion") overrides.ingestionDetail = "chocolate"; // Lo exige la regla entre campos
    expect(questionnaireUrgency(answers(overrides))).toBe("EMERGENCY");
  });
});

describe("QuestionnaireSchema", () => {
  it("si dijo que SÍ comió algo, exige indicar qué", () => {
    const result = QuestionnaireSchema.safeParse({ ...NORMAL, ingestion: "YES" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["ingestionDetail"]);
  });

  it("rechaza una opción que no existe (FormData manipulado)", () => {
    expect(QuestionnaireSchema.safeParse({ ...NORMAL, energy: "SUPER" }).success).toBe(false);
  });

  it("los textos vacíos o ausentes se guardan como null", () => {
    const parsed = answers({ medication: "   " });
    expect(parsed.medication).toBeNull();
    expect(parsed.notes).toBeNull();
  });
});

describe("questionnaireFreeTexts", () => {
  it("devuelve solo los textos que el dueño escribió", () => {
    expect(questionnaireFreeTexts(answers({ notes: "Es muy nervioso" }))).toEqual([
      "Estornuda un poco",
      "Es muy nervioso",
    ]);
  });
});

describe("buildQuestionnaireSummary", () => {
  it("si todo es normal lo dice en una línea (sin ruido para el vet)", () => {
    const { summary, symptoms } = buildQuestionnaireSummary(answers());
    expect(summary).toContain("Sin otros hallazgos");
    expect(symptoms).toEqual([]);
  });

  it("lista solo los hallazgos fuera de lo normal", () => {
    const { symptoms } = buildQuestionnaireSummary(answers({ appetite: "NONE", since: "OVER_WEEK" }));
    expect(symptoms).toEqual(["apetito: no come nada"]); // La duración no es un síntoma
  });

  it("recorta el motivo largo a 78 caracteres para la agenda", () => {
    const { chiefComplaint } = buildQuestionnaireSummary(answers({ mainSymptom: "a".repeat(120) }));
    expect(chiefComplaint).toHaveLength(78);
    expect(chiefComplaint.endsWith("…")).toBe(true);
  });
});
