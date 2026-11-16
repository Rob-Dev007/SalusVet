// Cliente de Prisma compartido por toda la app (patrón singleton).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// En Prisma 7 el cliente habla con Postgres a través de un "driver adapter".
// La app usa la conexión POOLED de Neon: en serverless cada request puede abrir
// conexiones nuevas, y el pooler evita agotar el límite de conexiones de la base.
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

// En desarrollo, el hot reload de Next.js re-ejecuta este módulo en cada cambio.
// Sin este truco crearíamos un PrismaClient (y un pool de conexiones) nuevo cada vez.
// globalThis sobrevive a los reloads, así que guardamos ahí la instancia.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
