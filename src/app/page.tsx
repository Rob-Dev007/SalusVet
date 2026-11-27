import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Wordmark />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col">
        {/* Banda principal con el azul marino de la marca, como el banner oficial.
            Fijo en ambos temas: es identidad, no "fondo de página". */}
        <section className="mx-4 rounded-2xl bg-[#0b4a86] px-6 py-16 text-center text-white sm:mx-auto sm:w-full sm:max-w-5xl sm:py-24">
          <h1 className="font-display text-5xl leading-none sm:text-7xl">Salus Vet</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#d6e4f5]">
            Atención y diagnóstico veterinario. Profesionalismo y respeto en cada visita.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#0b4a86] hover:bg-[#d6e4f5]"
            >
              Agendar una cita
            </Link>
            <Link
              href="/sign-in"
              className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-12 sm:grid-cols-3">
          {[
            { title: "Agenda en línea", text: "Elige veterinario y horario sin llamar ni esperar." },
            { title: "Pre-consulta", text: "Cuéntanos los síntomas antes de llegar para que el veterinario te espere preparado." },
            { title: "Historial", text: "Todas las citas de tus mascotas en un solo lugar." },
          ].map((feature) => (
            <div key={feature.title} className="rounded-xl border border-border bg-surface p-5">
              <h2 className="font-display text-xl text-brand">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted">{feature.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted">
        Loja, Ecuador · Av. Benjamín Carrión y Mariana Córdova, barrio Nuevo Amanecer
      </footer>
    </>
  );
}
