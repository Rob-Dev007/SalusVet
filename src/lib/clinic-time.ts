// HORA DE LA CLÍNICA. Regla de oro de las fechas:
//   · En la BD, SIEMPRE el instante exacto en UTC (columna Timestamptz).
//   · En la UI, SIEMPRE en la zona horaria de la clínica, no en la del servidor ni del navegador.
// El servidor de Vercel puede estar en Virginia y la BD en São Paulo: "las 10:00" solo tiene
// sentido si decimos "las 10:00 en la clínica".
//
// Sin "server-only": lo usan tanto el servidor (validar) como los componentes (mostrar).
import { TZDate } from "@date-fns/tz";

// Zona IANA de la clínica (SalusVet está en Loja, Ecuador). Un nombre IANA (no un offset fijo
// como "-05:00") sigue funcionando aunque el país adopte horario de verano en el futuro.
export const CLINIC_TIME_ZONE = "America/Guayaquil";

export const SLOT_MINUTES = 30; //   Turnos de 30 minutos: 08:00, 08:30, 09:00...
export const OPENING_HOUR = 8; //    Primer turno 08:00
export const CLOSING_HOUR = 18; //   Último turno 17:30

// "2026-11-24T10:30" (lo que envía <input type="datetime-local">, SIN zona) → instante UTC,
// interpretando esa hora como hora de la clínica.
export function parseClinicDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const local = new TZDate(year, month - 1, day, hour, minute, CLINIC_TIME_ZONE);
  return new Date(local.getTime());
}

// Hora y minuto de un instante, vistos desde la clínica.
export function clinicClock(date: Date) {
  const local = new TZDate(date, CLINIC_TIME_ZONE);
  return { hour: local.getHours(), minute: local.getMinutes() };
}

export function isBookableSlot(date: Date) {
  const { hour, minute } = clinicClock(date);
  return minute % SLOT_MINUTES === 0 && hour >= OPENING_HOUR && hour < CLOSING_HOUR;
}

// "lunes, 24 de noviembre de 2026, 10:30" en hora de la clínica.
export function formatClinicDateTime(date: Date) {
  return new Intl.DateTimeFormat("es", {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

// Medianoche de HOY en la clínica (no en el servidor), como instante UTC.
export function startOfClinicDay(now = new Date()) {
  const local = new TZDate(now, CLINIC_TIME_ZONE);
  return new Date(new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), CLINIC_TIME_ZONE).getTime());
}
