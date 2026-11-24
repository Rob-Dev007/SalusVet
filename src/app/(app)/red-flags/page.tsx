import type { Metadata } from "next";
import { Suspense } from "react";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { requireRole } from "@/server/auth/session";
import { BASE_RED_FLAG_LABELS } from "@/server/pre-consultation/triage";
import { listRedFlagsForManagement } from "@/server/red-flags/red-flag.service";
import {
  AddRedFlagForm,
  ApproveDeactivationButton,
  CancelDeactivationButton,
  LockButton,
  RequestDeactivationForm,
} from "./red-flag-forms";

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
  const user = await requireRole("VET", "ADMIN");
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
            {clinicFlags.map((flag) => {
              const pending = flag.active && flag.deactivationRequestedAt !== null;
              const mine = flag.deactivationRequestedById === user.id;
              return (
                <li key={flag.id} className={`flex flex-col gap-2 px-4 py-3 ${flag.active ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        “{flag.phrase}” <span className="font-normal text-muted">→ {flag.label}</span>
                        {flag.locked && (
                          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                            🔒 Protegida
                          </span>
                        )}
                      </p>
                      {/* Auditoría visible: quién la añadió, quién la protegió y quién pidió y aprobó la baja. */}
                      <p className="text-xs text-muted">
                        Añadida por {who(flag.createdBy)} · {formatClinicDateTime(flag.createdAt)}
                        {flag.locked && flag.lockedAt && ` · Protegida por ${who(flag.lockedBy)} · ${formatClinicDateTime(flag.lockedAt)}`}
                      </p>
                      {!flag.active && flag.deactivatedAt && (
                        <p className="text-xs text-muted">
                          {flag.deactivationRequestedAt &&
                            `Baja pedida por ${who(flag.deactivationRequestedBy)} («${flag.deactivationReason}») · `}
                          {flag.deactivationRequestedAt ? "aprobada" : "Desactivada"} por {who(flag.deactivatedBy)} ·{" "}
                          {formatClinicDateTime(flag.deactivatedAt)}
                        </p>
                      )}
                    </div>

                    {/* Qué puede hacer ESTE usuario. Es solo comodidad: cada regla se vuelve a aplicar en el servidor. */}
                    {!flag.active ? (
                      <span className="text-xs text-muted">Inactiva</span>
                    ) : flag.locked ? null : pending ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {!mine && <ApproveDeactivationButton id={flag.id} phrase={flag.phrase} />}
                        <CancelDeactivationButton id={flag.id} mine={mine} />
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start gap-3">
                        <RequestDeactivationForm id={flag.id} />
                        {user.role === "ADMIN" && <LockButton id={flag.id} phrase={flag.phrase} />}
                      </div>
                    )}
                  </div>

                  {pending && flag.deactivationRequestedAt && (
                    <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                      <span className="font-medium">Baja pendiente</span> · pedida por {who(flag.deactivationRequestedBy)} ·{" "}
                      {formatClinicDateTime(flag.deactivationRequestedAt)}: «{flag.deactivationReason}».{" "}
                      {mine
                        ? "Otra persona del equipo debe aprobarla. Mientras tanto, la alerta sigue activa."
                        : "Sigue activa hasta que la apruebes o la rechaces."}
                    </p>
                  )}
                </li>
              );
            })}
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

// Los usuarios eliminados dejan la referencia en NULL (onDelete: SetNull): la auditoría lo dice.
function who(user: { name: string } | null) {
  return user?.name ?? "usuario eliminado";
}
