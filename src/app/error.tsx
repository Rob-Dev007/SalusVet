"use client"; // Los error boundaries de React solo existen en el cliente

import { useEffect } from "react";

// Red de seguridad para errores INESPERADOS (técnicos) en cualquier ruta bajo el layout raíz:
// Neon caído, un bug, un throw que nadie atrapó. Los errores de negocio (DomainError) nunca
// llegan aquí: la action los convierte en un mensaje para el formulario.
//
// Lo que NO hacemos: mostrar error.message. En producción Next ya lo reemplaza por un texto
// genérico para errores de servidor, pero no dependemos de eso: esta UI nunca lo pinta.
export default function ErrorBoundary({
  error,
  retry,
}: {
  error: unknown; //     Lo que se lanzó. Puede no ser un Error: hay que "estrechar" el tipo antes de usarlo
  retry: () => void; //  Vuelve a pedir los datos y re-renderizar el segmento (útil si el fallo era temporal)
}) {
  // digest = hash que Next genera para errores del servidor. Es seguro mostrarlo: no revela nada,
  // pero permite encontrar el error completo en los logs del servidor (Vercel, terminal).
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;

  useEffect(() => {
    // Aquí iría el envío a un servicio de monitoreo (Sentry, etc.). Por ahora, la consola.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="text-sm text-zinc-500">
        Tuvimos un problema al cargar esta sección. No es culpa tuya: puedes intentarlo de nuevo en
        unos segundos.
      </p>

      <button
        type="button"
        onClick={retry}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Reintentar
      </button>

      {digest && (
        <p className="text-xs text-zinc-400">
          Si el problema continúa, comparte este código con soporte:{" "}
          <code className="font-mono">{digest}</code>
        </p>
      )}
    </main>
  );
}
