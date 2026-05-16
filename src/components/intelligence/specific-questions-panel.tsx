"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { Loader2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BusinessContextForAI } from "@/lib/intelligence/ai-business-context";

const MAX_QUESTION = 1_500;

const SUGGESTED = [
  "¿Por qué estoy perdiendo plata?",
  "¿Qué cambió este período?",
  "¿Dónde estoy gastando más?",
  "¿Qué producto afecta más mi rentabilidad?",
  "¿Qué debería revisar primero?",
  "¿Qué riesgo financiero ves?",
] as const;

type ApiErr = { error?: string; message?: string };

export function SpecificQuestionsPanel({
  businessContext,
}: {
  businessContext: BusinessContextForAI;
}) {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const inFlight = useRef(false);

  const ask = useCallback(
    async (qRaw: string) => {
      const question = qRaw.trim();
      if (!question || inFlight.current) return;
      if (question.length > MAX_QUESTION) {
        setError(`La pregunta supera ${MAX_QUESTION} caracteres.`);
        return;
      }
      setError(null);
      setReply(null);
      inFlight.current = true;
      setLoading(true);
      try {
        const res = await fetch("/api/intelligence-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, businessContext }),
        });
        const data = (await res.json()) as { reply?: string } & ApiErr;
        if (!res.ok) {
          if (data.error === "missing_api_key") setMissingKey(true);
          setError(data.message ?? "No se pudo obtener respuesta.");
          return;
        }
        const text = typeof data.reply === "string" ? data.reply.trim() : "";
        if (!text) {
          setError("Respuesta vacía.");
          return;
        }
        setReply(text);
      } catch {
        setError("Error de red.");
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [businessContext],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void ask(input);
    },
    [ask, input],
  );

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardContent className="space-y-5 p-6 sm:p-7">
        <div className="border-b border-[var(--border-subtle)] pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            Complemento analítico
          </p>
          <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-[var(--foreground-strong)]">
            Preguntas específicas
          </h3>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
            Consultas puntuales sobre el período actual. La respuesta se muestra como nota analítica,
            no como conversación.
          </p>
        </div>

        {missingKey ? (
          <div
            className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning-soft)_45%,var(--surface))] px-4 py-3 text-[12.5px] text-[var(--foreground-muted)]"
            role="status"
          >
            Configurá{" "}
            <code className="rounded bg-[var(--surface-muted)] px-1 text-[11px]">
              OPENAI_API_KEY
            </code>{" "}
            en el servidor para usar esta función.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => {
                setInput(q);
                void ask(q);
              }}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-left text-[11.5px] font-medium leading-snug text-[var(--foreground-muted)] transition hover:border-[var(--border)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="sr-only">Pregunta</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_QUESTION}
              rows={3}
              disabled={loading}
              placeholder="Formulá una pregunta concreta…"
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-subtle)] focus:border-[var(--foreground-muted)] disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] tabular-nums text-[var(--foreground-subtle)]">
              {input.length}/{MAX_QUESTION}
            </span>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={loading || !input.trim()}
              leftIcon={
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )
              }
            >
              {loading ? "Consultando…" : "Preguntar"}
            </Button>
          </div>
        </form>

        {reply ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/35 p-5 shadow-inner">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
              Respuesta analítica
            </p>
            <div className="mt-3 border-l-2 border-[var(--accent)] pl-4">
              <p className="text-[13px] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
                {reply}
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <p
            className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger-soft)_40%,var(--surface))] px-3 py-2 text-[12.5px] text-[var(--danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
