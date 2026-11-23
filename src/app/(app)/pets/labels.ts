// Etiquetas en español para los enums. Separadas del enum a propósito:
// la BD guarda "DOG" (estable, en inglés); la UI muestra "Perro" (traducible).
import type { Sex, Species } from "@/generated/prisma/enums";

export const speciesLabels: Record<Species, string> = {
  DOG: "Perro",
  CAT: "Gato",
  BIRD: "Ave",
  RABBIT: "Conejo",
  REPTILE: "Reptil",
  OTHER: "Otro",
};

export const sexLabels: Record<Sex, string> = {
  MALE: "Macho",
  FEMALE: "Hembra",
  UNKNOWN: "No sé",
};
