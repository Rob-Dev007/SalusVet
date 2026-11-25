"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { homePathFor } from "@/lib/routes";
import { buttonClass } from "@/lib/ui";

// Traducimos los CÓDIGOS de error de Better Auth a mensajes nuestros.
// Nunca mostramos error.message tal cual: no lo escribimos nosotros (ver la lección de error.tsx).
const errorMessages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email o contraseña incorrectos", // Genérico a propósito: no revela cuál falló
  USER_ALREADY_EXISTS: "No pudimos crear la cuenta con ese email",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 10 caracteres",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga",
  INVALID_EMAIL: "El email no es válido",
};
const fallbackError = "No pudimos completar la operación. Inténtalo de nuevo.";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    // El cliente llama a /api/auth/*. La validación que importa ocurre en el servidor;
    // aquí solo recogemos el resultado. Fíjate: no enviamos "role". Y si lo enviáramos,
    // el servidor lo ignoraría (input: false en lib/auth.ts).
    const { data, error } = isSignUp
      ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
      : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError((error.code && errorMessages[error.code]) || fallbackError);
      return;
    }

    // Éxito: la cookie de sesión ya está guardada (HttpOnly, el JS no puede leerla).
    // Elegir a dónde ir según el rol es solo COMODIDAD: cada página vuelve a verificarlo.
    router.push(homePathFor(data.user.role));
    router.refresh(); // Re-renderiza los Server Components, que ahora ven la sesión
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isSignUp && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nombre
          <input name="name" required autoComplete="name" className={inputClass} />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Contraseña
        <input
          name="password"
          type="password"
          required
          minLength={isSignUp ? 10 : undefined}
          // Ayuda a los gestores de contraseñas a guardar o autocompletar correctamente
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className={inputClass}
        />
        {isSignUp && <span className="text-xs font-normal text-muted">Mínimo 10 caracteres</span>}
      </label>

      <p aria-live="polite" className="min-h-5 text-sm text-danger">
        {error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className={buttonClass()}
      >
        {pending ? "Un momento…" : isSignUp ? "Crear cuenta" : "Iniciar sesión"}
      </button>

      <p className="text-center text-sm text-muted">
        {isSignUp ? "¿Ya tienes cuenta? " : "¿Primera vez aquí? "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="link-underline font-medium text-brand">
          {isSignUp ? "Inicia sesión" : "Crea una cuenta"}
        </Link>
      </p>
    </form>
  );
}
