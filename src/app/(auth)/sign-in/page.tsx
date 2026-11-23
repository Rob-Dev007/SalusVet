import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Iniciar sesión · SalusVet" };

export default function SignInPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Iniciar sesión</h1>
      <AuthForm mode="sign-in" />
    </>
  );
}
