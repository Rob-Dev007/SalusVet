// Configuración del CLI de Prisma (migrate, generate, studio).
// En Prisma 7 la URL de conexión vive aquí, no en schema.prisma.
import "dotenv/config"; // Prisma 7 ya no carga .env por su cuenta: lo hacemos explícito
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // El CLI usa la conexión DIRECTA de Neon (sin pooler):
    // las migraciones necesitan una sesión estable, y PgBouncer (el pooler) no la garantiza.
    url: env("DIRECT_URL"),
  },
});
