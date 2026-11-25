// TESTS DE formatAge: la edad que ve el dueño en la tarjeta de su mascota.
import { describe, expect, it } from "vitest";
import { formatAge } from "./labels";

// "Hoy" fijo: un test que depende del reloj real fallaría el año que viene.
const NOW = new Date("2026-11-25T12:00:00Z");

describe("formatAge", () => {
  it.each([
    ["2022-03-15", "4 años y 8 meses"],
    ["2025-11-25", "1 año"],
    ["2024-10-01", "2 años y 1 mes"],
    ["2026-10-25", "1 mes"],
    ["2026-05-10", "6 meses"],
    ["2025-11-26", "11 meses"], // Le falta un día para cumplir el año
    ["2026-11-01", "Menos de 1 mes"],
  ])("nacido el %s → %s", (birthDate, expected) => {
    expect(formatAge(new Date(birthDate), NOW)).toBe(expected);
  });
});
