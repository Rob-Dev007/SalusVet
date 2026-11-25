import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// =============================================================================================
// FRONTERAS DE LA ARQUITECTURA ("arquitectura como código")
//
// Las capas y sus reglas están explicadas en docs/ARCHITECTURE.md. Un diagrama en un documento se
// queda viejo; una regla de lint se ejecuta en cada `npm run lint` y en CI: si alguien rompe una
// frontera, lo sabe en el editor, no en una revisión de código tres semanas después.
//
//   app/, components/  →  server/  →  domain/
//          ↓                 ↓           (puro)
//         lib/  ←───────────┘
//
// Ojo con ESLint "flat config": si dos bloques configuran la MISMA regla para el mismo archivo,
// gana el último (no se suman). Por eso cada carpeta tiene UN bloque con TODAS sus prohibiciones,
// y los grupos de archivos no se pisan entre sí.
// =============================================================================================

// Piezas reutilizables de las reglas. Cada grupo lista el alias (@/lib/prisma) Y su forma relativa
// (**/lib/prisma): si no, `import { prisma } from "../../lib/prisma"` se saltaría la frontera.
const DB = {
  group: ["@/lib/prisma", "@/generated/prisma/client", "@/generated/prisma/client/*", "**/lib/prisma", "**/generated/prisma/client"],
  message:
    "La BD solo se toca desde src/server/** (servicios). La UI llama a un servicio o a una Server Action. " +
    "(Los enums sí se pueden importar: @/generated/prisma/enums)",
};
const AI_SDKS = {
  group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*", "@google/genai", "@google/genai/*"],
  message:
    "Los SDK de IA solo se usan en los adaptadores (src/server/pre-consultation/ai/**). " +
    "El resto del código depende de la interfaz PreConsultationAI, no de un proveedor.",
};
const UI = {
  group: ["@/app/*", "@/components/*", "**/app/*", "**/components/*"],
  message: "La lógica de negocio no conoce la interfaz: server/, domain/ y lib/ nunca importan de app/ ni components/.",
};
const SERVER = {
  group: ["@/server/*", "../**/server/*"],
  message: "Esta capa no depende de server/. (domain/ y lib/ están por DEBAJO de server/.)",
};
const FRAMEWORK = {
  group: ["next", "next/*", "react", "react-dom", "server-only", "@/lib/auth", "@/lib/auth-client"],
  message:
    "domain/ es lógica PURA: sin framework, sin sesión, sin E/S. Así se usa en servidor y navegador, y se testea sin montar nada.",
};

const restrict = (...patterns) => ["error", { patterns }];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // 1) Interfaz: páginas, Server Actions, Route Handlers y componentes.
  //    Pueden usar servicios y domain/, pero NUNCA la BD ni los SDK de IA directamente.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/proxy.ts"],
    rules: { "no-restricted-imports": restrict(DB, AI_SDKS) },
  },

  // 2) Servicios (casos de uso). Pueden usar la BD, pero no la UI ni los SDK de IA.
  {
    files: ["src/server/**/*.ts"],
    ignores: ["src/server/pre-consultation/ai/**"],
    rules: { "no-restricted-imports": restrict(UI, AI_SDKS) },
  },

  // 3) Adaptadores de IA: los ÚNICOS que hablan con Anthropic y Google.
  {
    files: ["src/server/pre-consultation/ai/**/*.ts"],
    rules: { "no-restricted-imports": restrict(UI) },
  },

  // 4) Dominio puro: reglas de negocio sin dependencias (triaje, cuestionario, máquina de estados).
  {
    files: ["src/domain/**/*.ts"],
    rules: { "no-restricted-imports": restrict(DB, AI_SDKS, UI, SERVER, FRAMEWORK) },
  },

  // 5) lib/: infraestructura y utilidades compartidas. No sube a server/ ni a la UI.
  //    Excepciones con nombre propio: prisma.ts y auth.ts SON la conexión a la BD, y anthropic.ts
  //    es la configuración del SDK (usa sus tipos).
  {
    files: ["src/lib/**/*.ts"],
    ignores: ["src/lib/prisma.ts", "src/lib/auth.ts", "src/lib/anthropic.ts"],
    rules: { "no-restricted-imports": restrict(DB, AI_SDKS, UI, SERVER) },
  },
  {
    files: ["src/lib/prisma.ts", "src/lib/auth.ts", "src/lib/anthropic.ts"],
    rules: { "no-restricted-imports": restrict(UI, SERVER) },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
