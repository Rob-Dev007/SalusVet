import "server-only";
import { z } from "zod";
import { Sex, Species } from "@/generated/prisma/enums";

// Un <input> vacío llega como "" (no como undefined). Para un campo opcional,
// "" significa "no lo llenó": lo normalizamos a undefined ANTES de validar.
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, { error: `Máximo ${max} caracteres` }).optional(),
  );

// ESQUEMA DE ENTRADA para crear una mascota.
// Solo los campos que el USUARIO decide. Fuera, deliberadamente:
//   id                     → lo genera Prisma (cuid)
//   ownerId                → sale de la SESIÓN, nunca del formulario (evita IDOR)
//   createdAt / updatedAt  → los gestiona Prisma
//   deletedAt              → solo lo toca una acción de "archivar", no la de crear
//
// z.object() DESCARTA las claves que no declara: si un atacante agrega
// ownerId=otro-usuario al FormData, desaparece aquí. No llega nunca al servicio.
export const CreatePetSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(1, { error: "El nombre es obligatorio" })
    .max(60, { error: "Máximo 60 caracteres" }),

  species: z.enum(Species, { error: "Selecciona una especie" }), // Mismos valores que el enum de Postgres

  breed: optionalText(60),

  sex: z.preprocess(blankToUndefined, z.enum(Sex).default("UNKNOWN")),

  // Regla "no puede nacer en el futuro": solo necesita el VALOR y la fecha actual → vive en Zod.
  // Va en refine() (se evalúa en cada validación) y no en .max(new Date()), que congelaría
  // la fecha del momento en que se cargó el módulo.
  birthDate: z.preprocess(
    blankToUndefined,
    z.coerce
      .date({ error: "Fecha inválida" }) //                "2024-03-15" (string) → Date
      .refine((date) => date <= new Date(), { error: "La fecha no puede estar en el futuro" })
      .optional(),
  ),

  weightKg: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: "Debe ser un número" }) //          "12.5" (string) → 12.5 (number)
      .positive({ error: "Debe ser mayor que 0" })
      // Tope de NEGOCIO (2000 kg: el toro más pesado ronda 1500) por debajo del tope TÉCNICO de la
      // columna (9999.99). Zod atrapa el error de tipeo ("5000" en vez de "500") con un mensaje claro;
      // la BD solo garantiza que el número quepa.
      .max(2000, { error: "Máximo 2000 kg" })
      .optional(),
  ),

  notes: optionalText(2000),
});

// El TIPO sale del validador: una sola fuente de verdad.
// z.infer da el tipo de SALIDA (ya transformado): birthDate es Date, weightKg es number.
export type CreatePetInput = z.infer<typeof CreatePetSchema>;
