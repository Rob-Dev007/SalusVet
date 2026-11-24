import type { Metadata } from "next";
import { Suspense } from "react";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { requireRole } from "@/server/auth/session";
import { BASE_RED_FLAG_LABELS } from "@/server/pre-consultation/triage";
import { listRedFlagsForManagement } from "@/server/red-flags/red-flag.service";
import { AddRedFlagForm, DeactivateButton } from "./red-flag-forms";

export const metadata: Metadata = { title: "Alertas de triaje · SalusVet" };

export default function RedFlagsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-brand">Alertas de triaje</h1>
      <p className="mt-1 text-sm text-muted">
        Si el dueño escribe una de estas señales en la pre-consulta, el sistema la marca como emergencia y le pide
        acudir de inmediato, sin importar el resto de sus respuestas.
      </p>

      <Suspense fallback={<p className="mt-6 text-sm text-muted">Cargando…</p>}>
        <RedFlagsContent />
      </Suspense>
    </main>
  );
}

async function RedFlagsContent() {
  await requireRole("VET", "ADMIN");
  const clinicFlags = await listRedFlagsForManagement();

  return (
    <>
      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="mb-4 text-lg font-medium">Añadir una alerta de la clínica</h2>
        <AddRedFlagForm />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Alertas de la clínica</h2>
        {clinicFlags.length === 0 ? (
          <p className="text-sm text-muted">Todavía no añadieron alertas propias.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {clinicFlags.map((flag) => (
              <li key={flag.id} className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${flag.active ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <p className="font-medium">
                    “{flag.phrase}” <span className="font-normal text-muted">→ {flag.label}</span>
                  </p>
                  {/* Auditoría visible: quién la añadió y, si aplica, quién la desactivó. */}
                  <p className="text-xs text-muted">
                    Añadida por {flag.createdBy?.name ?? "usuario eliminado"} · {formatClinicDateTime(flag.createdAt)}
                    {!flag.active &&
                      flag.deactivatedAt &&
                      ` · Desactivada por ${flag.deactivatedBy?.name ?? "usuario eliminado"} · ${formatClinicDateTime(flag.deactivatedAt)}`}
                  </p>
                </div>
                {flag.active ? (
                  <DeactivateButton id={flag.id} phrase={flag.phrase} />
                ) : (
                  <span className="text-xs text-muted">Inactiva</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-medium">Lista base 🔒</h2>
        <p className="mb-3 text-sm text-muted">
          Siempre activa. Se cambia solo desde el código, con revisión y pruebas, para que nadie la desactive por error.
        </p>
        <ul className="flex flex-wrap gap-2">
          {BASE_RED_FLAG_LABELS.map((label) => (
            <li key={label} className="rounded-full bg-surface px-3 py-1 text-xs ring-1 ring-border">
              {label}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
