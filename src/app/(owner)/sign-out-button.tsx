"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    // Borra la fila de Session en la BD y la cookie. Esa sesión deja de valer AL INSTANTE.
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      Cerrar sesión
    </button>
  );
}
