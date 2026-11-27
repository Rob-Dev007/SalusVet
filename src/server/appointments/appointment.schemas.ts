import "server-only";
import { z } from "zod";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { isBookableSlot, parseClinicDateTime } from "@/lib/clinic-time";

export const BookAppointmentSchema = z.object({
  // Los IDs llegan del formulario: Zod solo verifica la FORMA. Que la mascota sea TUYA y que
  // el vet sea realmente VET lo verifica el servicio (necesita consultar la BD).
  petId: z.string({ error: "Elige una mascota" }).min(1, { error: "Elige una mascota" }),
  vetId: z.string({ error: "Elige un veterinario" }).min(1, { error: "Elige un veterinario" }),

  // "2026-11-24T10:30" → Date (UTC), interpretado en hora de la clínica.
  // Todas estas reglas solo miran el VALOR (y el reloj) → viven en Zod.
  scheduledAt: z
    .string({ error: "Elige fecha y hora" })
    .transform((value, ctx) => {
      const date = parseClinicDateTime(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Fecha u hora inválida" });
        return z.NEVER;
      }
      return date;
    })
    .refine((date) => date > new Date(), { error: "La cita debe ser en el futuro" })
    .refine(isBookableSlot, { error: "Elige un turno entre 08:00 y 17:30, en punto o y media" }),

  reason: z
    .string({ error: "Cuéntanos el motivo" })
    .trim()
    .min(3, { error: "Cuéntanos el motivo (mínimo 3 caracteres)" })
    .max(500, { error: "Máximo 500 caracteres" }),
});
export type BookAppointmentInput = z.infer<typeof BookAppointmentSchema>;

export const ChangeAppointmentStatusSchema = z.object({
  appointmentId: z.string().min(1),
  to: z.enum(AppointmentStatus),
});
export type ChangeAppointmentStatusInput = z.infer<typeof ChangeAppointmentStatusSchema>;
