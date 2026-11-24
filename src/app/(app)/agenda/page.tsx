import type { Metadata } from "next";
import { Suspense } from "react";
import { formatClinicDateTime, startOfClinicDay } from "@/lib/clinic-time";
import { listAgendaForVet } from "@/server/appointments/appointment.service";
import { requireRole } from "@/server/auth/session";
import { QUESTIONNAIRE_VERSION } from "@/server/pre-consultation/questionnaire";
import { statusBadgeClass, statusLabels, urgencyBadgeClass, urgencyLabels } from "../appointments/labels";
import { StatusButtons } from "../appointments/status-buttons";
import { speciesLabels } from "../pets/labels";

export const metadata: Metadata = { title: "Agenda · SalusVet" };

export default function AgendaPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-brand">Mi agenda</h1>
      <p className="mt-1 text-sm text-muted">Citas de hoy en adelante, en hora de la clínica.</p>
      <section className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted">Cargando agenda…</p>}>
          <VetAgenda />
        </Suspense>
      </section>
    </main>
  );
}

async function VetAgenda() {
  const vet = await requireRole("VET");
  // "Hoy" según la clínica: a las 22:00 en la clínica, en UTC ya es mañana.
  const appointments = await listAgendaForVet(vet.id, startOfClinicDay());

  if (appointments.length === 0) {
    return <p className="text-sm text-muted">No tienes citas próximas.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {appointments.map((appointment) => (
        <li key={appointment.id} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{formatClinicDateTime(appointment.scheduledAt)}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[appointment.status]}`}>
              {statusLabels[appointment.status]}
            </span>
          </div>
          <p className="text-sm">
            {appointment.pet.name} ({speciesLabels[appointment.pet.species]})
            <span className="text-muted"> · Dueño: {appointment.pet.owner.name}</span>
          </p>
          <p className="text-sm text-muted">{appointment.reason}</p>
          {appointment.preConsultation ? (
            // <details> nativo: desplegable accesible sin JavaScript. Abierto de entrada si es grave.
            <details
              open={appointment.preConsultation.urgency === "EMERGENCY" || appointment.preConsultation.urgency === "HIGH"}
              className="rounded-lg bg-surface p-3 text-sm ring-1 ring-border"
            >
              <summary className="cursor-pointer font-medium">
                Pre-consulta{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${urgencyBadgeClass[appointment.preConsultation.urgency]}`}
                >
                  {urgencyLabels[appointment.preConsultation.urgency]}
                </span>
              </summary>
              <p className="mt-2 font-medium">{appointment.preConsultation.chiefComplaint}</p>
              <p className="mt-1 whitespace-pre-line text-muted">{appointment.preConsultation.summary}</p>
              {appointment.preConsultation.symptoms.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1">
                  {appointment.preConsultation.symptoms.map((symptom) => (
                    <li key={symptom} className="rounded-full bg-background px-2 py-0.5 text-xs ring-1 ring-border">
                      {symptom}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">
                {/* El origen sale de la columna aiModel (versión del cuestionario o modelo de IA). */}
                {appointment.preConsultation.aiModel === QUESTIONNAIRE_VERSION
                  ? "Respuestas del dueño al cuestionario. La urgencia la calcula el sistema; no es un diagnóstico."
                  : "Generado por IA a partir de lo que contó el dueño. No es un diagnóstico."}
              </p>
            </details>
          ) : (
            <p className="text-xs text-muted">Sin pre-consulta.</p>
          )}
          <StatusButtons appointmentId={appointment.id} status={appointment.status} actor="VET" />
        </li>
      ))}
    </ul>
  );
}
