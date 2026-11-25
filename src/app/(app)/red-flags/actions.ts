"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/session";
import type { CurrentUser } from "@/server/auth/session";
import { AddRedFlagSchema, RedFlagIdSchema, RequestDeactivationSchema } from "@/server/red-flags/red-flag.schemas";
import {
  addRedFlag,
  approveRedFlagDeactivation,
  cancelRedFlagDeactivation,
  lockRedFlag,
  requestRedFlagDeactivation,
} from "@/server/red-flags/red-flag.service";
import type { ActionState } from "@/lib/action-state";
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

// Las acciones sobre UNA alerta comparten todo salvo la llamada al servicio: sesión, validar el id,
// traducir errores y refrescar. La fábrica evita copiar ese bloque cuatro veces (y olvidarse de algo
// en una). Ojo: "use server" exige que lo EXPORTADO sean funciones async; la fábrica no se exporta.
function flagAction(run: (user: CurrentUser, id: string) => Promise<void>, successMessage: string) {
  return async (_prev: RedFlagState, formData: FormData): Promise<RedFlagState> => {
    try {
      const user = await requireRole("VET", "ADMIN"); // El servicio vuelve a comprobar (ej. ADMIN para proteger)
      const parsed = RedFlagIdSchema.safeParse({ id: formData.get("id") });
      if (!parsed.success) return { status: "error", message: "Acción no válida" };

      await run(user, parsed.data.id);
      refresh();
      return { status: "success", message: successMessage, data: undefined };
    } catch (error) {
      if (error instanceof DomainError) return { status: "error", message: error.message };
      throw error;
    }
  };
}

const approve = flagAction(approveRedFlagDeactivation, "Baja aprobada");
const cancel = flagAction(cancelRedFlagDeactivation, "Solicitud retirada");
const lock = flagAction(lockRedFlag, "Alerta protegida");

export async function approveDeactivationAction(prev: RedFlagState, formData: FormData) {
  return approve(prev, formData);
}
export async function cancelDeactivationAction(prev: RedFlagState, formData: FormData) {
  return cancel(prev, formData);
}
export async function lockRedFlagAction(prev: RedFlagState, formData: FormData) {
  return lock(prev, formData);
}

// Solicitar lleva además un MOTIVO, con sus propios errores de campo.
export async function requestDeactivationAction(_prev: RedFlagState, formData: FormData): Promise<RedFlagState> {
  const values = { reason: String(formData.get("reason") ?? "") };
  try {
    const user = await requireRole("VET", "ADMIN");
    const parsed = RequestDeactivationSchema.safeParse({ id: formData.get("id"), reason: values.reason });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa el motivo",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
        values,
      };
    }

    await requestRedFlagDeactivation(user, parsed.data.id, parsed.data.reason);
    refresh();
    return { status: "success", message: "Solicitud enviada", data: undefined };
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.message, values };
    throw error;
  }
}
