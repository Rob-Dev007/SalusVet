"use client";

// Último recurso: atrapa errores en el LAYOUT RAÍZ, que error.tsx no cubre (un boundary no
// protege al layout de su mismo nivel). Cuando se activa, REEMPLAZA al layout raíz, por eso
// debe declarar su propio <html> y <body>, e importar los estilos globales por su cuenta.
import "./globals.css";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <title>Error · SalusVet</title>
        <h1 className="text-xl font-semibold">SalusVet no está disponible en este momento</h1>
        <p className="text-sm text-zinc-500">Estamos trabajando para solucionarlo.</p>
        <button
          type="button"
          onClick={retry}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
