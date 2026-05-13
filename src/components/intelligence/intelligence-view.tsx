"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Compass,
  Flag,
  Gauge,
  LineChart,
  ShieldAlert,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useAppData } from "@/contexts/data-context";
import { usePeriod } from "@/contexts/period-context";
import { formatCurrency, formatPercent } from "@/lib/format";
import { buildIntelligenceReport } from "@/lib/intelligence";
import type {
  Insight,
  IntelligenceReport,
} from "@/lib/intelligence/types";
import { InsightCard } from "./insight-card";
import { HealthRing } from "./health-ring";

const presetLabels: Record<string, string> = {
  hoy: "Hoy",
  esta_semana: "Esta semana",
  este_mes: "Este mes",
  este_año: "Este año",
  año_anterior: "Año anterior",
  personalizado: "Período personalizado",
};

const categoryDefs = [
  { id: "all", label: "Resumen", icon: <Compass className="h-3.5 w-3.5" /> },
  {
    id: "riesgo",
    label: "Riesgos",
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
  {
    id: "oportunidad",
    label: "Oportunidades",
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
  {
    id: "financiero",
    label: "Financiero",
    icon: <Wallet className="h-3.5 w-3.5" />,
  },
  {
    id: "operativo",
    label: "Operativo",
    icon: <Gauge className="h-3.5 w-3.5" />,
  },
  {
    id: "comercial",
    label: "Comercial",
    icon: <LineChart className="h-3.5 w-3.5" />,
  },
] as const;

type CategoryId = (typeof categoryDefs)[number]["id"];

const subScoreIcon: Record<string, React.ReactNode> = {
  rentabilidad: <Wallet className="h-3.5 w-3.5" />,
  crecimiento: <LineChart className="h-3.5 w-3.5" />,
  eficiencia: <Gauge className="h-3.5 w-3.5" />,
  stock: <Target className="h-3.5 w-3.5" />,
  diversificacion: <Compass className="h-3.5 w-3.5" />,
  estabilidad: <Flag className="h-3.5 w-3.5" />,
};

export function IntelligenceView() {
  const { data } = useAppData();
  const { range, preset } = usePeriod();
  const [tab, setTab] = useState<CategoryId>("all");

  const report = useMemo<IntelligenceReport>(
    () =>
      buildIntelligenceReport(data, {
        period: range,
        periodLabel: presetLabels[preset] ?? "Período seleccionado",
      }),
    [data, range, preset],
  );

  const filteredInsights: Insight[] = useMemo(() => {
    if (tab === "all") {
      // Resumen: mostrar lo más importante (max 6) priorizando severidad.
      return report.insights.slice(0, 6);
    }
    return report.insights.filter((i) => i.category === tab);
  }, [report.insights, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: report.insights.length,
      riesgo: 0,
      oportunidad: 0,
      financiero: 0,
      operativo: 0,
      comercial: 0,
    };
    for (const i of report.insights) {
      c[i.category] = (c[i.category] ?? 0) + 1;
    }
    return c;
  }, [report.insights]);

  const tabsItems: TabItem[] = categoryDefs.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    badge:
      counts[c.id] > 0 ? (
        <span className="rounded-full bg-[var(--surface-muted)] px-1.5 text-[10.5px] font-medium tabular-nums text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]">
          {counts[c.id]}
        </span>
      ) : undefined,
  }));

  const dateLabel = new Date(report.context.generatedAt).toLocaleDateString(
    "es-AR",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <div className="space-y-10 pb-8">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="space-y-6 animate-rise">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">
            <Brain className="h-3.5 w-3.5" aria-hidden />
            Inteligencia del negocio · {report.context.period.label}
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[32px]">
            Centro de análisis ejecutivo
          </h1>
          <p className="max-w-3xl text-[13.5px] text-[var(--foreground-muted)]">
            Un análisis profundo y automático del estado del negocio: salud
            financiera, eficiencia operativa, dinámica comercial, riesgos y
            oportunidades. Generado el {dateLabel}.
          </p>
        </div>

        <Card variant="elevated">
          <div className="grid gap-6 p-6 lg:grid-cols-[auto_1fr] lg:p-8">
            <div className="flex flex-col items-center justify-center gap-3 lg:items-start">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                Salud del negocio
              </p>
              <HealthRing
                score={report.health.score}
                grade={report.health.grade}
              />
              <div className="flex flex-col items-center gap-1 lg:items-start">
                <p className="text-[15.5px] font-semibold capitalize tracking-tight text-[var(--foreground-strong)]">
                  {report.health.grade}
                </p>
                {report.health.delta !== 0 ? (
                  <Badge
                    tone={report.health.delta >= 0 ? "positive" : "warning"}
                  >
                    {report.health.delta >= 0 ? "+" : ""}
                    {report.health.delta} pts vs período comparativo
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {report.health.components.map((c) => (
                <SubScoreCell key={c.id} c={c} />
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* ── Resumen ejecutivo ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Resumen ejecutivo"
          title="Lectura del negocio en una página"
          description="Síntesis interpretativa basada en datos del período. Lo que sucedió, qué empuja y qué presiona, y a dónde prestar atención."
        />
        <Card>
          <CardContent className="space-y-4">
            {report.summary.paragraphs.map((p, idx) => (
              <p
                key={idx}
                className="text-[13.5px] leading-relaxed text-[var(--foreground)]"
              >
                {p}
              </p>
            ))}
            {report.summary.highlights.length > 0 ? (
              <ul className="mt-2 grid gap-2 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">
                {report.summary.highlights.map((h, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-[12.5px] text-[var(--foreground-muted)]"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* ── KPIs análiticos rápidos ───────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiRow
          eyebrow="Ingresos"
          value={formatCurrency(report.kpis.revenue)}
          delta={report.kpis.revenueDeltaPct}
          deltaLabel="vs período comparativo"
        />
        <KpiRow
          eyebrow="Margen neto"
          value={formatPercent(report.kpis.netMarginPct)}
          deltaLabel="Resultado proyectado"
          extra={formatCurrency(report.kpis.netProfit)}
        />
        <KpiRow
          eyebrow="Gastos del período"
          value={formatCurrency(report.kpis.expenses)}
          delta={report.kpis.expensesDeltaPct}
          deltaLabel="vs período comparativo"
          invertedDelta
        />
        <KpiRow
          eyebrow="Ticket promedio"
          value={formatCurrency(report.kpis.avgTicket)}
          delta={
            report.kpis.avgTicketPrev > 0
              ? ((report.kpis.avgTicket - report.kpis.avgTicketPrev) /
                  report.kpis.avgTicketPrev) *
                100
              : undefined
          }
          deltaLabel="vs período comparativo"
        />
      </section>

      {/* ── Insights por categoría ────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Insights detectados"
          title="Diagnóstico por categoría"
          description="Análisis profundo organizado por tipo. Cada insight combina interpretación cualitativa, métricas duras y recomendación accionable."
        />
        <div className="overflow-x-auto pb-1">
          <Tabs
            items={tabsItems}
            active={tab}
            onChange={(id) => setTab(id as CategoryId)}
          />
        </div>
        {filteredInsights.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Sparkles className="h-4 w-4" aria-hidden />}
                title="Sin señales relevantes"
                description={
                  tab === "all"
                    ? "El período se ve dentro de parámetros normales: no se detectaron oportunidades ni riesgos destacados."
                    : "No se detectaron señales en esta categoría para el período actual."
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredInsights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        )}
      </section>

      {/* ── Recomendaciones ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Plan de acción"
          title="Recomendaciones priorizadas"
          description="Acciones concretas ordenadas por prioridad. Cada acción se apoya en uno o varios insights detectados arriba."
        />
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-[var(--border-subtle)]">
              {report.recommendations.map((rec, idx) => (
                <li
                  key={rec.id}
                  className="flex items-start gap-4 px-5 py-4 sm:px-6"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[11.5px] font-semibold tabular-nums text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          rec.priority === "alta"
                            ? "danger"
                            : rec.priority === "media"
                              ? "warning"
                              : "muted"
                        }
                      >
                        Prioridad {rec.priority}
                      </Badge>
                      <Badge tone="muted">
                        {categoryDefs.find((c) => c.id === rec.category)
                          ?.label ?? rec.category}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[13.5px] font-medium tracking-tight text-[var(--foreground-strong)]">
                      {rec.title}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
                      {rec.rationale}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* ── Preguntas para explorar ───────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Preguntas guía"
          title="Hipótesis para explorar tu negocio"
          description="Estas son las preguntas que un consultor experto haría al revisar tus números esta semana."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {report.explorationQuestions.map((q) => (
            <Card key={q.id} variant="interactive">
              <CardContent>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <Badge tone="muted">
                      {categoryDefs.find((c) => c.id === q.category)?.label ??
                        q.category}
                    </Badge>
                    <p className="mt-2 text-[13.5px] font-semibold tracking-tight text-[var(--foreground-strong)]">
                      {q.title}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
                      {q.rationale}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card>
          <CardHeader
            eyebrow="Mix por categoría · período actual"
            title="Composición de ingresos y margen"
            subtitle="Cómo se reparten los ingresos del catálogo y qué tan rentable es cada categoría."
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--surface-muted)] text-[var(--foreground-muted)]">
                  <tr>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] sm:px-6">
                      Categoría
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Ingresos
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Unidades
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Margen bruto
                    </th>
                    <th className="px-3 py-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] sm:pr-6">
                      Margen %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {report.categoryMix
                    .filter((c) => c.revenue > 0 || c.units > 0)
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((c) => (
                      <tr key={c.category}>
                        <td className="px-5 py-2.5 sm:px-6">
                          <span className="font-medium text-[var(--foreground-strong)]">
                            {c.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(c.revenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[var(--foreground-muted)]">
                          {c.units}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(c.grossProfit)}
                        </td>
                        <td
                          className={`px-3 py-2.5 pr-5 text-right font-semibold tabular-nums sm:pr-6 ${
                            c.grossMarginPct >= 35
                              ? "text-[var(--success)]"
                              : c.grossMarginPct >= 15
                                ? "text-[var(--foreground-strong)]"
                                : "text-[var(--warning)]"
                          }`}
                        >
                          {formatPercent(c.grossMarginPct)}
                        </td>
                      </tr>
                    ))}
                  {report.categoryMix.every((c) => c.revenue === 0) ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-[12.5px] text-[var(--foreground-muted)]"
                      >
                        Sin movimientos comerciales para componer el mix del
                        período.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SubScoreCell({
  c,
}: {
  c: IntelligenceReport["health"]["components"][number];
}) {
  const tone =
    c.score >= 70
      ? "positive"
      : c.score >= 50
        ? "neutral"
        : c.score >= 35
          ? "warning"
          : "danger";
  const barColor =
    tone === "positive"
      ? "bg-[var(--success)]"
      : tone === "warning"
        ? "bg-[var(--warning)]"
        : tone === "danger"
          ? "bg-[var(--danger)]"
          : "bg-[var(--accent)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">
          <span className="text-[var(--foreground-muted)]">
            {subScoreIcon[c.id]}
          </span>
          {c.label}
        </span>
        <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--foreground-strong)]">
          {c.score}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${barColor}`}
          style={{ width: `${Math.max(2, Math.min(100, c.score))}%` }}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-[var(--foreground-muted)]">
        {c.rationale}
      </p>
    </div>
  );
}

function KpiRow({
  eyebrow,
  value,
  delta,
  deltaLabel,
  extra,
  invertedDelta,
}: {
  eyebrow: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  extra?: string;
  invertedDelta?: boolean;
}) {
  const positive =
    delta === undefined
      ? undefined
      : invertedDelta
        ? delta <= 0
        : delta >= 0;
  return (
    <Card>
      <CardContent>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
          {eyebrow}
        </p>
        <p className="mt-2 text-[24px] font-semibold tabular-nums tracking-tight text-[var(--foreground-strong)]">
          {value}
        </p>
        {extra ? (
          <p className="mt-0.5 text-[12px] text-[var(--foreground-muted)]">
            {extra}
          </p>
        ) : null}
        {delta !== undefined ? (
          <p
            className={`mt-3 text-[12px] font-medium tabular-nums ${
              positive === undefined
                ? "text-[var(--foreground-muted)]"
                : positive
                  ? "text-[var(--success)]"
                  : "text-[var(--warning)]"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} %{deltaLabel ? ` · ${deltaLabel}` : ""}
          </p>
        ) : deltaLabel ? (
          <p className="mt-3 text-[12px] text-[var(--foreground-muted)]">
            {deltaLabel}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
