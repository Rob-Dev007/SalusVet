// TESTS DE LA HORA DE LA CLÍNICA. Las fechas son la fuente clásica de bugs: zonas horarias,
// medianoche, turnos que la UI ofrece y la validación rechaza (el error de las 16:10).
import { describe, expect, it } from "vitest";
import { CLINIC_SLOTS, isBookableSlot, parseClinicDateTime, startOfClinicDay } from "./clinic-time";

describe("CLINIC_SLOTS", () => {
  it("va de 08:00 a 17:30 cada 30 minutos", () => {
    expect(CLINIC_SLOTS[0]).toBe("08:00");
    expect(CLINIC_SLOTS.at(-1)).toBe("17:30");
    expect(CLINIC_SLOTS).toHaveLength(20);
  });

  // Test de CONSISTENCIA: todo turno que el formulario ofrece, la validación del servidor lo
  // acepta. Si alguien cambia uno y no el otro, el dueño vería un turno que luego da error.
  it.each(CLINIC_SLOTS)("el turno %s que ofrece el formulario es reservable", (slot) => {
    const date = parseClinicDateTime(`2026-11-27T${slot}`);
    expect(date).not.toBeNull();
    expect(isBookableSlot(date!)).toBe(true);
  });
});

describe("parseClinicDateTime", () => {
  it("interpreta la hora como hora de Ecuador (UTC−5), no del servidor", () => {
    expect(parseClinicDateTime("2026-11-27T16:00")?.toISOString()).toBe("2026-11-27T21:00:00.000Z");
  });

  it.each(["", "2026-11-27", "27/11/2026 16:00", "2026-11-27T16:00:00Z"])("rechaza «%s»", (value) => {
    expect(parseClinicDateTime(value)).toBeNull();
  });
});

describe("isBookableSlot", () => {
  it.each([
    ["16:10", false], // Fuera de la media hora
    ["07:30", false], // Antes de abrir
    ["18:00", false], // Ya cerró
  ])("%s → %s", (time, expected) => {
    expect(isBookableSlot(parseClinicDateTime(`2026-11-27T${time}`)!)).toBe(expected);
  });
});

describe("startOfClinicDay", () => {
  it("usa la medianoche de la clínica, no la de UTC", () => {
    // 03:00 UTC del 26 = 22:00 del 25 en Loja → el "hoy" de la clínica todavía es el 25.
    expect(startOfClinicDay(new Date("2026-11-26T03:00:00Z")).toISOString()).toBe("2026-11-25T05:00:00.000Z");
  });
});
