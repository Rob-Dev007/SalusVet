// SEED: datos iniciales para DESARROLLO. Se ejecuta con: npx prisma db seed
//
// ¿Por qué un script y no Prisma Studio? Porque es versionado y reproducible: cualquier dev
// (o tú en otra máquina) obtiene exactamente los mismos datos con un comando.
//
// Es IDEMPOTENTE: ejecutarlo dos veces no duplica nada (upsert + "crear solo si falta").
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/prisma";

if (process.env.NODE_ENV === "production") {
  throw new Error("El seed de desarrollo no debe ejecutarse en producción");
}

// Credencial de PRUEBA, solo para desarrollo local. Nunca una contraseña real.
const DEV_PASSWORD = "salusvet-dev-1234";

// Nadie puede registrarse como VET desde la app (role tiene input: false). Por eso los
// veterinarios se crean aquí, del lado del servidor, con acceso directo a la base.
const vets = [
  { name: "Dra. Laura Méndez", email: "vet1@salusvet.test" },
  { name: "Dr. Andrés Castro", email: "vet2@salusvet.test" },
];

async function seedVet({ name, email }: { name: string; email: string }) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "VET" }, //                         Si ya existía, garantizamos el rol
    create: { name, email, role: "VET", emailVerified: true },
  });

  // La contraseña vive en Account, hasheada con el MISMO algoritmo que usa Better Auth
  // (scrypt). Así el vet puede iniciar sesión por el formulario normal.
  const hasCredential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!hasCredential) {
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await hashPassword(DEV_PASSWORD),
      },
    });
  }

  console.log(`✔ ${name} <${email}>`);
}

async function main() {
  for (const vet of vets) await seedVet(vet);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
