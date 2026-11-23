import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { listAppointmentsForOwner, listVets } from "@/server/appointments/appointment.service";
import { requireRole } from "@/server/auth/session";
import { listPetsByOwner } from "@/server/pets/pet.service";
import { BookAppointmentForm } from "./book-appointment-form";
import { statusBadgeClass, statusLabels } from "./labels";
import { StatusButtons } from "./status-buttons";

export const metadata: Metadata = { title: "Mis citas · SalusVet" };

export default function AppointmentsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Mis citas</h1>

      <section className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-medium">Agendar una cita</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">Cargando…</p>}>
          <BookingSection />
        </Suspense>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Historial</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">Cargando citas…</p>}>
          <OwnerAppointmentList />
        </Suspense>
      </section>
    </main>
  );
}

async function BookingSection() {
  const user = await requireRole("OWNER");
  // Promise.all: las dos consultas van EN PARALELO, no una después de otra.
  const [pets, vets] = await Promise.all([listPetsByOwner(user.id), listVets()]);

  if (pets.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Primero{" "}
        <Link href="/pets" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
          registra una mascota
        </Link>
        .
      </p>
    );
  }

  // Al Client Component le pasamos SOLO lo que necesita (id y nombre): ni pesos (Decimal, que
  // no se puede serializar), ni fechas, ni datos que no debe ver.
  return <BookAppointmentForm pets={pets.map(({ id, name }) => ({ id, name }))} vets={vets} />;
}

async function OwnerAppointmentList() {
  const user = await requireRole("OWNER");
  const appointments = await listAppointmentsForOwner(user.id);

  if (appointments.length === 0) {
    return <p className="text-sm text-zinc-500">Todavía no agendaste citas.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {appointments.map((appointment) => (
        <li key={appointment.id} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {appointment.pet.name}
              <span className="font-normal text-zinc-500"> · {appointment.vet?.name ?? "Sin asignar"}</span>
            </p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[appointment.status]}`}>
              {statusLabels[appointment.status]}
            </span>
          </div>
          <p className="text-sm text-zinc-500">{formatClinicDateTime(appointment.scheduledAt)}</p>
          <p className="text-sm">{appointment.reason}</p>
          <StatusButtons appointmentId={appointment.id} status={appointment.status} actor="OWNER" />
        </li>
      ))}
    </ul>
  );
}
