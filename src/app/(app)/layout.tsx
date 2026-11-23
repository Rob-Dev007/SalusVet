import Link from "next/link";
import { Suspense } from "react";
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
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Suspense fallback={<span className="font-semibold text-teal-700 dark:text-teal-400">SalusVet</span>}>
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
        <Link href={user ? homePathFor(user.role) : "/"} className="font-semibold text-teal-700 dark:text-teal-400">
          SalusVet
        </Link>
        {user?.role &&
          navByRole[user.role].map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              {item.label}
            </Link>
          ))}
      </nav>
      {user && (
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-zinc-500 sm:inline">{user.name}</span>
          <SignOutButton />
        </div>
      )}
    </>
  );
}
