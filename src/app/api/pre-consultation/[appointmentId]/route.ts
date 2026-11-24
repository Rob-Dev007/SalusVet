// ENDPOINT DE CHAT (Route Handler). ¿Por qué no una Server Action, como en el resto de la app?
// Una Server Action devuelve UN resultado al terminar. Para el efecto "máquina de escribir"
// necesitamos enviar la respuesta POR PARTES mientras la IA la genera: un Response con un
// ReadableStream. Eso lo da un Route Handler.
//
// Mismo rol de "portero" que una Server Action: autenticar → validar → delegar al servicio.
import { getOptionalUser } from "@/server/auth/session";
import { ChatRequestSchema } from "@/server/pre-consultation/pre-consultation.schemas";
import { streamPreConsultationReply } from "@/server/pre-consultation/pre-consultation.service";
import { detectRedFlags } from "@/server/pre-consultation/triage";
import { DomainError } from "@/server/shared/errors";

const STATUS_BY_CODE: Partial<Record<DomainError["code"], number>> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  UNAVAILABLE: 503,
};

export async function POST(request: Request, ctx: RouteContext<"/api/pre-consultation/[appointmentId]">) {
  // 1. AUTENTICAR. En una API no redirigimos al login (el que llama es fetch, no una persona
  // navegando): respondemos 401/403 y el cliente decide qué mostrar.
  const user = await getOptionalUser();
  if (!user) return Response.json({ error: "Inicia sesión para continuar" }, { status: 401 });
  if (user.role !== "OWNER") return Response.json({ error: "Solo para dueños" }, { status: 403 });

  // 2. VALIDAR. request.json() lanza si el cuerpo no es JSON: lo tratamos como entrada inválida.
  const json: unknown = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Mensaje no válido" }, { status: 400 });

  const { appointmentId } = await ctx.params;

  // TRIAJE ANTES QUE TODO: es una función pura (sin BD ni IA), así que no puede "caerse".
  // La alarma la comunica NUESTRO código por un canal propio (un encabezado) en TODAS las
  // respuestas, también en las de error: si la IA no está disponible, el dueño igual ve el aviso.
  const redFlagsHeader = {
    "X-Red-Flags": String(detectRedFlags(parsed.data.messages.filter((m) => m.role === "user").map((m) => m.content)).length),
  };

  // 3. DELEGAR.
  try {
    const { body } = await streamPreConsultationReply(
      user.id,
      appointmentId,
      parsed.data.messages,
      request.signal, // Se aborta si el cliente se desconecta
    );
    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store", //         Nunca cachear conversaciones médicas
        "X-Content-Type-Options": "nosniff",
        ...redFlagsHeader,
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return Response.json(
        { error: error.message },
        { status: STATUS_BY_CODE[error.code] ?? 400, headers: redFlagsHeader },
      );
    }
    throw error; // Error técnico: Next responde 500 sin filtrar detalles
  }
}
