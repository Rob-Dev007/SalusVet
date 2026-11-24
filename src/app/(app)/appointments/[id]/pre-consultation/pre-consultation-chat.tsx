"use client";

import { useActionState, useRef, useState } from "react";
import { idleState } from "@/server/shared/action-state";
import { type FinalizeState, finalizePreConsultationAction } from "./actions";
import { QuestionnaireForm } from "./questionnaire-form";

type Message = { role: "user" | "assistant"; content: string };

const MAX_CHARS = 1500; // Mismo límite que el servidor (allí es el que manda; aquí solo ayuda)
const MAX_TURNS = 24;
const initialFinalizeState: FinalizeState = idleState;

export function PreConsultationChat({
  appointmentId,
  petName,
  privacyNotice,
}: {
  appointmentId: string;
  petName: string;
  privacyNotice: string;
}) {
  // La conversación vive en el NAVEGADOR y se envía completa en cada turno: la API de Claude no
  // guarda estado entre llamadas. (Ver la nota sobre este trade-off en la explicación de la fase.)
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [finalizeState, finalizeAction, finalizing] = useActionState(
    finalizePreConsultationAction,
    initialFinalizeState,
  );
  const listRef = useRef<HTMLOListElement>(null);
  // RESPALDO: si la IA no está disponible (caída, cuota gratuita agotada), el dueño no se queda
  // bloqueado: puede pasar al cuestionario, que no depende de ningún servicio externo.
  const [useQuestionnaire, setUseQuestionnaire] = useState(false);
  const [aiDown, setAiDown] = useState(false);

  const turnsLeft = MAX_TURNS - messages.length;
  const canFinalize = messages.some((m) => m.role === "assistant") && !streaming;

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || streaming || turnsLeft < 2) return;

    const history: Message[] = [...messages, { role: "user", content: text }];
    // Pintamos el mensaje del dueño y una burbuja vacía de la IA que se irá llenando.
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setStreaming(true);

    try {
      const response = await fetch(`/api/pre-consultation/${appointmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      // El aviso de emergencia lo decide el SERVIDOR (triaje determinista), no el texto de la IA.
      // Lo leemos ANTES de mirar si hubo error: aunque la IA falle, el aviso tiene que aparecer.
      if (Number(response.headers.get("X-Red-Flags")) > 0) setEmergency(true);

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 503) setAiDown(true); // IA no disponible → ofrecemos el cuestionario
        throw new Error(data?.error ?? "No pudimos contactar al asistente");
      }

      // Leemos el stream trozo a trozo. TextDecoder con stream:true une bien las letras con tilde
      // que llegan partidas entre dos trozos (una "á" ocupa 2 bytes en UTF-8).
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
        listRef.current?.lastElementChild?.scrollIntoView({ block: "end" });
      }
      if (!reply.trim()) throw new Error("El asistente no respondió. Intenta de nuevo.");
    } catch (err) {
      // Deshacemos el turno fallido y devolvemos el texto al campo para que no se pierda.
      setMessages(messages);
      setInput(text);
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setStreaming(false);
    }
  }

  if (useQuestionnaire) {
    return (
      <div className="flex flex-col gap-4">
        {emergency && <EmergencyAlert />}
        <QuestionnaireForm appointmentId={appointmentId} petName={petName} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">{privacyNotice}</p>
      {emergency && <EmergencyAlert />}

      <ol ref={listRef} className="flex flex-col gap-3" aria-live="polite">
        {/* Saludo fijo de la UI: no es parte de la conversación que se envía a la IA. */}
        <Bubble role="assistant">
          Hola 👋 Soy el asistente de SalusVet. Cuéntame qué le pasa a {petName}, así el veterinario llega
          preparado a la consulta. No reemplazo la opinión del veterinario.
        </Bubble>
        {messages.map((message, index) => (
          <Bubble key={index} role={message.role}>
            {message.content || <span className="text-muted">Escribiendo…</span>}
          </Bubble>
        ))}
      </ol>

      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="message" className="sr-only">
          Tu mensaje
        </label>
        <textarea
          id="message"
          rows={3}
          maxLength={MAX_CHARS}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter hace salto de línea (convención de los chats)
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={streaming || turnsLeft < 2}
          placeholder={turnsLeft < 2 ? "Llegaste al límite de mensajes" : "Escribe tu respuesta…"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {input.length}/{MAX_CHARS}
          </p>
          <button
            type="submit"
            disabled={streaming || !input.trim() || turnsLeft < 2}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {streaming ? "Respondiendo…" : "Enviar"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      {/* Formulario aparte para terminar: la conversación viaja como JSON en un campo oculto. */}
      <form action={finalizeAction} className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="transcript" value={JSON.stringify(messages)} />
        <button
          type="submit"
          disabled={!canFinalize || finalizing}
          className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-brand hover:bg-accent disabled:opacity-60"
        >
          {finalizing ? "Generando resumen…" : "Enviar al veterinario"}
        </button>
        {finalizeState.status === "error" && <p className="text-sm text-danger">{finalizeState.message}</p>}
      </form>

      {/* Siempre disponible; destacado si la IA falló (en el chat o al generar el resumen). */}
      <button
        type="button"
        onClick={() => setUseQuestionnaire(true)}
        className={`self-start text-sm hover:underline ${
          aiDown || finalizeState.status === "error" ? "font-medium text-brand" : "text-muted"
        }`}
      >
        {aiDown || finalizeState.status === "error"
          ? "Responder el cuestionario en su lugar →"
          : "¿Prefieres un cuestionario en vez del chat?"}
      </button>
    </div>
  );
}

function Bubble({ role, children }: { role: Message["role"]; children: React.ReactNode }) {
  const mine = role === "user";
  return (
    <li
      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
        mine ? "self-end bg-primary text-primary-foreground" : "self-start bg-surface ring-1 ring-border"
      }`}
    >
      {children}
    </li>
  );
}

function EmergencyAlert() {
  return (
    <div role="alert" className="rounded-xl bg-red-700 px-4 py-3 text-sm text-white">
      <p className="font-semibold">Esto puede ser una emergencia.</p>
      <p>No esperes a la cita: llama a la clínica o acude a urgencias veterinarias ahora mismo.</p>
    </div>
  );
}
