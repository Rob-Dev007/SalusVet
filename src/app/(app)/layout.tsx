import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { homePathFor } from "@/lib/routes";
import { getOptionalUser } from "@/server/auth/session";
import { SignOutButton } from "./sign-out-button";

// Navegación por rol. Ocultar enlaces es COMODIDAD, no seguridad: cada página vuelve a verificar
// el rol con requireRole(), y cada acción con el servicio.
const navByRole = {
  OWNER: [
    { href: "/pets", label: "Mascotas" },
    { href: "/appointments", label: "Citas" },
  ],
  VET: [{ href: "/agenda", label: "Agenda" }],
  ADMIN: [],
} as const;

// Layout de la zona privada. El encabezado es estático; lo que depende de la sesión va dentro
// de <Suspense>, como exige cacheComponents.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Suspense fallback={<Wordmark />}>
            <UserNav />
          </Suspense>
        </div>
      </header>
      {children}
    </>
  );
}

async function UserNav() {
  const user = await getOptionalUser();

  return (
    <>
      <nav className="flex items-center gap-4">
        <Wordmark href={user ? homePathFor(user.role) : "/"} />
        {user?.role &&
          navByRole[user.role].map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-muted hover:text-foreground">
              {item.label}
            </Link>
          ))}
      </nav>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        {user && (
          <>
            <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
            <SignOutButton />
          </>
        )}
      </div>
    </>
  );
}
