"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileBarChart,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BusinessContextForAI } from "@/lib/intelligence/ai-business-context";
import type { ExecutiveAnalysisSections } from "@/lib/intelligence/executive-analysis-types";

const SECTION_META: {
  key: keyof ExecutiveAnalysisSections;
  title: string;
  eyebrow: string;
}[] = [
  { key: "estado_general", title: "Estado general", eyebrow: "Panorama" },
  { key: "lectura_financiera", title: "Lectura financiera", eyebrow: "Cierre del período" },
  { key: "que_funciona", title: "Qué está funcionando", eyebrow: "Fortalezas" },
  {
    key: "problemas_principales",
    title: "Problemas principales",
    eyebrow: "Presión a la rentabilidad",
  },
  { key: "riesgos", title: "Riesgos", eyebrow: "Vigilancia" },
  { key: "oportunidades", title: "Oportunidades", eyebrow: "En datos" },
  {
    key: "prioridades_de_accion",
    title: "Prioridades de acción",
    eyebrow: "Orden sugerido",
  },
  {
    key: "conclusion_ejecutiva",
    title: "Conclusión ejecutiva",
    eyebrow: "Cierre",
  },
];

function SectionBody({ value }: { value: string | string[] }) {
  if (typeof value === "string") {
    return (
      <p className="text-[13px] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
        {value}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {value.map((line, i) => (
        <li
          key={i}
          className="flex gap-2 text-[13px] leading-relaxed text-[var(--foreground)]"
        >
          <span
            aria-hidden
            className="mt-2 h-px w-3 shrink-0 bg-[var(--foreground-muted)] opacity-60"
          />
          <span className="min-w-0 whitespace-pre-wrap">{line}</span>
        </li>
      ))}
    </ul>
  );
}

type ApiErr = { error?: string; message?: string };

export function ExecutiveAnalysisPanel({
  businessContext,
}: {
  businessContext: BusinessContextForAI;
}) {
  const [analysis, setAnalysis] = useState<ExecutiveAnalysisSections | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const inFlight = useRef(false);

  const runAnalysis = useCallback(async () => {
    if (inFlight.current) return;
    setError(null);
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence-executive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessContext }),
      });
      const data = (await res.json()) as { analysis?: ExecutiveAnalysisSections } & ApiErr;
      if (!res.ok) {
        if (data.error === "missing_api_key") setMissingKey(true);
        setError(data.message ?? "No se pudo generar el análisis.");
        return;
      }
      if (!data.analysis) {
        setError("Respuesta incompleta del servidor.");
        return;
      }
      setAnalysis(data.analysis);
      setGeneratedAt(Date.now());
    } catch {
      setError("Error de red. Verificá la conexión.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [businessContext]);

  const fechaLabel =
    generatedAt != null
      ? new Date(generatedAt).toLocaleString("es-AR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardContent className="space-y-6 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
              <FileBarChart className="h-5 w-5 text-[var(--foreground-muted)]" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                Informe estructurado · período actual
              </p>
              <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-[var(--foreground-strong)]">
                Análisis ejecutivo IA
              </h3>
              <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
                Interpretación profesional sobre el mismo contexto que el motor de inteligencia.
                No sustituye asesoramiento contable ni legal.
              </p>
              {fechaLabel ? (
                <p className="mt-2 text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                  Generado: {fechaLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={loading}
                onClick={() => void runAnalysis()}
                leftIcon={
                  loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )
                }
              >
                Regenerar análisis
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={loading}
                onClick={() => void runAnalysis()}
                leftIcon={
                  loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden />
                  )
                }
              >
                Generar análisis ejecutivo
              </Button>
            )}
          </div>
        </div>

        {missingKey ? (
          <div
            className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning-soft)_45%,var(--surface))] px-4 py-3 text-[13px]"
            role="status"
          >
            <p className="font-semibold text-[var(--foreground-strong)]">
              OPENAI_API_KEY no configurada
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
              Variable solo servidor:{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[11px]">
                OPENAI_API_KEY
              </code>{" "}
              en .env.local o Vercel (sin{" "}
              <code className="text-[11px]">NEXT_PUBLIC_</code>).
            </p>
          </div>
        ) : null}

        {loading && !analysis ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 px-4 py-6">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--foreground-muted)]" />
            <div>
              <p className="text-[13px] font-medium text-[var(--foreground-strong)]">
                Generando informe…
              </p>
              <p className="text-[12px] text-[var(--foreground-muted)]">
                Analizando métricas, insights y series del período seleccionado.
              </p>
            </div>
          </div>
        ) : null}

        {loading && analysis ? (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--foreground-muted)]">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Actualizando informe…
          </div>
        ) : null}

        {analysis ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {SECTION_META.map(({ key, title, eyebrow }) => (
              <article
                key={key}
                className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5 ${
                  key === "conclusion_ejecutiva" ? "lg:col-span-2" : ""
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
                  {eyebrow}
                </p>
                <h4 className="mt-1 text-[14px] font-semibold text-[var(--foreground-strong)]">
                  {title}
                </h4>
                <div className="mt-3">
                  <SectionBody value={analysis[key]} />
                </div>
              </article>
            ))}
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
