// Formulario del vet para añadir una señal de alarma.
import { z } from "zod";
import { normalize } from "../pre-consultation/triage";

export const AddRedFlagSchema = z.object({
  label: z
    .string()
    .trim()
    .min(3, { error: "Mínimo 3 caracteres" })
    .max(80, { error: "Máximo 80 caracteres" }),
  phrase: z
    .string()
    .trim()
    .min(3, { error: "Mínimo 3 caracteres" })
    .max(60, { error: "Máximo 60 caracteres" })
    // LISTA BLANCA de caracteres: letras (con tildes, \p{L}), números, espacios y guiones.
    // Así nadie puede colar símbolos de regex ni HTML. Es una segunda barrera: el triaje
    // además escapa la frase antes de buscarla.
    .regex(/^[\p{L}\p{N} -]+$/u, { error: "Solo letras, números, espacios y guiones" })
    // Guardamos la forma NORMALIZADA ("Paracetamol " → "paracetamol"): el UNIQUE de la BD
    // detecta duplicados aunque cambien las mayúsculas o las tildes.
    .transform(normalize),
});

export type AddRedFlagInput = z.infer<typeof AddRedFlagSchema>;

// Aprobar, rechazar o proteger: solo hace falta saber CUÁL alerta.
export const RedFlagIdSchema = z.object({ id: z.string().min(1) });

// Solicitar la baja exige un MOTIVO: quien aprueba decide con contexto, y queda en la auditoría.
export const RequestDeactivationSchema = RedFlagIdSchema.extend({
  reason: z
    .string()
    .trim()
    .min(10, { error: "Explica el motivo (mínimo 10 caracteres)" })
    .max(300, { error: "Máximo 300 caracteres" }),
});
