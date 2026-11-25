"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth/session";
import {
  BookAppointmentSchema,
  ChangeAppointmentStatusSchema,
} from "@/server/appointments/appointment.schemas";
import { bookAppointment, changeAppointmentStatus } from "@/server/appointments/appointment.service";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "@/server/shared/errors";

export type BookAppointmentState = ActionState<{ id: string }>;
export type ChangeStatusState = ActionState;

const formValues = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && !entry[0].startsWith("$ACTION"),
    ),
  );

export async function bookAppointmentAction(
  _prev: BookAppointmentState,
  formData: FormData,
): Promise<BookAppointmentState> {
  const values = formValues(formData);
  try {
    const user = await requireRole("OWNER");

    const parsed = BookAppointmentSchema.safeParse(values);
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa los campos marcados",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
        values,
      };
    }

    const appointment = await bookAppointment(user.id, parsed.data);
    refresh();
    return {
      status: "success",
      message: `Cita solicitada para ${appointment.pet.name}. Te avisaremos cuando la confirmen.`,
      data: { id: appointment.id },
    };
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.message, values };
    throw error; // Incluye el redirect() de requireRole: Next lo maneja
  }
}

// Usada por dueños (cancelar) y vets (confirmar, atender...). El servicio decide qué puede cada uno.
export async function changeAppointmentStatusAction(
  _prev: ChangeStatusState,
  formData: FormData,
): Promise<ChangeStatusState> {
  try {
    const user = await requireUser();

    const parsed = ChangeAppointmentStatusSchema.safeParse(formValues(formData));
    if (!parsed.success) return { status: "error", message: "Acción no válida" };

    await changeAppointmentStatus(user, parsed.data);
    refresh();
    return { status: "success", message: "Listo", data: undefined };
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.message };
    throw error;
  }
}
