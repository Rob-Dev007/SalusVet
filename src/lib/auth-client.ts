// Cliente de autenticación para el NAVEGADOR (Client Components).
// Habla con /api/auth/* por fetch. No tiene secretos: todo lo sensible ocurre en el servidor.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
