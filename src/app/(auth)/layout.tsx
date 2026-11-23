// Layout compartido por /sign-in y /sign-up. Los paréntesis de (auth) agrupan rutas
// sin aparecer en la URL: la ruta es /sign-in, no /auth/sign-in.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <p className="mb-6 text-center text-lg font-semibold text-teal-700 dark:text-teal-400">SalusVet</p>
        {children}
      </div>
    </main>
  );
}
