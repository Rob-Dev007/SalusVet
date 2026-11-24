import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isAiConfigured } from "@/lib/anthropic";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { requireRole } from "@/server/auth/session";
import { getPreConsultationView } from "@/server/pre-consultation/pre-consultation.service";
import { urgencyBadgeClass, urgencyLabels } from "../../labels";
import { PreConsultationChat } from "./pre-consultation-chat";
import { QuestionnaireForm } from "./questionnaire-form";

export const metadata: Metadata = { title: "Pre-consulta · SalusVet" };

// La cáscara (título, enlace) es estática; lo que depende de la sesión y de la BD va en Suspense,
// igual que en las otras páginas (Partial Prerendering).
export default function PreConsultationPage({ params }: PageProps<"/appointments/[id]/pre-consultation">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/appointments" className="text-sm text-brand hover:underline">
        ← Mis citas
      </Link>
      <h1 className="mt-2 font-display text-3xl text-brand">Pre-consulta</h1>
      <Suspense fallback={<p className="mt-6 text-sm text-muted">Cargando…</p>}>
        <PreConsultationContent params={params} />
      </Suspense>
    </main>
  );
}

async function PreConsultationContent({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("OWNER");
  const { id } = await params;
  const appointment = await getPreConsultationView(user.id, id);
  if (!appointment) notFound(); // Cita ajena o inexistente: 404, sin distinguir cuál de las dos

  const header = (
    <p className="mt-1 text-sm text-muted">
      {appointment.pet.name} · {formatClinicDateTime(appointment.scheduledAt)}
    </p>
  );

  // Ya enviada: mostramos lo que recibió el veterinario (sin opción de rehacerla).
  if (appointment.preConsultation) {
    const pre = appointment.preConsultation;
    return (
      <>
        {header}
        {pre.urgency === "EMERGENCY" && (
          <div role="alert" className="mt-6 rounded-xl bg-red-700 px-4 py-3 text-sm text-white">
            Por lo que nos contaste, no esperes a la cita: llama a la clínica o acude a urgencias veterinarias.
          </div>
        )}
        <section className="mt-6 rounded-xl border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Enviado al veterinario ✓</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${urgencyBadgeClass[pre.urgency]}`}>
              {urgencyLabels[pre.urgency]}
            </span>
          </div>
          <p className="mt-3 font-medium">{pre.chiefComplaint}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-muted">{pre.summary}</p>
        </section>
      </>
    );
  }

  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    return (
      <>
        {header}
        <p className="mt-6 text-sm text-muted">La pre-consulta solo está disponible para citas activas.</p>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mt-6">
        {/* El servidor decide el modo: el navegador nunca ve la key ni el valor de AI_PROVIDER. */}
        {isAiConfigured() ? (
          <PreConsultationChat appointmentId={appointment.id} petName={appointment.pet.name} />
        ) : (
          <QuestionnaireForm appointmentId={appointment.id} petName={appointment.pet.name} />
        )}
      </div>
    </>
  );
}
