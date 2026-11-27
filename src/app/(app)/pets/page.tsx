import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/lib/ui";
import { requireRole } from "@/server/auth/session";
import { listPetsByOwner } from "@/server/pets/pet.service";
import { CreatePetForm } from "./create-pet-form";
import { formatAge, sexLabels, speciesEmoji, speciesLabels } from "./labels";

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
        <h2 className="mb-3 text-lg font-medium">Mis mascotas registradas</h2>
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
    <>
      <p className="mb-4 text-sm text-muted">
        {pets.length === 1 ? "1 mascota registrada" : `${pets.length} mascotas registradas`}
      </p>
      {/* Grilla: 1 columna en móvil, 2 desde tablet. Cada mascota es una tarjeta, no una fila
          apretada: el dueño la reconoce por el ícono y el nombre antes de leer nada más. */}
      <ul className="grid gap-4 sm:grid-cols-2">
        {pets.map((pet) => (
          <li key={pet.id} className="flex flex-col gap-4 rounded-xl border border-border bg-surface/40 p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-2xl">
                {speciesEmoji[pet.species]}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{pet.name}</h3>
                <p className="text-sm text-muted">{speciesLabels[pet.species]}</p>
              </div>
            </div>

            {/* Ficha en UNA columna: cada fila es "etiqueta ··· valor". Leer de arriba a abajo es
                más rápido que saltar entre columnas, y en móvil no se aprietan los textos largos
                (una raza como "Pastor alemán" o una edad como "4 años y 8 meses").
                Si falta un dato lo decimos ("Sin registrar"): un hueco vacío hace dudar si es un error. */}
            <dl className="divide-y divide-border rounded-lg bg-background text-sm ring-1 ring-border">
              {[
                { label: "Raza", value: pet.breed },
                { label: "Sexo", value: sexLabels[pet.sex] },
                {
                  label: "Edad",
                  value: pet.birthDate && formatAge(pet.birthDate),
                  title: pet.birthDate ? `Nació el ${pet.birthDate.toLocaleDateString("es", { timeZone: "UTC" })}` : undefined,
                },
                // weightKg es Prisma.Decimal (no number): lo convertimos a texto para mostrarlo
                { label: "Peso", value: pet.weightKg && `${pet.weightKg.toString()} kg` },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 px-3 py-2">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="text-right font-medium" title={row.title}>
                    {row.value || <span className="font-normal text-muted">Sin registrar</span>}
                  </dd>
                </div>
              ))}
            </dl>

            {pet.notes && (
              <p className="line-clamp-2 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border" title={pet.notes}>
                <span className="font-medium">Notas: </span>
                {pet.notes}
              </p>
            )}

            {/* Acción natural después de registrar: agendarle una cita. mt-auto la empuja al fondo
                para que los botones queden alineados aunque las tarjetas tengan distinto alto. */}
            <Link href="/appointments" className={`${buttonClass("secondary", "sm")} mt-auto self-start`}>
              Agendar cita →
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
