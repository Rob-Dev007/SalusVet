import Link from "next/link";

// Logotipo tipográfico: "SalusVet" en la serif de la marca.
export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`font-display text-xl tracking-tight text-brand ${className}`}>
      SalusVet
    </Link>
  );
}
