import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// PROXY = se ejecuta ANTES de cada petición que coincida con el matcher.
//
// ⚠️ Esto es una verificación OPTIMISTA, solo para la experiencia de usuario:
// mira si EXISTE la cookie, no si es válida (no consulta la BD, sería lento en cada request).
// Una cookie falsa o de una sesión revocada pasa este filtro sin problema.
// La seguridad real está en requireUser(), que se llama en cada página y Server Action.
//
// Por eso este proxy solo redirige en UNA dirección: "sin cookie → fuera". Nunca "con cookie →
// adentro" (por ejemplo, /sign-in → /pets): con una cookie inválida, requireUser() mandaría al
// login, el proxy de vuelta a /pets, y así en bucle infinito. Un chequeo optimista solo puede
// usarse para NEGAR acceso, jamás para CONCEDERLO.
const protectedPrefixes = ["/pets", "/appointments", "/agenda"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  // Sin cookie intentando entrar a una zona privada → al login, sin ni siquiera renderizar
  if (!hasSessionCookie && protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // No corre en la API de auth, en archivos estáticos ni en imágenes
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
