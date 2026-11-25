// Contrato entre una Server Action y el formulario que la usa (vía useActionState).
// Vive en lib/ (no en server/) porque lo importan AMBOS lados: la action (servidor) devuelve un
// ActionState y el formulario (navegador) lo lee y arranca con idleState. Sin "server-only".

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
