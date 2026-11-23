import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

// Configuración CENTRAL de autenticación (lado servidor).
export const auth = betterAuth({
  // Better Auth lee y escribe User, Session, Account y Verification a través de Prisma:
  // una sola tabla de usuarios, la nuestra, con sus FK hacia Pet y Appointment.
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10, // NIST recomienda longitud por encima de reglas de "símbolos raros"
    autoSignIn: true, //      Tras registrarse, queda con sesión iniciada
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // La sesión dura 7 días...
    updateAge: 60 * 60 * 24, //     ...y se renueva sola una vez al día si el usuario sigue activo
    // cookieCache queda DESACTIVADO (es el valor por defecto) a propósito: cada petición valida la
    // sesión contra la BD. Cuesta una consulta, pero revocar una sesión tiene efecto INMEDIATO.
  },

  user: {
    additionalFields: {
      role: {
        type: ["OWNER", "VET", "ADMIN"], // Mismos valores que el enum Role de Prisma
        defaultValue: "OWNER",
        // input: false → el registro IGNORA un "role" enviado por el cliente.
        // Sin esto, cualquiera podría registrarse con role: "ADMIN" (mass assignment).
        input: false,
      },
    },
  },

  telemetry: { enabled: false }, // No enviamos métricas de uso a terceros

  // nextCookies() permite que las llamadas a auth.api.* desde Server Actions escriban cookies.
  // Debe ser el ÚLTIMO plugin de la lista.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
