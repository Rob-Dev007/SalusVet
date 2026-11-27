import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { homePathFor } from "@/lib/routes";
import { getOptionalUser } from "@/server/auth/session";
import { MainNav } from "./main-nav";
import { SignOutButton } from "./sign-out-button";

// Navegación por rol. Ocultar enlaces es COMODIDAD, no seguridad: cada página vuelve a verificar
// el rol con requireRole(), y cada acción con el servicio.
const navByRole = {
  OWNER: [
    { href: "/pets", label: "Mascotas" },
    { href: "/appointments", label: "Citas" },
  ],
  VET: [
    { href: "/agenda", label: "Agenda" },
    { href: "/red-flags", label: "Alertas" },
  ],
  ADMIN: [{ href: "/red-flags", label: "Alertas" }],
} as const;

// Layout de la zona privada. El encabezado es estático; lo que depende de la sesión va dentro
// de <Suspense>, como exige cacheComponents.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border">
        <Suspense
          fallback={
            <div className="mx-auto w-full max-w-3xl px-4 py-3">
              <Wordmark />
            </div>
          }
        >
          <UserNav />
        </Suspense>
      </header>
      {children}
    </>
  );
}

async function UserNav() {
  const user = await getOptionalUser();

  // El servidor decide QUÉ mostrar (enlaces del rol, nombre); MainNav (cliente) decide CÓMO
  // (enlace activo, menú móvil). Los componentes de servidor se pasan como props ya renderizados.
  return (
    <MainNav
      logo={<Wordmark href={user ? homePathFor(user.role) : "/"} />}
      items={user ? navByRole[user.role] : []}
      userName={user?.name}
      actions={
        <>
          <ThemeToggle />
          {user && <SignOutButton />}
        </>
      }
    />
  );
}
