import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { buttonClass } from "@/lib/ui";
import { listAppointmentsForOwner, listVets } from "@/server/appointments/appointment.service";
import { requireRole } from "@/server/auth/session";
import { listPetsByOwner } from "@/server/pets/pet.service";
import { BookAppointmentForm } from "./book-appointment-form";
import { statusAccentClass, statusBadgeClass, statusDescriptions, statusLabels } from "./labels";
import { StatusButtons } from "./status-buttons";

export const metadata: Metadata = { title: "Mis citas · SalusVet" };

export default function AppointmentsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-brand">Mis citas</h1>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="mb-4 text-lg font-medium">Agendar una cita</h2>
        <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
          <BookingSection />
        </Suspense>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Historial</h2>
        <Suspense fallback={<p className="text-sm text-muted">Cargando citas…</p>}>
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
      <p className="text-sm text-muted">
        Primero{" "}
        <Link href="/pets" className="link-underline font-medium text-brand">
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
    return <p className="text-sm text-muted">Todavía no agendaste citas.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {appointments.map((appointment) => {
        const active = appointment.status === "PENDING" || appointment.status === "CONFIRMED";
        const symptoms = appointment.preConsultation?.symptoms ?? [];
        return (
          <li
            key={appointment.id}
            className={`flex flex-col gap-4 rounded-xl border border-l-4 border-border bg-surface/40 p-5 ${statusAccentClass[appointment.status]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{appointment.pet.name}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[appointment.status]}`}>
                {statusLabels[appointment.status]}
              </span>
            </div>

            {/* <dl> = lista de pares "etiqueta: valor". Es la etiqueta semántica correcta para esto:
                los lectores de pantalla leen "Veterinario encargado, Dr. Andrés Castro". */}
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted">Veterinario encargado</dt>
              <dd className="font-medium">{appointment.vet?.name ?? "Por asignar"}</dd>

              <dt className="text-muted">Fecha de consulta</dt>
              <dd className="font-medium first-letter:uppercase">{formatClinicDateTime(appointment.scheduledAt)}</dd>

              <dt className="text-muted">Motivo y síntomas</dt>
              <dd>
                <p>{appointment.reason}</p>
                {symptoms.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Síntomas reportados en la pre-consulta">
                    {symptoms.map((symptom) => (
                      <li key={symptom} className="rounded-full bg-background px-2.5 py-0.5 text-xs ring-1 ring-border">
                        {symptom}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>

              <dt className="text-muted">Estado</dt>
              <dd>
                <span className="font-medium">{statusLabels[appointment.status]}</span>
                <span className="text-muted"> — {statusDescriptions[appointment.status]}</span>
              </dd>
            </dl>

            {/* Acciones al pie, separadas del contenido. */}
            {(active || appointment.preConsultation) && (
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                {appointment.preConsultation ? (
                  <Link href={`/appointments/${appointment.id}/pre-consultation`} className={buttonClass("secondary", "sm")}>
                    Ver pre-consulta enviada ✓
                  </Link>
                ) : (
                  <Link href={`/appointments/${appointment.id}/pre-consultation`} className={buttonClass("soft", "sm")}>
                    Completar pre-consulta →
                  </Link>
                )}
                <StatusButtons appointmentId={appointment.id} status={appointment.status} actor="OWNER" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
