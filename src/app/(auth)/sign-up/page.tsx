import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Crear cuenta · SalusVet" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Crear cuenta</h1>
      <AuthForm mode="sign-up" />
    </>
  );
}
