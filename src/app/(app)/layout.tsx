import Link from "next/link";
import { Suspense } from "react";
import { getOptionalUser } from "@/server/auth/session";
import { SignOutButton } from "./sign-out-button";

// Layout de la zona privada. El encabezado es estático; el nombre del usuario depende de la
// sesión (dato de la petición), así que va dentro de <Suspense> como exige cacheComponents.
export default function OwnerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/pets" className="font-semibold text-teal-700 dark:text-teal-400">
            SalusVet
          </Link>
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      {children}
    </>
  );
}

async function UserMenu() {
  const user = await getOptionalUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-zinc-500">{user.name}</span>
      <SignOutButton />
    </div>
  );
}
