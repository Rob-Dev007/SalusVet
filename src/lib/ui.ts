// ESTILOS DE BOTÓN COMPARTIDOS. Antes cada componente escribía su propia cadena de clases y cada
// botón se comportaba un poco distinto. Una sola fuente = misma apariencia y mismo hover en toda
// la app; cambiar el estilo de "los botones de peligro" es tocar UNA línea.
//
// Sin "server-only": lo usan Server y Client Components por igual (son solo strings).

type Variant = "primary" | "secondary" | "danger" | "soft";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium " +
  // Al pasar el mouse el botón "se levanta" 1px y gana sombra: se nota que es clicable.
  // Deshabilitado: sin hover ni elevación (no promete algo que no va a pasar).
  "hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60";

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const variants: Record<Variant, string> = {
  // Acción principal de la pantalla (una por zona, idealmente).
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30",
  // Acción secundaria: borde neutro que se tiñe de la marca al pasar el mouse.
  secondary: "border border-border bg-background text-foreground hover:border-primary hover:text-brand hover:shadow-sm",
  // Acción destructiva o que no se deshace fácil (cancelar una cita): roja en reposo con borde,
  // se RELLENA de rojo al pasar el mouse para que quede claro qué va a pasar antes del clic.
  danger: "border border-danger/50 text-danger hover:bg-danger hover:text-background hover:shadow-md hover:shadow-danger/25",
  // Llamado a la acción suave (ej. "Completar pre-consulta"): fondo celeste de la marca.
  soft: "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:shadow-primary/25",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}
