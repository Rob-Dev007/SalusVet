"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/session";
import { TranscriptSchema } from "@/server/pre-consultation/pre-consultation.schemas";
import { finalizePreConsultation } from "@/server/pre-consultation/pre-consultation.service";
import type { ActionState } from "@/server/shared/action-state";
import { DomainError } from "@/server/shared/errors";

export type FinalizeState = ActionState;

// La conversación viaja como JSON en un campo oculto del formulario. Dos pasos de parseo:
// texto → JSON (puede fallar si alguien manipula el campo) → schema (forma y límites).
const FinalizeSchema = z.object({
  appointmentId: z.string().min(1),
  transcript: z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "JSON inválido" });
        return z.NEVER;
      }
    })
    .pipe(TranscriptSchema),
});

export async function finalizePreConsultationAction(
  _prev: FinalizeState,
  formData: FormData,
): Promise<FinalizeState> {
  try {
    const user = await requireRole("OWNER");

    const parsed = FinalizeSchema.safeParse({
      appointmentId: formData.get("appointmentId"),
      transcript: formData.get("transcript"),
    });
    if (!parsed.success) return { status: "error", message: "La conversación no es válida" };

    await finalizePreConsultation(user.id, parsed.data.appointmentId, parsed.data.transcript);
    refresh(); // La página vuelve a renderizar y muestra el resumen guardado
    return { status: "success", message: "Enviado al veterinario", data: undefined };
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.message };
    throw error;
  }
}
