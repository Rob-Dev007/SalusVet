import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/server/auth/session";
import { listPetsByOwner } from "@/server/pets/pet.service";
import { CreatePetForm } from "./create-pet-form";
import { sexLabels, speciesLabels } from "./labels";

export const metadata: Metadata = { title: "Mis mascotas · SalusVet" };

// La página es un Server Component. Lo estático (títulos, formulario) se envía al instante;
// lo que depende del usuario y de la BD (el listado) se transmite después dentro de <Suspense>.
export default function PetsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-brand">Mis mascotas</h1>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="mb-4 text-lg font-medium">Registrar una mascota</h2>
        <CreatePetForm />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Registradas</h2>
        <Suspense fallback={<p className="text-sm text-muted">Cargando mascotas…</p>}>
          <PetList />
        </Suspense>
      </section>
    </main>
  );
}

// Componente async de servidor: consulta la BD directamente vía el SERVICIO (nunca prisma aquí).
async function PetList() {
  const user = await requireRole("OWNER"); // Un VET que entre aquí va a su agenda
  const pets = await listPetsByOwner(user.id);

  if (pets.length === 0) {
    return <p className="text-sm text-muted">Aún no registraste mascotas.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {pets.map((pet) => (
        <li key={pet.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
          <div>
            <p className="font-medium">{pet.name}</p>
            <p className="text-sm text-muted">
              {speciesLabels[pet.species]}
              {pet.breed && ` · ${pet.breed}`} · {sexLabels[pet.sex]}
            </p>
          </div>
          <p className="text-sm text-muted">
            {/* weightKg es Prisma.Decimal (no number): lo convertimos a texto para mostrarlo */}
            {pet.weightKg && `${pet.weightKg.toString()} kg`}
            {pet.birthDate && ` · nació ${pet.birthDate.toLocaleDateString("es", { timeZone: "UTC" })}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
