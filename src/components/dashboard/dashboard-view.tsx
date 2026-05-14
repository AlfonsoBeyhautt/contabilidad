"use client";

import { useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  CircleDollarSign,
  Percent,
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
  customerMetrics,
  filterSalesInRange,
  monthPreviousRange,
  parseISODate,
  periodMetricsWithProjections,
  salesAggregatedByMonth,
  stockStatus,
  topProductsByRevenue,
  type DateRange,
} from "@/lib/data/finance-calcs";
import { upcomingPayments } from "@/lib/data/calendar-helpers";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useAuth } from "@/contexts/auth-context";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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

function estadoCardShell(accent: "neutral" | "warning" | "negative"): string {
  if (accent === "negative")
    return "ring-1 ring-inset ring-[color-mix(in_oklab,var(--danger)_26%,transparent)]";
  if (accent === "warning")
    return "ring-1 ring-inset ring-[color-mix(in_oklab,var(--warning)_26%,transparent)]";
  return "ring-1 ring-inset ring-[var(--border-subtle)]";
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

  const expensesMomDelta =
    preset === "este_mes"
      ? pctChange(m.expensesProjected, mPrevMonth.expensesProjected)
      : null;

  const revenueYoyDelta = pctChange(m.revenue, mYoy.revenue);
  const netYoyDelta = pctChange(m.netProfitProjected, mYoy.netProfitProjected);
  const expensesYoyDelta = pctChange(
    m.expensesProjected,
    mYoy.expensesProjected,
  );
  const marginYoyPp = m.marginPctProjected - mYoy.marginPctProjected;
  const marginMomPp = m.marginPctProjected - mPrevMonth.marginPctProjected;

  const salesInRange = useMemo(
    () => filterSalesInRange(data.sales, range),
    [data.sales, range],
  );
  const topProducts = useMemo(
    () => topProductsByRevenue(salesInRange, data.products, 6),
    [salesInRange, data.products],
  );

  const lowStock = data.products.filter((p) => stockStatus(p) === "bajo");
  const outStock = data.products.filter((p) => stockStatus(p) === "agotado");

  const now = new Date();
  const newCustomers = data.customers.filter((c) => {
    const reg = parseISODate(c.registeredAt);
    return differenceInCalendarDays(now, reg) <= 30;
  }).length;

  const year = now.getFullYear();
  const monthly = useMemo(() => {
    const rows = salesAggregatedByMonth(data.sales, year).map((row) => ({
      name: String(row.month).padStart(2, "0"),
      Ingresos: Math.round(row.revenue),
      "Ganancia bruta": Math.round(row.gross),
      Gastos: 0,
      "Ganancia neta": 0,
    }));
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(year, i, 1);
      const monthEnd = new Date(year, i + 1, 0, 23, 59, 59);
      const r: DateRange = { start: monthStart, end: monthEnd };
      const pm = periodMetricsWithProjections(data, r);
      rows[i].Gastos = Math.round(pm.expensesProjected);
      rows[i]["Ganancia neta"] = Math.round(pm.netProfitProjected);
    }
    return rows;
  }, [data, year]);

  const chartNetMonthly = monthly.map((row) => ({
    name: row.name,
    "Ganancia neta": row["Ganancia neta"],
  }));

  const chartIngresosGastos = monthly.map((row) => ({
    name: row.name,
    Ingresos: row.Ingresos,
    Gastos: row.Gastos,
  }));

  const inventoryValueAtCost = useMemo(
    () => data.products.reduce((a, p) => a + p.stock * p.purchaseCost, 0),
    [data.products],
  );

  const next7Days = upcomingPayments(data, 7);

  const sparkMonthlySlice = useMemo(() => {
    const end = new Date().getMonth();
    const start = Math.max(0, end - 6);
    return monthly.slice(start, end + 1);
  }, [monthly]);

  const sparkRevenue = useMemo(
    () => sparkMonthlySlice.map((r) => r.Ingresos),
    [sparkMonthlySlice],
  );
  const sparkNet = useMemo(
    () => sparkMonthlySlice.map((r) => r["Ganancia neta"]),
    [sparkMonthlySlice],
  );
  const sparkExpenses = useMemo(
    () => sparkMonthlySlice.map((r) => r.Gastos),
    [sparkMonthlySlice],
  );
  const sparkMarginPct = useMemo(
    () =>
      sparkMonthlySlice.map((r) =>
        r.Ingresos > 0 ? (r["Ganancia neta"] / r.Ingresos) * 100 : 0,
      ),
    [sparkMonthlySlice],
  );

  const trendPanel = useMemo(() => {
    const nowMonth = new Date().getMonth();
    const windowStart = Math.max(0, nowMonth - 5);
    const slice = monthly.slice(windowStart, nowMonth + 1);
    const nets = slice.map((r) => r["Ganancia neta"]);
    const negCount = nets.filter((n) => n < 0).length;
    const lastNet = monthly[nowMonth]?.["Ganancia neta"] ?? 0;

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
        hint: "El mes actual proyecta cierre neto en rojo.",
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
  }, [monthly, m.revenue, m.saleCount]);

  const alertBundleCount = useMemo(() => {
    let n = 0;
    if (m.netProfitProjected < 0) n += 1;
    if (next7Days.length > 0) n += 1;
    if (outStock.length + lowStock.length > 0) n += 1;
    if (m.defectiveLoss > 0) n += 1;
    return n;
  }, [
    m.netProfitProjected,
    m.defectiveLoss,
    next7Days.length,
    outStock.length,
    lowStock.length,
  ]);

  const risk = financeRiskPresentation(m);
  const periodLabel = periodDescription(preset);

  const bestCustomers = useMemo(
    () =>
      [...data.customers]
        .map((c) => ({
          c,
          ...customerMetrics(c, data.sales, data.products),
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5),
    [data.customers, data.sales, data.products],
  );

  const expensePressureRatio =
    m.revenue > 0 ? m.expensesProjected / m.revenue : 0;
  const expensesAccent: "neutral" | "warning" | "negative" =
    expensePressureRatio > 0.75 || m.netProfitProjected < 0
      ? "negative"
      : expensePressureRatio > 0.55
        ? "warning"
        : "neutral";

  const nowMonthIdx = new Date().getMonth();
  const lastNetForChart = monthly[nowMonthIdx]?.["Ganancia neta"] ?? 0;
  const netLineStroke =
    lastNetForChart >= 0 ? chart.linePositive : chart.lineNegative;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-10">
      {/* A · Cabecera */}
      <section className="animate-rise rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Inicio · período {periodLabel}
            </p>
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[24px]">
              {firstName
                ? `${greeting()}, ${firstName}.`
                : `${greeting()}.`}
            </h1>
            <p className="max-w-xl text-[13px] leading-relaxed text-[var(--foreground-muted)]">
              Así viene tu negocio desde el inicio operativo.
            </p>
          </div>
          <Link
            href="/inteligencia"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface)]"
          >
            Ver resumen ejecutivo
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>
      </section>

      {/* B · KPIs principales */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ingresos totales"
            value={formatCurrency(m.revenue)}
            hint={`${m.saleCount} ventas · ${Math.round(m.unitsSold)} uds.`}
            icon={<CircleDollarSign className="h-4 w-4" aria-hidden />}
            accent="info"
            countUpAmount={m.revenue}
            formatCountUp={(n) => formatCurrency(n)}
            sparkline={sparkRevenue}
            sparklineTone="info"
            delta={{
              value: revenueYoyDelta,
              label: "vs año anterior",
              neutralOnZero: true,
            }}
          />
          <StatCard
            label="Resultado neto"
            value={formatCurrency(m.netProfitProjected)}
            hint={`Margen neto ${formatPercent(m.marginPctProjected)}`}
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
            sparkline={sparkNet}
            sparklineTone={
              (sparkNet[sparkNet.length - 1] ?? 0) >= 0
                ? "positive"
                : "negative"
            }
            delta={{
              value: netYoyDelta,
              label: "vs año anterior",
              neutralOnZero: true,
            }}
          />
          <StatCard
            label="Gastos operativos"
            value={formatCurrency(m.expensesProjected)}
            hint={`${(expensePressureRatio * 100).toFixed(0)}% de ingresos · emitidos ${formatCurrency(m.expensesEmitted)}`}
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            accent={expensesAccent}
            countUpAmount={m.expensesProjected}
            formatCountUp={(n) => formatCurrency(n)}
            sparkline={sparkExpenses}
            sparklineTone={expensesAccent === "negative" ? "negative" : "muted"}
            delta={
              preset === "este_mes" && expensesMomDelta !== null
                ? {
                    value: expensesMomDelta,
                    label: "vs mes anterior",
                    neutralOnZero: true,
                  }
                : {
                    value: expensesYoyDelta,
                    label: "vs año anterior",
                    neutralOnZero: true,
                  }
            }
          />
          <StatCard
            label="Margen neto"
            value={formatPercent(m.marginPctProjected)}
            hint="Sobre ingresos del período"
            icon={<Percent className="h-4 w-4" aria-hidden />}
            accent={m.marginPctProjected >= 0 ? "positive" : "negative"}
            countUpAmount={m.marginPctProjected}
            formatCountUp={(n) => formatPercent(n, 1)}
            sparkline={sparkMarginPct}
            sparklineTone={
              m.marginPctProjected >= 0 ? "positive" : "negative"
            }
            delta={{
              value: preset === "este_mes" ? marginMomPp : marginYoyPp,
              label:
                preset === "este_mes" ? "vs mes anterior" : "vs año anterior",
              neutralOnZero: true,
              display: "percentagePoints",
            }}
          />
        </div>
        <p className="text-[11.5px] leading-snug text-[var(--foreground-muted)]">
          COGS {formatCurrency(m.cogsSales)} · Bruto{" "}
          {formatCurrency(m.grossProfit)} · Operativo{" "}
          {formatCurrency(m.operatingProfitProjected)} (
          {formatPercent(m.operatingMarginPctProjected)})
        </p>
      </section>

      {/* C · Estado general */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card
          className={`min-h-[152px] overflow-hidden bg-[var(--surface)] ${estadoCardShell(risk.accent)}`}
        >
          <CardContent className="flex h-full flex-col p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
              Estado financiero
            </p>
            <p
              className={`mt-3 text-[22px] font-semibold tracking-tight ${estadoHeadlineClass(estadoFinancieroHeadline(risk))}`}
            >
              {estadoFinancieroHeadline(risk)}
            </p>
            <p className="mt-2 flex-1 text-[12.5px] leading-snug text-[var(--foreground-muted)]">
              {risk.hint}
            </p>
          </CardContent>
        </Card>

        <Card className="min-h-[152px] overflow-hidden bg-[var(--surface)] ring-1 ring-inset ring-[var(--border-subtle)]">
          <CardContent className="flex h-full flex-col p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
              Tendencia
            </p>
            <p
              className={`mt-3 text-[22px] font-semibold tracking-tight ${trendHeadlineClass(trendPanel.headline)}`}
            >
              {trendPanel.headline}
            </p>
            <p className="mt-2 flex-1 text-[12.5px] leading-snug text-[var(--foreground-muted)]">
              {trendPanel.hint}
            </p>
          </CardContent>
        </Card>

        <Card className="min-h-[152px] overflow-hidden bg-[var(--surface)] ring-1 ring-inset ring-[var(--border-subtle)]">
          <CardContent className="flex h-full flex-col p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
              Alertas importantes
            </p>
            <p className="mt-3 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--foreground-strong)]">
              {alertBundleCount}
            </p>
            <p className="mt-2 flex-1 text-[12.5px] leading-snug text-[var(--foreground-muted)]">
              {alertBundleCount === 0
                ? "Sin focos críticos: resultado, calendario, stock y defectuosos están en orden."
                : "Incluye resultado, pagos próximos, stock crítico y defectuosos cuando aplica."}
            </p>
            <Link
              href="/inteligencia"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            >
              Ver detalle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </CardContent>
        </Card>
      </section>
      {/* D · Evolución financiera */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow="Evolución"
          title="Finanzas mensuales"
          description={`Año ${year}. Gastos proyectados y resultado neto por mes.`}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader
              eyebrow="Mensual"
              title="Resultado neto"
              subtitle={`Año ${year}`}
            />
            <CardContent className="h-[220px] min-h-[200px] min-w-0 pt-2">
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
                    width={40}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Mensual"
              title="Ingresos vs gastos"
              subtitle={`Año ${year}`}
            />
            <CardContent className="h-[220px] min-h-[200px] min-w-0 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartIngresosGastos}
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
                    width={40}
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
                    dataKey="Gastos"
                    fill={chart.lineNegative}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Período seleccionado"
              title="Top productos por ingresos"
              subtitle="En el rango activo"
              action={
                <Link
                  href="/reportes"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Ver todos
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <CardContent className="h-[220px] min-h-[200px] min-w-0 pt-2">
              {topProducts.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  title="Sin ventas"
                  description="No hay datos en este período."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="2 4"
                      horizontal={false}
                      stroke={chart.grid}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: chart.axisLabel }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="revenue"
                      fill={chart.barAccent}
                      radius={[0, 4, 4, 0]}
                      barSize={12}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>


      {/* E · Operación */}
      <section className="space-y-3">
        <SectionHeader
          title="Operación"
          description="Panorama operativo sin salir del inicio."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="flex min-h-[188px] min-w-0 flex-col">
            <CardHeader
              eyebrow="Stock"
              title="Crítico"
              subtitle="Bajo mínimo o agotado"
            />
            <CardContent className="flex flex-1 flex-col px-5 pb-4 pt-0 sm:px-6">
              <ul className="min-h-0 flex-1 space-y-2">
                {[...outStock, ...lowStock].slice(0, 5).map((p) => {
                  const isOut = stockStatus(p) === "agotado";
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--foreground)]">
                        {p.name}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                          isOut
                            ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                            : "bg-[var(--warning-soft)] text-[var(--warning)]"
                        }`}
                      >
                        {p.stock}
                      </span>
                    </li>
                  );
                })}
                {outStock.length === 0 && lowStock.length === 0 ? (
                  <li className="text-[12px] text-[var(--foreground-muted)]">
                    Sin alertas de stock.
                  </li>
                ) : null}
              </ul>
              <Link
                href="/stock"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                Ver stock
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          <Card className="flex min-h-[188px] min-w-0 flex-col">
            <CardHeader
              eyebrow="Ventas"
              title="Destacadas"
              subtitle="Período actual"
            />
            <CardContent className="flex flex-1 flex-col px-5 pb-4 pt-0 sm:px-6">
              {topProducts.length === 0 ? (
                <p className="flex-1 text-[12px] text-[var(--foreground-muted)]">
                  Sin ventas en el período.
                </p>
              ) : (
                <ol className="min-h-0 flex-1 list-decimal space-y-1.5 pl-4 text-[12px] marker:text-[var(--foreground-muted)]">
                  {topProducts.slice(0, 5).map((tp) => (
                    <li
                      key={tp.productId}
                      className="pl-1 text-[var(--foreground)]"
                    >
                      <span className="font-medium">{tp.name}</span>
                      <span className="ml-1 tabular-nums text-[var(--foreground-muted)]">
                        {formatCurrency(tp.revenue)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <Link
                href="/ventas"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                Ver ventas
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          <Card className="flex min-h-[188px] min-w-0 flex-col">
            <CardHeader
              eyebrow="Calidad"
              title="Defectuosos"
              subtitle="Pérdida en el período"
            />
            <CardContent className="flex flex-1 flex-col justify-between px-5 pb-4 pt-0 sm:px-6">
              <div>
                <p className="text-lg font-semibold tabular-nums text-[var(--foreground-strong)] sm:text-xl">
                  {formatCurrency(m.defectiveLoss)}
                </p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--foreground-muted)]">
                  {m.defectiveLoss > 0
                    ? "Impacto en resultado del período."
                    : "Sin registros en el período."}
                </p>
              </div>
              <Link
                href="/historial"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                Ver historial
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          <Card className="flex min-h-[188px] min-w-0 flex-col">
            <CardHeader
              eyebrow="Clientes"
              title="Activos"
              subtitle="Altas y mejor cliente"
            />
            <CardContent className="flex flex-1 flex-col px-5 pb-4 pt-0 sm:px-6">
              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                    Nuevos (30 días)
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--foreground-strong)]">
                    {newCustomers}
                  </p>
                </div>
                <div className="border-t border-[var(--border-subtle)] pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                    Mejor cliente
                  </p>
                  {bestCustomers[0] ? (
                    <>
                      <p className="mt-1 truncate text-[12.5px] font-medium text-[var(--foreground)]">
                        {bestCustomers[0].c.name}
                      </p>
                      <p className="text-[11.5px] tabular-nums text-[var(--foreground-muted)]">
                        {formatCurrency(bestCustomers[0].totalSpent)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[12px] text-[var(--foreground-muted)]">
                      —
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/clientes"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                Ver clientes
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          <Card className="flex min-h-[188px] min-w-0 flex-col">
            <CardHeader
              eyebrow="Inventario"
              title="Valor al costo"
              subtitle="Catálogo completo"
            />
            <CardContent className="flex flex-1 flex-col justify-between px-5 pb-4 pt-0 sm:px-6">
              <div>
                <p className="text-lg font-semibold tabular-nums text-[var(--foreground-strong)] sm:text-xl">
                  {formatCurrency(inventoryValueAtCost)}
                </p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--foreground-muted)]">
                  Stock × costo de compra actual.
                </p>
              </div>
              <Link
                href="/stock"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                Ver inventario
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardContent>
          </Card>
        </div>
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
