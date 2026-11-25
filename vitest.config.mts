// Configuración de Vitest (tests unitarios).
// Solo probamos código PURO (domain/ y utilidades de lib/): no hace falta BD, navegador ni Next.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // El mismo alias que tsconfig.json: "@/domain/triage" → src/domain/triage.ts
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node", // Funciones puras: no necesitamos simular el DOM
    include: ["src/**/*.test.ts"],
  },
});
