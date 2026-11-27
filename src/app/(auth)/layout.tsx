import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

// Layout compartido por /sign-in y /sign-up. Los paréntesis de (auth) agrupan rutas
// sin aparecer en la URL: la ruta es /sign-in, no /auth/sign-in.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-16">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <div className="mb-6 text-center">
          <Wordmark className="text-3xl" />
        </div>
        {children}
      </div>
    </main>
  );
}
