import "server-only";

// Catálogo cerrado de errores de NEGOCIO (no técnicos).
// Un error de dominio es un "no" esperado: el usuario hizo algo que las reglas no permiten.
// Un error técnico (la BD se cayó, un bug) NO es DomainError: se deja propagar y Next lo trata como 500.
export type DomainErrorCode =
  | "UNAUTHENTICATED" // No hay sesión
  | "FORBIDDEN" //       Hay sesión, pero no tiene permiso
  | "NOT_FOUND"
  | "LIMIT_EXCEEDED";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string, // Mensaje seguro para mostrar al usuario final
  ) {
    super(message);
    this.name = "DomainError";
  }
}
