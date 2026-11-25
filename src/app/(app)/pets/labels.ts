// Etiquetas en español para los enums. Separadas del enum a propósito:
// la BD guarda "DOG" (estable, en inglés); la UI muestra "Perro" (traducible).
import type { Sex, Species } from "@/generated/prisma/enums";

export const speciesLabels: Record<Species, string> = {
  DOG: "Perro",
  CAT: "Gato",
  BIRD: "Ave",
  RABBIT: "Conejo",
  REPTILE: "Reptil",
  CATTLE: "Vacuno",
  OTHER: "Otro",
};

// Ícono por especie para la tarjeta de cada mascota. Un emoji no necesita librería de íconos ni
// imágenes, y se entiende en cualquier idioma. (aria-hidden en la UI: el nombre ya lo dice).
export const speciesEmoji: Record<Species, string> = {
  DOG: "🐶",
  CAT: "🐱",
  BIRD: "🦜",
  RABBIT: "🐰",
  REPTILE: "🦎",
  CATTLE: "🐄",
  OTHER: "🐾",
};

export const sexLabels: Record<Sex, string> = {
  MALE: "Macho",
  FEMALE: "Hembra",
  UNKNOWN: "No sé",
};

// "3 años", "1 año y 4 meses", "8 meses", "Menos de 1 mes". El dueño piensa en EDAD, no en la
// fecha de nacimiento; la fecha exacta queda en un tooltip para quien la necesite.
// birthDate se guarda como fecha sin hora (medianoche UTC): por eso leemos los campos en UTC.
export function formatAge(birthDate: Date, now = new Date()) {
  let months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - birthDate.getUTCMonth());
  if (now.getUTCDate() < birthDate.getUTCDate()) months -= 1; // Aún no cumple el mes en curso
  if (months < 1) return "Menos de 1 mes";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? "1 año" : `${years} años`;
  const m = rest === 1 ? "1 mes" : `${rest} meses`;
  if (years === 0) return m;
  return rest === 0 ? y : `${y} y ${m}`;
}
