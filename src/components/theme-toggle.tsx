"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

type ThemeChoice = "light" | "dark" | "system";

const order: ThemeChoice[] = ["system", "light", "dark"];
const labels: Record<ThemeChoice, string> = { system: "Sistema", light: "Claro", dark: "Oscuro" };
const icons: Record<ThemeChoice, string> = { system: "◐", light: "☀", dark: "☾" };

const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system"; // Modo privado o almacenamiento bloqueado: seguimos al sistema
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && media().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function setChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Sin almacenamiento el cambio dura hasta recargar: aceptable
  }
  apply(choice);
  listeners.forEach((notify) => notify());
}

// useSyncExternalStore: la forma correcta en React de leer un estado que vive FUERA de React
// (localStorage + preferencia del sistema). En el servidor no existe localStorage, así que
// getServerSnapshot devuelve null y el botón se pinta recién en el cliente, sin desajustes.
function subscribe(notify: () => void) {
  listeners.add(notify);
  // Si el usuario está en "Sistema" y cambia el modo del sistema operativo, lo seguimos en vivo
  const onSystemChange = () => {
    if (readChoice() === "system") apply("system");
  };
  media().addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(notify);
    media().removeEventListener("change", onSystemChange);
  };
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);
  if (choice === null) return <span className="inline-block h-8 w-24" aria-hidden />;

  const next = order[(order.indexOf(choice) + 1) % order.length];

  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted hover:text-foreground"
      aria-label={`Tema: ${labels[choice]}. Cambiar a ${labels[next]}`}
      title={`Cambiar a ${labels[next]}`}
    >
      <span aria-hidden>{icons[choice]}</span>
      {labels[choice]}
    </button>
  );
}
