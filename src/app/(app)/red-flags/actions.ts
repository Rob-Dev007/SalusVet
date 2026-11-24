"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/session";
import { AddRedFlagSchema, DeactivateRedFlagSchema } from "@/server/red-flags/red-flag.schemas";
import { addRedFlag, deactivateRedFlag } from "@/server/red-flags/red-flag.service";
import type { ActionState } from "@/server/shared/action-state";
import { DomainError } from "@/server/shared/errors";

export type RedFlagState = ActionState;

export async function addRedFlagAction(_prev: RedFlagState, formData: FormData): Promise<RedFlagState> {
  const values = { label: String(formData.get("label") ?? ""), phrase: String(formData.get("phrase") ?? "") };
  try {
    const user = await requireRole("VET", "ADMIN");

    const parsed = AddRedFlagSchema.safeParse(values);
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa los campos marcados",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
        values,
      };
    }

    await addRedFlag(user, parsed.data);
    refresh();
    return { status: "success", message: `Alerta añadida: "${parsed.data.phrase}"`, data: undefined };
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.message, values };
    throw error;
  }
}

export async function deactivateRedFlagAction(_prev: RedFlagState, formData: FormData): Promise<RedFlagState> {
  try {
    const user = await requireRole("VET", "ADMIN");
    const parsed = DeactivateRedFlagSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return { status: "error", message: "Acción no válida" };

    await deactivateRedFlag(user, parsed.data.id);
    refresh();
    return { status: "success", message: "Desactivada", data: undefined };
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.message };
    throw error;
  }
}
