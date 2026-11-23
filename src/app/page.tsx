import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold text-teal-700 dark:text-teal-400">SalusVet</h1>
      <p className="text-zinc-500">
        Agenda la cita de tu mascota y cuéntale sus síntomas a nuestro asistente antes de llegar a la clínica.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-up" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Crear cuenta
        </Link>
        <Link href="/sign-in" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
