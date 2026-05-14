"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CircleDollarSign,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { useAppData } from "@/contexts/data-context";
import { useChartColors } from "@/contexts/theme-context";
import { usePeriod } from "@/contexts/period-context";
import {
  compareToPreviousYear,
  monthPreviousRange,
  monthlyChartSeriesThroughCurrentMonth,
  periodMetricsWithProjections,
} from "@/lib/data/finance-calcs";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useAuth } from "@/contexts/auth-context";

function pctDeltaOrNull(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function hasPeriodActivity(
  x: ReturnType<typeof periodMetricsWithProjections>,
): boolean {
  return (
    x.revenue > 0 ||
    x.saleCount > 0 ||
    x.cogsSales > 0 ||
    x.expensesProjected > 0 ||
    x.defectiveLoss > 0
  );
}

function estadoFinancieroHeadline(
  risk: ReturnType<typeof financeRiskPresentation>,
): string {
  if (risk.label === "Crítico") return "Crítico";
  if (risk.label === "En pérdida" || risk.label === "Presión alta")
    return "Atención";
  if (risk.label === "Sin actividad") return "Sin datos";
  return "Estable";
}

function estadoHeadlineClass(headline: string): string {
  if (headline === "Crítico") return "text-[var(--danger)]";
  if (headline === "Atención") return "text-[var(--warning)]";
  if (headline === "Sin datos") return "text-[var(--foreground-muted)]";
  return "text-[var(--foreground-strong)]";
}

function trendHeadlineClass(headline: string): string {
  if (headline === "Negativa") return "text-[var(--danger)]";
  if (headline === "Positiva") return "text-[var(--success)]";
  return "text-[var(--foreground-strong)]";
}

function financeRiskPresentation(
  m: ReturnType<typeof periodMetricsWithProjections>,
): { label: string; hint: string; accent: "neutral" | "warning" | "negative" } {
  if (m.revenue <= 0 && m.saleCount === 0) {
    return {
      label: "Sin actividad",
      hint: "Registrá ventas para evaluar riesgo financiero.",
      accent: "neutral",
    };
  }
  if (m.netProfitProjected < 0 && m.marginPctProjected < -8) {
    return {
      label: "Crítico",
      hint: "Pérdida neta profunda frente a los ingresos del período.",
      accent: "negative",
    };
  }
  if (m.netProfitProjected < 0) {
    return {
      label: "En pérdida",
      hint: "Los gastos y costos superan el margen disponible.",
      accent: "negative",
    };
  }
  if (m.marginPctProjected < 3) {
    return {
      label: "Presión alta",
      hint: "Margen neto muy ajustado; poca holgura ante shocks.",
      accent: "warning",
    };
  }
  if (m.marginPctProjected < 10) {
    return {
      label: "Moderado",
      hint: "Resultado positivo con margen acotado.",
      accent: "neutral",
    };
  }
  return {
    label: "Controlado",
    hint: "Rentabilidad neta dentro de rangos sanos para el período.",
    accent: "neutral",
  };
}

const presetLabels: Record<string, string> = {
  desde_operacion: "histórico operativo",
  hoy: "hoy",
  esta_semana: "esta semana",
  este_mes: "este mes",
  este_año: "este año",
  año_anterior: "año anterior",
  personalizado: "rango personalizado",
};

function periodDescription(preset: string) {
  return presetLabels[preset] ?? "período seleccionado";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardView() {
  const { data } = useAppData();
  const { user } = useAuth();
  const { range, preset } = usePeriod();
  const chart = useChartColors();

  const firstName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string } | undefined;
    const raw =
      typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
    if (raw) {
      const part = raw.split(/\s+/)[0]?.trim();
      if (part) return part;
    }
    const em = user?.email?.split("@")[0]?.trim();
    return em && em.length > 0 ? em : "";
  }, [user]);

  const m = periodMetricsWithProjections(data, range);
  const yoyRange = compareToPreviousYear(range);
  const mYoy = periodMetricsWithProjections(data, yoyRange);

  const prevMonthRange = monthPreviousRange(range);
  const mPrevMonth = periodMetricsWithProjections(data, prevMonthRange);

  const yoyComparable = hasPeriodActivity(mYoy);
  const momComparable = hasPeriodActivity(mPrevMonth);

  const totalEgresos =
    m.cogsSales + m.expensesProjected + m.defectiveLoss;

  const revenueMomDelta =
    preset === "este_mes" && momComparable
      ? pctDeltaOrNull(m.revenue, mPrevMonth.revenue)
      : null;
  const revenueYoyDelta = yoyComparable
    ? pctDeltaOrNull(m.revenue, mYoy.revenue)
    : null;

  const netMomDelta =
    preset === "este_mes" && momComparable
      ? pctDeltaOrNull(m.netProfitProjected, mPrevMonth.netProfitProjected)
      : null;
  const netYoyDelta = yoyComparable
    ? pctDeltaOrNull(m.netProfitProjected, mYoy.netProfitProjected)
    : null;

  const year = new Date().getFullYear();

  const monthlyChart = useMemo(
    () =>
      monthlyChartSeriesThroughCurrentMonth(data, year, new Date()),
    [data, year],
  );

  const chartNetMonthly = monthlyChart.map((row) => ({
    name: row.name,
    "Ganancia neta": row["Ganancia neta"],
  }));

  const chartIngresosEgresos = monthlyChart.map((row) => ({
    name: row.name,
    Ingresos: row.Ingresos,
    Egresos: row.Egresos,
  }));

  const chartEgresosBreakdown = monthlyChart.map((row) => ({
    name: row.name,
    COGS: row.COGS,
    Gastos: row.Gastos,
    Defectuosos: row.Defectuosos,
  }));

  const sparkSlice = monthlyChart.slice(Math.max(0, monthlyChart.length - 7));
  const sparkRevenue = sparkSlice.map((r) => r.Ingresos);
  const sparkEgresos = sparkSlice.map((r) => r.Egresos);
  const sparkNet = sparkSlice.map((r) => r["Ganancia neta"]);

  const trendPanel = useMemo(() => {
    const nets = monthlyChart.map((r) => r["Ganancia neta"]);
    const negCount = nets.filter((n) => n < 0).length;
    const lastNet = nets[nets.length - 1] ?? 0;

    if (m.revenue <= 0 && m.saleCount === 0) {
      return {
        headline: "Estable" as const,
        hint: "Sin ventas en el período no hay pendiente mensual que comparar.",
      };
    }
    if (nets.length < 2) {
      return {
        headline: "Estable" as const,
        hint: "Agregá más meses con actividad para leer la pendiente con confianza.",
      };
    }
    if (negCount >= 3) {
      return {
        headline: "Negativa" as const,
        hint: `${negCount} de los últimos ${nets.length} meses con resultado neto negativo.`,
      };
    }
    if (lastNet < 0) {
      return {
        headline: "Negativa" as const,
        hint: "El último mes de la serie cierra con resultado neto en rojo.",
      };
    }
    if (negCount === 0) {
      return {
        headline: "Positiva" as const,
        hint: "Resultados netos mensuales sostenidos en positivo.",
      };
    }
    return {
      headline: "Estable" as const,
      hint: "Mezcla de meses positivos y ajustes; conviene vigilar el margen.",
    };
  }, [monthlyChart, m.revenue, m.saleCount]);

  const risk = financeRiskPresentation(m);
  const periodLabel = periodDescription(preset);

  const nowMonthIdx = new Date().getMonth();
  const lastNetForChart =
    monthlyChart.find((r) => r.month === nowMonthIdx + 1)?.[
      "Ganancia neta"
    ] ?? monthlyChart[monthlyChart.length - 1]?.["Ganancia neta"] ?? 0;
  const netLineStroke =
    lastNetForChart >= 0 ? chart.linePositive : chart.lineNegative;

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-10">
      <header className="animate-rise space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Inicio · período {periodLabel}
            </p>
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[24px]">
              {firstName
                ? `${greeting()}, ${firstName}.`
                : `${greeting()}.`}
            </h1>
            <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--foreground-muted)]">
              Resumen financiero del negocio: entradas, salidas y resultado.
            </p>
          </div>
          <Link
            href="/inteligencia"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            Ver resumen ejecutivo
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>
      </header>

      {/* KPIs: Ingresos · Egresos · Resultado */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatCard
            label="Ingresos"
            size="hero"
            value={formatCurrency(m.revenue)}
            hint={`${m.saleCount} ventas · ${Math.round(m.unitsSold)} uds.`}
            icon={<CircleDollarSign className="h-4 w-4" aria-hidden />}
            accent="info"
            countUpAmount={m.revenue}
            formatCountUp={(n) => formatCurrency(n)}
            sparkline={sparkRevenue.length > 1 ? sparkRevenue : undefined}
            sparklineTone="info"
            delta={
              preset === "este_mes" &&
              momComparable &&
              revenueMomDelta !== null
                ? {
                    value: revenueMomDelta,
                    label: "vs mes anterior",
                    neutralOnZero: true,
                  }
                : yoyComparable && revenueYoyDelta !== null
                  ? {
                      value: revenueYoyDelta,
                      label: "vs año anterior",
                      neutralOnZero: true,
                    }
                  : undefined
            }
          />
          <StatCard
            label="Egresos totales"
            size="hero"
            value={formatCurrency(totalEgresos)}
            hint={`COGS ${formatCurrency(m.cogsSales)} · Gastos ${formatCurrency(m.expensesProjected)} · Defectuosos ${formatCurrency(m.defectiveLoss)}`}
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            accent={
              m.revenue > 0 && totalEgresos / m.revenue > 0.85
                ? "negative"
                : m.revenue > 0 && totalEgresos / m.revenue > 0.65
                  ? "warning"
                  : "neutral"
            }
            countUpAmount={totalEgresos}
            formatCountUp={(n) => formatCurrency(n)}
            sparkline={sparkEgresos.length > 1 ? sparkEgresos : undefined}
            sparklineTone="muted"
          />
          <StatCard
            label="Resultado final"
            size="hero"
            prominence="primary"
            value={formatCurrency(m.netProfitProjected)}
            hint={`Margen neto ${formatPercent(m.marginPctProjected)} sobre ingresos`}
            icon={
              m.netProfitProjected >= 0 ? (
                <TrendingUp className="h-4 w-4" aria-hidden />
              ) : (
                <TrendingDown className="h-4 w-4" aria-hidden />
              )
            }
            accent={m.netProfitProjected >= 0 ? "positive" : "negative"}
            financialStress="none"
            countUpAmount={m.netProfitProjected}
            formatCountUp={(n) => formatCurrency(n)}
            sparkline={sparkNet.length > 1 ? sparkNet : undefined}
            sparklineTone={
              (sparkNet[sparkNet.length - 1] ?? 0) >= 0
                ? "positive"
                : "negative"
            }
            delta={
              preset === "este_mes" && momComparable && netMomDelta !== null
                ? {
                    value: netMomDelta,
                    label: "vs mes anterior",
                    neutralOnZero: true,
                  }
                : yoyComparable && netYoyDelta !== null
                  ? {
                      value: netYoyDelta,
                      label: "vs año anterior",
                      neutralOnZero: true,
                    }
                  : undefined
            }
          />
        </div>
        <p className="text-[11.5px] leading-snug text-[var(--foreground-muted)]">
          Bruto {formatCurrency(m.grossProfit)} · Operativo{" "}
          {formatCurrency(m.operatingProfitProjected)} (
          {formatPercent(m.operatingMarginPctProjected)})
        </p>
      </section>

      {/* Estado + tendencia */}
      <Card className="overflow-hidden bg-[var(--surface)] ring-1 ring-inset ring-[var(--border-subtle)]">
        <CardContent className="p-5 sm:p-6">
          <div className="grid gap-6 md:grid-cols-2 md:gap-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
                Estado financiero
              </p>
              <p
                className={`mt-2 text-[20px] font-semibold tracking-tight sm:text-[22px] ${estadoHeadlineClass(estadoFinancieroHeadline(risk))}`}
              >
                {estadoFinancieroHeadline(risk)}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
                {risk.hint}
              </p>
            </div>
            <div className="border-t border-[var(--border-subtle)] pt-5 md:border-l md:border-t-0 md:pl-10 md:pt-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
                Tendencia
              </p>
              <p
                className={`mt-2 text-[20px] font-semibold tracking-tight sm:text-[22px] ${trendHeadlineClass(trendPanel.headline)}`}
              >
                {trendPanel.headline}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
                {trendPanel.hint}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <section className="space-y-3">
        <SectionHeader
          eyebrow="Evolución"
          title="Finanzas mensuales"
          description={`Año ${year} hasta el mes actual. Egresos = COGS + gastos operativos + defectuosos.`}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader
              eyebrow="Mensual"
              title="Resultado neto"
              subtitle={`Año ${year}`}
            />
            <CardContent className="h-[220px] min-h-[200px] min-w-0 pt-2">
              {chartNetMonthly.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  title="Sin datos"
                  description="No hay meses disponibles en la serie."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartNetMonthly}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={chart.grid}
                      strokeDasharray="2 4"
                    />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: chart.grid }}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                      dy={4}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                      }
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="Ganancia neta"
                      stroke={netLineStroke}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Mensual"
              title="Ingresos vs egresos"
              subtitle={`Año ${year}`}
            />
            <CardContent className="h-[220px] min-h-[200px] min-w-0 pt-2">
              {chartIngresosEgresos.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  title="Sin datos"
                  description="No hay meses disponibles en la serie."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartIngresosEgresos}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={chart.grid}
                      strokeDasharray="2 4"
                    />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: chart.grid }}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                      }
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: chart.axisLabel }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="Ingresos"
                      fill={chart.barAccent}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={18}
                    />
                    <Bar
                      dataKey="Egresos"
                      fill={chart.lineNegative}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Mensual"
              title="Composición de egresos"
              subtitle="COGS, gastos y defectuosos por mes"
            />
            <CardContent className="h-[220px] min-h-[200px] min-w-0 pt-2">
              {chartEgresosBreakdown.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  title="Sin datos"
                  description="No hay meses disponibles en la serie."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartEgresosBreakdown}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={chart.grid}
                      strokeDasharray="2 4"
                    />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: chart.grid }}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                      }
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: chart.axisLabel }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="COGS"
                      stackId="eg"
                      fill={chart.barAlt}
                      radius={[0, 0, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="Gastos"
                      stackId="eg"
                      fill={chart.lineMuted}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="Defectuosos"
                      stackId="eg"
                      fill={chart.lineNegative}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
          Operación
        </p>
        <Card className="bg-[var(--surface)] ring-1 ring-inset ring-[var(--border-subtle)]">
          <CardContent className="flex flex-wrap gap-2 px-4 py-3 sm:px-5 sm:py-4">
            <Link
              href="/ventas"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              Ventas
            </Link>
            <Link
              href="/gastos"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              Gastos
            </Link>
            <Link
              href="/stock"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              Stock
            </Link>
            <Link
              href="/clientes"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              Clientes
            </Link>
            <Link
              href="/reportes"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              Reportes
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Subcomponentes internos del dashboard                                 */
/* ────────────────────────────────────────────────────────────────────── */

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]">
        {icon}
      </span>
      <p className="text-[13.5px] font-semibold tracking-tight text-[var(--foreground-strong)]">
        {title}
      </p>
      <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-[var(--foreground-muted)]">
        {description}
      </p>
    </div>
  );
}
