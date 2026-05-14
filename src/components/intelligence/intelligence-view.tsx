"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
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
  desde_operacion: "Desde inicio operativo",
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

function financialStatePresentation(k: IntelligenceReport["kpis"]): {
  label: string;
  body: string;
  tone: "danger" | "warning" | "neutral" | "positive";
} {
  if (k.revenue <= 0) {
    return {
      label: "Sin actividad comercial",
      body: "No hay ingresos en el período: el estado financiero no es evaluable.",
      tone: "neutral",
    };
  }
  if (k.netProfit < 0 && k.netMarginPct < -8) {
    return {
      label: "Estado financiero crítico",
      body: `Pérdida neta de ${formatCurrency(Math.abs(k.netProfit))} con margen neto ${formatPercent(k.netMarginPct)}. El Health Score no reemplaza este diagnóstico.`,
      tone: "danger",
    };
  }
  if (k.netProfit < 0) {
    return {
      label: "Estado financiero: en pérdida",
      body: `Resultado neto negativo (${formatCurrency(k.netProfit)}). Aun con fortalezas operativas, el cierre del período es adverso.`,
      tone: "danger",
    };
  }
  if (k.netMarginPct < 4) {
    return {
      label: "Estado financiero: ajustado",
      body: `Margen neto ${formatPercent(k.netMarginPct)}. Resultado positivo con poca holgura frente a shocks de costos o ventas.`,
      tone: "warning",
    };
  }
  return {
    label: "Estado financiero: sano",
    body: `Resultado neto ${formatCurrency(k.netProfit)} y margen neto ${formatPercent(k.netMarginPct)} sobre ingresos de ${formatCurrency(k.revenue)}.`,
    tone: "positive",
  };
}

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

  const priorityInsights = useMemo(
    () => report.insights.slice(0, 3),
    [report.insights],
  );

  const filteredInsights: Insight[] = useMemo(() => {
    if (tab === "all") {
      return report.insights.slice(3);
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

  const finState = financialStatePresentation(report.kpis);

  const dateLabel = new Date(report.context.generatedAt).toLocaleDateString(
    "es-AR",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <div className="space-y-8 pb-8">
      {/* ── Núcleo estratégico: salud vs estado financiero ─────────────── */}
      <section className="space-y-6 animate-rise">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">
            <Brain className="h-3.5 w-3.5" aria-hidden />
            Inteligencia del negocio · {report.context.period.label}
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[34px]">
            Centro de decisiones empresariales
          </h1>
          <p className="max-w-3xl text-[13.5px] leading-relaxed text-[var(--foreground-muted)]">
            Capa analítica sobre tus datos: riesgos, oportunidades y lectura
            financiera. El Health Score resume dinámica amplia; el estado
            financiero refleja el cierre del período. Generado el {dateLabel}.
          </p>
        </div>

        <Card variant="elevated" className="overflow-hidden">
          <div className="grid gap-8 p-6 lg:grid-cols-12 lg:p-9">
            <div className="flex flex-col items-center gap-4 border-b border-[var(--border-subtle)] pb-8 lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">
                Health score (dinámica global)
              </p>
              <HealthRing
                score={report.health.score}
                grade={report.health.grade}
                size={188}
              />
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-[16px] font-semibold capitalize tracking-tight text-[var(--foreground-strong)]">
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
                <p className="max-w-xs text-[11.5px] leading-snug text-[var(--foreground-muted)]">
                  Composición multi-dimensional (rentabilidad, eficiencia,
                  stock, etc.). No equivale al resultado neto del período.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-5 lg:col-span-7">
              <div
                className={`rounded-2xl border px-5 py-4 sm:px-6 ${
                  finState.tone === "danger"
                    ? "border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger-soft)_50%,var(--surface))]"
                    : finState.tone === "warning"
                      ? "border-[color-mix(in_oklab,var(--warning)_38%,transparent)] bg-[color-mix(in_oklab,var(--warning-soft)_40%,var(--surface))]"
                      : finState.tone === "positive"
                        ? "border-[color-mix(in_oklab,var(--success)_35%,transparent)] bg-[color-mix(in_oklab,var(--success-soft)_35%,var(--surface))]"
                        : "border-[var(--border)] bg-[var(--surface-muted)]"
                }`}
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                  Estado financiero del período
                </p>
                <p className="mt-2 text-[17px] font-semibold tracking-tight text-[var(--foreground-strong)]">
                  {finState.label}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--foreground)]">
                  {finState.body}
                </p>
              </div>

              <div>
                <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                  Desglose del score
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {report.health.components.map((c) => (
                    <SubScoreCell key={c.id} c={c} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ── 3 prioridades ejecutivas ───────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Prioridad inmediata"
          title="Las tres señales más importantes"
          description="Foco ejecutivo: solo lo que más impacta el negocio ahora. El resto del análisis está debajo, por categoría."
        />
        {priorityInsights.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Sparkles className="h-4 w-4" aria-hidden />}
                title="Sin señales prioritarias"
                description="El período no arrojó alertas destacadas según los detectores actuales."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {priorityInsights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        )}
      </section>

      {/* ── Resumen ejecutivo ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Entender el estado"
          title="Resumen ejecutivo"
          description="Síntesis cualitativa. Para números duros usá los KPI de abajo y el dashboard principal."
        />
        <Card>
          <CardContent className="space-y-4 p-6 sm:p-7">
            {report.summary.paragraphs[0] ? (
              <p className="text-[15px] font-medium leading-relaxed text-[var(--foreground-strong)]">
                {report.summary.paragraphs[0]}
              </p>
            ) : null}
            {report.summary.paragraphs.length > 1 ? (
              <details className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                <summary className="cursor-pointer text-[12.5px] font-semibold text-[var(--foreground)] outline-none">
                  Más contexto
                  <span className="ml-1 text-[var(--foreground-muted)]">({report.summary.paragraphs.length - 1} párrafos)</span>
                </summary>
                <div className="mt-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
                  {report.summary.paragraphs.slice(1).map((p, idx) => (
                    <p
                      key={idx}
                      className="text-[13px] leading-relaxed text-[var(--foreground-muted)]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </details>
            ) : null}
            {report.summary.highlights.length > 0 ? (
              <ul className="mt-2 grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">
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

      {/* ── KPIs críticos (solo 3) ────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <KpiRow
          eyebrow="Resultado neto (proyectado)"
          value={formatCurrency(report.kpis.netProfit)}
          deltaLabel={`Margen neto ${formatPercent(report.kpis.netMarginPct)}`}
        />
        <KpiRow
          eyebrow="Ingresos del período"
          value={formatCurrency(report.kpis.revenue)}
          delta={report.kpis.revenueDeltaPct}
          deltaLabel="vs período comparativo"
        />
        <KpiRow
          eyebrow="Gastos (proyectados)"
          value={formatCurrency(report.kpis.expenses)}
          delta={report.kpis.expensesDeltaPct}
          deltaLabel="vs período comparativo"
          invertedDelta
        />
      </section>

      {/* ── Analizar: insights por categoría ───────────────────────────── */}
      <section className="space-y-5">
        <SectionHeader
          eyebrow="Profundizar"
          title="Diagnóstico por categoría"
          description={
            tab === "all"
              ? "Señales adicionales después de las tres prioridades superiores. Usá las pestañas para filtrar por tipo."
              : "Insights filtrados por categoría. Cada tarjeta combina interpretación, métricas y recomendación."
          }
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
                title="Sin señales adicionales"
                description={
                  tab === "all"
                    ? report.insights.length <= 3
                      ? "Las pocas señales del período ya están arriba como prioridades. Cambiá el período o revisá otras secciones para más detalle."
                      : "No hay más insights después de las tres prioridades: el resto del período se ve dentro de parámetros habituales."
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

      <section className="space-y-4 pt-2">
        <Card>
          <CardHeader
            eyebrow="Mix por categoría · período actual"
            title="Composición de ingresos y margen"
            subtitle="Cómo se reparten los ingresos del catálogo y qué tan rentable es cada categoría."
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto px-1 pb-1 pt-1">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--surface-muted)] text-[var(--foreground-muted)]">
                  <tr>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] sm:px-6">
                      Categoría
                    </th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Ingresos
                    </th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Unidades
                    </th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Margen bruto
                    </th>
                    <th className="px-4 py-3.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] sm:pr-6">
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
                        <td className="px-5 py-3 sm:px-6">
                          <span className="font-medium text-[var(--foreground-strong)]">
                            {c.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(c.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground-muted)]">
                          {c.units}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(c.grossProfit)}
                        </td>
                        <td
                          className={`px-4 py-3 pr-5 text-right font-semibold tabular-nums sm:pr-6 ${
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_oklab,var(--accent)_32%,var(--border))] hover:shadow-[var(--shadow-sm)]">
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
