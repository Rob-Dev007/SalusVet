// TESTS DE LA MÁQUINA DE ESTADOS DE LAS CITAS.
//
// En vez de probar casos sueltos, probamos TODAS las combinaciones (5 estados × 5 estados × 2
// actores = 50) contra una lista explícita de lo permitido. Si alguien agrega una transición por
// error (por ejemplo, que el dueño pueda marcarse "atendido"), este test falla.
import { describe, expect, it } from "vitest";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { type AppointmentActor, availableTransitions, canTransition } from "./appointment-transitions";

const STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "ATTENDED", "NO_SHOW"];
const ACTORS: AppointmentActor[] = ["OWNER", "VET"];

// La especificación, escrita a mano y a propósito DISTINTA de la tabla del código:
// si las dos coinciden, la tabla hace lo que decidimos.
const ALLOWED = new Set([
  "PENDING→CONFIRMED:VET",
  "PENDING→CANCELLED:OWNER",
  "PENDING→CANCELLED:VET",
  "CONFIRMED→ATTENDED:VET",
  "CONFIRMED→NO_SHOW:VET",
  "CONFIRMED→CANCELLED:OWNER",
  "CONFIRMED→CANCELLED:VET",
]);

const combinations = STATUSES.flatMap((from) =>
  STATUSES.flatMap((to) => ACTORS.map((actor) => [from, to, actor] as const)),
);

describe("canTransition", () => {
  it.each(combinations)("%s → %s por %s", (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(ALLOWED.has(`${from}→${to}:${actor}`));
  });
});

describe("availableTransitions (los botones de la UI)", () => {
  it("el dueño solo puede cancelar una cita pendiente", () => {
    expect(availableTransitions("PENDING", "OWNER")).toEqual(["CANCELLED"]);
  });

  it("el vet puede confirmar o cancelar una cita pendiente", () => {
    expect(availableTransitions("PENDING", "VET")).toEqual(["CONFIRMED", "CANCELLED"]);
  });

  it.each(["CANCELLED", "ATTENDED", "NO_SHOW"] as const)("%s es terminal: nadie puede cambiarla", (status) => {
    for (const actor of ACTORS) expect(availableTransitions(status, actor)).toEqual([]);
  });
});
