"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BusinessContextForAI } from "@/lib/intelligence/ai-business-context";

const MAX_QUESTION = 1_500;
const MAX_SESSION_MESSAGES = 12;

const SUGGESTED = [
  "¿Por qué estoy perdiendo plata?",
  "¿Qué cambió este mes?",
  "¿Dónde estoy gastando más?",
  "¿Qué producto afecta más mi rentabilidad?",
  "¿Qué debería priorizar esta semana?",
  "¿Qué riesgo financiero ves?",
  "¿Cómo viene el negocio desde el inicio operativo?",
] as const;

type ChatTurn = { role: "user" | "assistant"; content: string };

type ApiOk = { reply: string; model?: string };
type ApiErr = {
  error?: string;
  message?: string;
  detail?: string;
};

export function BusinessAnalystPanel({
  businessContext,
}: {
  businessContext: BusinessContextForAI;
}) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const inFlight = useRef(false);

  const analyze = useCallback(
    async (questionRaw: string) => {
      const question = questionRaw.trim();
      if (!question || inFlight.current) return;
      if (question.length > MAX_QUESTION) {
        setError(`La pregunta supera ${MAX_QUESTION} caracteres.`);
        return;
      }

      setError(null);
      const userTurn: ChatTurn = { role: "user", content: question };

      const prevHistory = history;
      const nextHistory = [...prevHistory, userTurn];
      if (nextHistory.length > MAX_SESSION_MESSAGES) {
        setError(
          "Alcanzaste el máximo de mensajes en esta sesión. Limpiá el historial para continuar.",
        );
        return;
      }

      setHistory(nextHistory);
      setInput("");
      inFlight.current = true;
      setLoading(true);

      try {
        const res = await fetch("/api/intelligence-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextHistory,
            businessContext,
          }),
        });

        const data = (await res.json()) as ApiOk & ApiErr;

        if (!res.ok) {
          if (data.error === "missing_api_key") {
            setMissingKey(true);
          }
          setHistory(prevHistory);
          setError(
            data.message ??
              data.detail ??
              "No se pudo obtener respuesta del analista.",
          );
          return;
        }

        const reply = typeof data.reply === "string" ? data.reply : "";
        if (!reply) {
          setHistory(prevHistory);
          setError("Respuesta vacía del servidor.");
          return;
        }

        const withAssistant: ChatTurn[] = [
          ...nextHistory,
          { role: "assistant", content: reply },
        ];
        setHistory(withAssistant);
      } catch {
        setHistory(prevHistory);
        setError("Error de red. Verificá tu conexión e intentá de nuevo.");
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [businessContext, history],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void analyze(input);
    },
    [analyze, input],
  );

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardContent className="space-y-5 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Capa IA asistida
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--foreground-muted)]">
              Interpretación sobre datos agregados del período. No reemplaza
              asesoramiento profesional.
            </p>
          </div>
          {history.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setHistory([]);
                setError(null);
              }}
            >
              Limpiar historial
            </Button>
          ) : null}
        </div>
        {missingKey ? (
          <div
            className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning-soft)_45%,var(--surface))] px-4 py-3 text-[13px] text-[var(--foreground)]"
            role="status"
          >
            <p className="font-semibold text-[var(--foreground-strong)]">
              OPENAI_API_KEY no configurada
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
              En desarrollo: agregá{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[11px]">
                OPENAI_API_KEY
              </code>{" "}
              a <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[11px]">.env.local</code>.
              En Vercel: Project Settings → Environment Variables →{" "}
              <span className="font-medium">OPENAI_API_KEY</span> (sin prefijo{" "}
              <code className="text-[11px]">NEXT_PUBLIC_</code>).
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => void analyze(q)}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-left text-[11.5px] font-medium text-[var(--foreground-muted)] transition hover:border-[var(--border)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {history.length > 0 ? (
          <div className="max-h-[min(52vh,520px)] space-y-4 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-4">
            {history.map((m, idx) => (
              <div
                key={`${idx}-${m.role}-${m.content.slice(0, 24)}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(100%,640px)] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-[var(--shadow-sm)] ${
                    m.role === "user"
                      ? "bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)]"
                      : "border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--foreground)]"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <p className="whitespace-pre-wrap font-normal tracking-tight">
                      {m.content}
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap font-medium">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 pl-1 text-[12px] text-[var(--foreground-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Analizando con el contexto del período actual…
              </div>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="sr-only">Pregunta para el analista</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_QUESTION}
              rows={3}
              disabled={loading}
              placeholder="Formulá una pregunta concreta sobre rentabilidad, gastos, stock o clientes…"
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--foreground)] outline-none ring-0 transition placeholder:text-[var(--foreground-subtle)] focus:border-[var(--foreground-muted)] disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--foreground-subtle)]">
              Contexto: período seleccionado en el filtro global (
              {businessContext.period.label}).{" "}
              <span className="tabular-nums">
                {input.length}/{MAX_QUESTION}
              </span>
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading || !input.trim()}
              leftIcon={
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden />
                )
              }
            >
              {loading ? "Analizando…" : "Analizar"}
            </Button>
          </div>
        </form>

        {error ? (
          <p
            className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger-soft)_40%,var(--surface))] px-3 py-2 text-[12.5px] text-[var(--danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
          <MessageSquareText
            className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80"
            aria-hidden
          />
          El historial se mantiene solo en esta pestaña hasta que recargues la
          página o limpies el historial. Los números provienen del motor local;
          la IA solo los interpreta.
        </p>
      </CardContent>
    </Card>
  );
}
