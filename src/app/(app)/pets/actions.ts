"use server"; // Cada función exportada aquí es un endpoint POST que el navegador puede invocar.

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { CreatePetSchema } from "@/server/pets/pet.schemas";
import { createPet } from "@/server/pets/pet.service";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "@/server/shared/errors";

export type CreatePetState = ActionState<{ id: string }>;

// EL PORTERO: autentica, valida y traduce. NO contiene reglas de negocio.
// Firma de useActionState: (estadoAnterior, formData) => nuevoEstado
export async function createPetAction(
  _prevState: CreatePetState,
  formData: FormData,
): Promise<CreatePetState> {
  // Guardamos lo que escribió el usuario (solo strings) para devolvérselo si hay error.
  const values = Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && !entry[0].startsWith("$ACTION"),
    ),
  );

  try {
    // 1. ¿Quién eres? Se verifica EN CADA action, aunque la página ya lo haya hecho:
    //    una Server Action es un endpoint público, cualquiera puede llamarla con curl.
    const user = await requireUser();
    if (user.role !== "OWNER") {
      throw new DomainError("FORBIDDEN", "Solo los dueños pueden registrar sus mascotas aquí");
    }

    // 2. ¿Datos válidos? safeParse NO lanza: devuelve { success, data | error }.
    const parsed = CreatePetSchema.safeParse(values);
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa los campos marcados",
        fieldErrors: z.flattenError(parsed.error).fieldErrors, // { name: ["El nombre es obligatorio"], ... }
        values,
      };
    }

    // 3. Delegar al servicio con datos limpios + ownerId de la sesión.
    const pet = await createPet(user.id, parsed.data);

    refresh(); // Vuelve a renderizar la página para que el listado muestre la nueva mascota
    return { status: "success", message: `${pet.name} quedó registrado`, data: { id: pet.id } };
  } catch (error) {
    // Errores de NEGOCIO → mensaje para el usuario.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, values };
    }
    // Errores TÉCNICOS → se propagan. Next muestra el error boundary y el detalle
    // queda en los logs del servidor, no en el navegador (no filtramos internals).
    throw error;
  }
}
