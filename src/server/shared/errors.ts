import "server-only";

// Catálogo cerrado de errores de NEGOCIO (no técnicos).
// Un error de dominio es un "no" esperado: el usuario hizo algo que las reglas no permiten.
// Un error técnico (la BD se cayó, un bug) NO es DomainError: se deja propagar y Next lo trata como 500.
export type DomainErrorCode =
  | "UNAUTHENTICATED" // No hay sesión
  | "FORBIDDEN" //       Hay sesión, pero no tiene permiso
  | "NOT_FOUND"
  | "LIMIT_EXCEEDED"
  | "CONFLICT" //           Choca con el estado actual (horario ya tomado, la cita cambió mientras tanto)
  | "INVALID_TRANSITION" // La máquina de estados no permite ese cambio
  | "UNAVAILABLE"; //       Un servicio externo (la IA) no está disponible o declinó responder

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string, // Mensaje seguro para mostrar al usuario final
  ) {
    super(message);
    this.name = "DomainError";
  }
}
