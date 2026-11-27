// TESTS DEL TRIAJE: la red de seguridad que no depende de la IA.
//
// Por qué importan tanto: si alguien rompe un patrón, el código NO lanza ningún error. Solo deja
// de detectar una emergencia (fallo silencioso). Estos tests fijan por escrito lo que el triaje
// DEBE detectar, con las frases que escribiría un dueño real, para que un cambio que lo rompa
// falle aquí y no en la clínica.
import { describe, expect, it } from "vitest";
import { detectRedFlags, normalize, resolveUrgency } from "./triage";

describe("normalize", () => {
  it("quita tildes, pasa a minúsculas y colapsa espacios", () => {
    expect(normalize("  Está TEMBLANDO y comió   Chocolate ")).toBe("esta temblando y comio chocolate");
  });

  it("también quita diéresis y la tilde de la ñ (n + marca)", () => {
    expect(normalize("Pingüino ÑANDÚ")).toBe("pinguino nandu");
  });
});

describe("detectRedFlags: lista base", () => {
  // it.each: un test por frase. Si falla, el reporte dice EXACTAMENTE qué frase dejó de detectarse.
  it.each([
    ["convulsiona", "Convulsiones"],
    ["está convulsionando", "Convulsiones"],
    ["tuvo una CONVULSIÓN", "Convulsiones"],
    ["le dio un ataque epiléptico", "Convulsiones"],
    ["se comió una barra de chocolate", "Posible intoxicación (chocolate, xilitol, uvas, cebolla)"],
    ["comió uvas", "Posible intoxicación (chocolate, xilitol, uvas, cebolla)"],
    ["creo que se envenenó", "Posible envenenamiento"],
    ["lamió raticida", "Posible envenenamiento"],
    ["no puede respirar", "Dificultad para respirar"],
    ["tiene las encías azules", "Dificultad para respirar"],
    ["vomita sangre", "Sangrado abundante"],
    ["lo atropelló un carro", "Traumatismo grave"],
    ["se desmayó", "Pérdida de conciencia"],
    ["tiene la barriga hinchada", "Abdomen distendido / torsión gástrica"],
    ["no puede orinar desde ayer", "No orina"],
    ["creo que es un golpe de calor", "Golpe de calor"],
    ["está pariendo hace 3 horas y no sale", "Parto complicado"],
  ])("«%s» → %s", (text, label) => {
    expect(detectRedFlags([text])).toContain(label);
  });

  // Igual de importante: NO alarmar de más. Un triaje que marca todo como emergencia
  // es un triaje que nadie toma en serio.
  it.each(["estornuda un poco", "tiene una pulga", "está comiendo menos", "le gusta el chocolatero de la esquina"])(
    "«%s» no dispara alertas",
    (text) => {
      expect(detectRedFlags([text])).toEqual([]);
    },
  );

  it("revisa todos los textos del dueño, no solo el primero", () => {
    expect(detectRedFlags(["está decaído", "y luego convulsionó"])).toContain("Convulsiones");
  });

  it("no repite la misma alerta aunque aparezca varias veces", () => {
    expect(detectRedFlags(["comió chocolate", "y también uvas"])).toEqual([
      "Posible intoxicación (chocolate, xilitol, uvas, cebolla)",
    ]);
  });

  it("detecta varias alertas distintas a la vez", () => {
    const flags = detectRedFlags(["comió chocolate y ahora convulsiona"]);
    expect(flags).toHaveLength(2);
  });
});

describe("detectRedFlags: frases de la clínica", () => {
  const clinic = [{ label: "Ingesta de paracetamol", phrase: "paracetamol" }];

  it("suma las frases activas de la clínica a la lista base", () => {
    expect(detectRedFlags(["le di Paracetamol"], clinic)).toEqual(["Ingesta de paracetamol"]);
  });

  it("busca la frase como palabra completa", () => {
    expect(detectRedFlags(["paracetamoles"], clinic)).toEqual([]);
  });

  it("escapa los caracteres especiales: la frase se busca literal, nunca como regex", () => {
    const tricky = [{ label: "Truco", phrase: "a.b" }];
    expect(detectRedFlags(["axb"], tricky)).toEqual([]); // Sin escapar, "." aceptaría cualquier letra
    expect(detectRedFlags(["a.b"], tricky)).toEqual(["Truco"]);
  });

  it("no se rompe con una frase que sería una regex inválida", () => {
    expect(() => detectRedFlags(["texto"], [{ label: "X", phrase: "(((" }])).not.toThrow();
  });
});

describe("resolveUrgency: «la IA propone, el código dispone»", () => {
  it("sin alertas respeta la urgencia propuesta", () => {
    expect(resolveUrgency("MEDIUM", [])).toBe("MEDIUM");
  });

  it("con una alerta sube a EMERGENCY aunque la IA diga LOW", () => {
    expect(resolveUrgency("LOW", ["Convulsiones"])).toBe("EMERGENCY");
  });

  it("nunca baja lo que la IA subió", () => {
    expect(resolveUrgency("EMERGENCY", [])).toBe("EMERGENCY");
  });
});
