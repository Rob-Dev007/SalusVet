import "server-only";
import { prisma } from "@/lib/prisma";
import { DomainError } from "../shared/errors";
import type { CreatePetInput } from "./pet.schemas";

export const MAX_PETS_PER_OWNER = 20;

// Qué columnas devolvemos. Elegirlas explícitamente evita filtrar campos por accidente
// (si mañana agregas una columna sensible a Pet, no aparece aquí hasta que tú lo decidas).
const petSummarySelect = {
  id: true,
  name: true,
  species: true,
  breed: true,
  sex: true,
  birthDate: true,
  weightKg: true,
  notes: true, // Alergias y antecedentes: el dueño debe poder ver lo que registró
  createdAt: true,
} as const;

// CASO DE USO: un dueño registra una mascota.
// Recibe datos YA validados (CreatePetInput) y un ownerId CONFIABLE (de la sesión).
// No sabe nada de formularios, HTTP ni React: se puede llamar desde una action, un seed o un test.
export async function createPet(ownerId: string, input: CreatePetInput) {
  return prisma.$transaction(async (tx) => {
    // Regla "máx. 20 mascotas": necesita CONSULTAR LA BD → no puede vivir en Zod → vive aquí.
    // Las archivadas (deletedAt) no cuentan para el límite.
    const activePets = await tx.pet.count({ where: { ownerId, deletedAt: null } });

    if (activePets >= MAX_PETS_PER_OWNER) {
      throw new DomainError(
        "LIMIT_EXCEEDED",
        `Alcanzaste el máximo de ${MAX_PETS_PER_OWNER} mascotas registradas`,
      );
    }

    // Nota de mentor: con el aislamiento por defecto de Postgres (READ COMMITTED), dos
    // peticiones SIMULTÁNEAS del mismo dueño podrían leer 19 y crear la #20 y la #21.
    // Para un límite "blando" como este se acepta. Si fuera crítico (stock, cupos de agenda),
    // usaríamos isolationLevel: "Serializable" + reintento, o un bloqueo de fila.
    return tx.pet.create({
      data: { ...input, ownerId }, // ownerId se asigna AQUÍ, desde el parámetro, no desde el input
      select: petSummarySelect,
    });
  });
}

// CASO DE USO: listar las mascotas activas de un dueño.
export async function listPetsByOwner(ownerId: string) {
  return prisma.pet.findMany({
    where: { ownerId, deletedAt: null }, // El filtro por dueño ES la autorización: solo ves las tuyas
    orderBy: { createdAt: "desc" },
    select: petSummarySelect,
  });
}
