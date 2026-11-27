"use client";

// NAVEGACIÓN PRINCIPAL. Es Client Component por dos razones:
//   1) usePathname(): saber en qué página estamos para marcar el enlace ACTIVO.
//   2) useState: abrir y cerrar el menú en móvil.
// Lo que depende de la sesión (qué enlaces, nombre del usuario) lo decide el SERVIDOR en el layout
// y llega como props: este componente solo pinta.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

export type NavItem = { href: string; label: string };

// Activo si es la ruta exacta o una subruta: en /appointments/abc/pre-consultation, "Citas" sigue
// activo. Ojo con startsWith a secas: "/pets-archive" no debe activar "/pets", por eso el "/" final.
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({
  logo,
  items,
  userName,
  actions,
}: {
  logo: ReactNode;
  items: readonly NavItem[];
  userName?: string;
  actions: ReactNode; // Tema + cerrar sesión: llegan ya construidos desde el layout
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape cierra el menú (convención de accesibilidad para paneles desplegables).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-6">
          {logo}
          {/* Escritorio: enlaces en línea. En móvil se ocultan y pasan al menú. */}
          <ul className="hidden items-center gap-5 sm:flex">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden items-center gap-4 sm:flex">
          {userName && <span className="max-w-40 truncate text-sm text-muted">{userName}</span>}
          {actions}
        </div>

        {/* Botón hamburguesa (solo móvil). aria-expanded le dice al lector de pantalla si el menú
            está abierto; aria-controls, qué elemento controla. */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="-mr-2 rounded-lg p-2 text-foreground hover:bg-surface sm:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Menú móvil: se despliega DEBAJO de la barra, empujando el contenido (sin capas flotantes
          que tapen la página ni scroll horizontal). */}
      {open && (
        <div id="mobile-menu" className="border-t border-border pb-4 sm:hidden">
          <ul className="flex flex-col py-2">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)} // Al navegar, el menú se cierra solo
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center rounded-lg border-l-4 px-3 py-3 text-base ${
                      active
                        ? "border-l-primary bg-accent font-medium text-accent-foreground"
                        : "border-l-transparent text-foreground hover:bg-surface"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            {userName && <span className="text-sm text-muted">{userName}</span>}
            <div className="flex items-center gap-4">{actions}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Enlace de escritorio.
//   · Hover: subrayado que se DESPLAZA de izquierda a derecha (utilidad link-underline, globals.css).
//   · Activo: color de la marca, peso medio y subrayado fijo (lo pinta link-underline vía aria-current). aria-current="page" no es solo para
//     el estilo: el lector de pantalla anuncia "página actual".
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`link-underline text-sm ${active ? "font-medium text-brand" : "text-muted hover:text-foreground"}`}
    >
      {item.label}
    </Link>
  );
}
