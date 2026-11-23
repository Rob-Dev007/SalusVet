// Cliente de autenticación para el NAVEGADOR (Client Components).
// Habla con /api/auth/* por fetch. No tiene secretos: todo lo sensible ocurre en el servidor.
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth"; // Solo el TIPO: se borra al compilar, no trae código de servidor

export const authClient = createAuthClient({
  // Le enseña al cliente que user tiene "role", para que TypeScript lo conozca tras el login.
  plugins: [inferAdditionalFields<typeof auth>()],
});
