// Endpoint HTTP de Better Auth. [...all] es una ruta "catch-all": captura
// /api/auth/sign-in/email, /api/auth/sign-up/email, /api/auth/sign-out, /api/auth/get-session...
// y se las entrega todas al handler de la librería.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
