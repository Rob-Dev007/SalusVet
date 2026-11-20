// Contrato entre una Server Action y el formulario que la usa (vía useActionState).
// Este archivo NO lleva "server-only": el Client Component importa estos TIPOS.
// (Los imports de tipo se borran al compilar, así que no arrastran código de servidor.)

export type FieldErrors = Partial<Record<string, string[]>>;

export type ActionState<TData = undefined> =
  | { status: "idle" } //                                   Estado inicial, antes de enviar
  | { status: "success"; message: string; data: TData }
  | {
      status: "error";
      message: string; //                                   Mensaje general ("Revisa los campos")
      fieldErrors?: FieldErrors; //                         Errores por campo, para pintarlos bajo cada input
      values?: Record<string, string>; //                   Lo que escribió el usuario, para no borrarle el formulario
    };

export const idleState = { status: "idle" } as const;
