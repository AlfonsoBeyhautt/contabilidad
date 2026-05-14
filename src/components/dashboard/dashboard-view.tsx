"use client";

import { useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Brain,
  ChevronRight,
  PiggyBank,
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
import { buildIntelligenceReport } from "@/lib/intelligence";
import { formatCurrency, formatPercent } from "@/lib/format";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1].trim() : t;
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
  const { range, preset } = usePeriod();
  const chart = useChartColors();

  const m = periodMetricsWithProjections(data, range);
  const yoyRange = compareToPreviousYear(range);
  const mYoy = periodMetricsWithProjections(data, yoyRange);

  const prevMonthRange = monthPreviousRange(range);
  const mPrevMonth = periodMetricsWithProjections(data, prevMonthRange);

  const revenueMomDelta =
    preset === "este_mes" ? pctChange(m.revenue, mPrevMonth.revenue) : null;
  const netMomDelta =
    preset === "este_mes"
      ? pctChange(m.netProfitProjected, mPrevMonth.netProfitProjected)
      : null;
  const expensesMomDelta =
    preset === "este_mes"
      ? pctChange(m.expensesProjected, mPrevMonth.expensesProjected)
      : null;

  const revenueYoyDelta = pctChange(m.revenue, mYoy.revenue);
  const netYoyDelta = pctChange(m.netProfitProjected, mYoy.netProfitProjected);
  const grossYoyDelta = pctChange(m.grossProfit, mYoy.grossProfit);

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
  const monthly = salesAggregatedByMonth(data.sales, year).map((row) => ({
    name: String(row.month).padStart(2, "0"),
    Ingresos: Math.round(row.revenue),
    "Ganancia bruta": Math.round(row.gross),
    Gastos: 0,
    "Ganancia neta": 0,
  }));

  const expensesByMonth = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year, i, 1);
    const monthEnd = new Date(year, i + 1, 0, 23, 59, 59);
    const r: DateRange = { start: monthStart, end: monthEnd };
    return periodMetricsWithProjections(data, r);
  });
  for (let i = 0; i < 12; i++) {
    const pm = expensesByMonth[i];
    monthly[i].Gastos = Math.round(pm?.expensesProjected ?? 0);
    monthly[i]["Ganancia neta"] = Math.round(pm?.netProfitProjected ?? 0);
  }

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
  const next7Total = next7Days.reduce((a, it) => a + it.amount, 0);

  const intel = useMemo(
    () =>
      buildIntelligenceReport(data, {
        period: range,
        periodLabel: presetLabels[preset] ?? "Período seleccionado",
      }),
    [data, range, preset],
  );
  const topInsight = intel.insights[0];

  const executiveLine = useMemo(() => {
    const p = intel.summary.paragraphs[0]?.trim();
    if (p) return firstSentence(p);
    if (m.revenue <= 0 && m.saleCount === 0) {
      return "Sin ingresos en el período: el estado financiero no es evaluable con datos actuales.";
    }
    if (m.netProfitProjected < 0) {
      return `El negocio opera con pérdida neta de ${formatCurrency(Math.abs(m.netProfitProjected))} y margen neto ${formatPercent(m.marginPctProjected)} frente a ingresos de ${formatCurrency(m.revenue)}.`;
    }
    return `El negocio mantiene resultado neto de ${formatCurrency(m.netProfitProjected)} con margen neto ${formatPercent(m.marginPctProjected)} sobre ingresos de ${formatCurrency(m.revenue)}.`;
  }, [
    intel.summary.paragraphs,
    m.revenue,
    m.saleCount,
    m.netProfitProjected,
    m.marginPctProjected,
  ]);

  const risk = financeRiskPresentation(m);

  const totalAlerts = lowStock.length + outStock.length + next7Days.length;
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

  return (
    <div className="space-y-6 pb-8">
      {/* 1 · KPIs principales (equilibrados) */}
      <section className="space-y-3 animate-rise">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
            Inicio · {periodLabel}
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[24px]">
            {greeting()}, resumen del negocio
          </h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ingresos"
            value={formatCurrency(m.revenue)}
            hint={`${m.saleCount} ventas · ${Math.round(m.unitsSold)} uds.`}
            icon={<TrendingUp className="h-4 w-4" aria-hidden />}
            accent="info"
            delta={{
              value: revenueYoyDelta,
              label: "vs año anterior",
              neutralOnZero: true,
            }}
          />
          <StatCard
            label="Resultado neto (proyectado)"
            value={formatCurrency(m.netProfitProjected)}
            hint={`Margen neto ${formatPercent(m.marginPctProjected)}`}
            icon={
              m.netProfitProjected >= 0 ? (
                <PiggyBank className="h-4 w-4" aria-hidden />
              ) : (
                <TrendingDown className="h-4 w-4" aria-hidden />
              )
            }
            accent={m.netProfitProjected >= 0 ? "positive" : "negative"}
            financialStress={
              m.netProfitProjected < 0
                ? "danger"
                : m.marginPctProjected < 3
                  ? "warning"
                  : "none"
            }
            delta={{
              value: netYoyDelta,
              label: "vs año anterior",
              neutralOnZero: true,
            }}
          />
          <StatCard
            label="Gastos operativos (proyectados)"
            value={formatCurrency(m.expensesProjected)}
            hint={`Emitidos ${formatCurrency(m.expensesEmitted)}`}
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            delta={
              expensesMomDelta !== null
                ? {
                    value: expensesMomDelta,
                    label: "vs mes anterior",
                    neutralOnZero: true,
                  }
                : undefined
            }
          />
          <StatCard
            label="Margen neto"
            value={formatPercent(m.marginPctProjected)}
            hint="Sobre ingresos del período"
            icon={<BarChart3 className="h-4 w-4" aria-hidden />}
            delta={
              revenueMomDelta !== null && netMomDelta !== null
                ? {
                    value: netMomDelta,
                    label: "vs mes anterior",
                    neutralOnZero: true,
                  }
                : undefined
            }
          />
        </div>

        <p className="text-[11.5px] leading-snug text-[var(--foreground-muted)]">
          Costo de mercadería (COGS) {formatCurrency(m.cogsSales)} · Ganancia
          bruta {formatCurrency(m.grossProfit)} · Resultado operativo{" "}
          {formatCurrency(m.operatingProfitProjected)} (
          {formatPercent(m.operatingMarginPctProjected)})
        </p>
      </section>

      {/* 2 · Estado general: riesgo, resumen, tendencia, alertas */}
      <section>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">
                  Riesgo financiero
                </p>
                <p className="mt-1.5 text-[16px] font-semibold text-[var(--foreground-strong)]">
                  {risk.label}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-[var(--foreground-muted)]">
                  {risk.hint}
                </p>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-5 lg:col-span-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">
                  Resumen ejecutivo
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--foreground-strong)]">
                  {executiveLine}
                </p>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-5 lg:col-span-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">
                  Tendencia vs año anterior
                </p>
                <p className="mt-2 text-[12px] text-[var(--foreground-muted)]">
                  Ingresos{" "}
                  <span className="font-semibold tabular-nums text-[var(--foreground-strong)]">
                    {revenueYoyDelta >= 0 ? "+" : ""}
                    {revenueYoyDelta.toFixed(1)} %
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-[var(--foreground-muted)]">
                  Resultado neto{" "}
                  <span className="font-semibold tabular-nums text-[var(--foreground-strong)]">
                    {netYoyDelta >= 0 ? "+" : ""}
                    {netYoyDelta.toFixed(1)} %
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-[var(--foreground-muted)]">
                  Margen bruto{" "}
                  <span className="font-semibold tabular-nums text-[var(--foreground-strong)]">
                    {grossYoyDelta >= 0 ? "+" : ""}
                    {grossYoyDelta.toFixed(1)} %
                  </span>
                </p>
              </div>
            </div>

            {totalAlerts > 0 || m.netProfitProjected < 0 ? (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-4 text-[12px]">
                {m.netProfitProjected < 0 ? (
                  <span className="font-medium text-[var(--danger)]">
                    Resultado neto negativo en el período
                  </span>
                ) : null}
                {next7Days.length > 0 ? (
                  <Link
                    href="/calendario"
                    className="text-[var(--foreground)] underline-offset-2 hover:underline"
                  >
                    {next7Days.length} pago{next7Days.length === 1 ? "" : "s"}{" "}
                    en 7 días · {formatCurrency(next7Total)}
                  </Link>
                ) : null}
                {outStock.length + lowStock.length > 0 ? (
                  <Link
                    href="/stock"
                    className="text-[var(--foreground)] underline-offset-2 hover:underline"
                  >
                    Stock: {outStock.length} agotado
                    {outStock.length === 1 ? "" : "s"},{" "}
                    {lowStock.length} bajo mínimo
                  </Link>
                ) : null}
                {m.defectiveLoss > 0 ? (
                  <Link
                    href="/historial"
                    className="text-[var(--foreground)] underline-offset-2 hover:underline"
                  >
                    Defectuosos: {formatCurrency(m.defectiveLoss)}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* ── Inteligencia del negocio ───────────────────────────────────── */}
      <section>
        <Link
          href="/inteligencia"
          className="group flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition-colors hover:bg-[var(--surface-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]">
              <Brain className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
                Inteligencia del negocio
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--foreground-strong)]">
                Health score {intel.health.score}/100 ·{" "}
                <span className="capitalize text-[var(--foreground-muted)]">
                  {intel.health.grade}
                </span>
                <span className="text-[var(--foreground-subtle)]"> · </span>
                <span className="text-[var(--foreground-muted)]">
                  Riesgo: {risk.label}
                </span>
              </p>
              {topInsight ? (
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--foreground-muted)]">
                  {topInsight.summary}
                </p>
              ) : null}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">
            Abrir análisis
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </Link>
      </section>

      {/* 3 · Evolución financiera */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow="Evolución"
          title="Finanzas en el tiempo"
          description={`Mes a mes durante ${year}. Proyección de gastos incluida en neto y en gastos mensuales.`}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader
              eyebrow="Mensual"
              title="Resultado neto"
              subtitle={`Año ${year}`}
            />
            <CardContent className="h-[240px] min-h-[220px] min-w-0 pt-2">
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
                    stroke={chart.lineAccent}
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
            <CardContent className="h-[240px] min-h-[220px] min-w-0 pt-2">
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
                    fill={chart.lineMuted}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Período"
              title="Top facturación"
              subtitle="En el rango seleccionado"
            />
            <CardContent className="h-[240px] min-h-[220px] min-w-0 pt-2">
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


      {/* 4 · Operación e inventario */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow="Operación"
          title="Stock, ventas y clientes"
          description="Panorama operativo sin salir del inicio."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="min-w-0">
            <CardHeader
              eyebrow="Stock"
              title="Crítico"
              subtitle="Bajo mínimo o agotado"
              action={
                <Link
                  href="/stock"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Stock
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <CardContent>
              <ul className="space-y-2.5">
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
                  <p className="text-[12px] text-[var(--foreground-muted)]">
                    Sin alertas de stock.
                  </p>
                ) : null}
              </ul>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader
              eyebrow="Ventas"
              title="Destacados"
              subtitle="Período actual"
              action={
                <Link
                  href="/productos"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Productos
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-[12px] text-[var(--foreground-muted)]">
                  Sin ventas en el período.
                </p>
              ) : (
                <ol className="list-decimal space-y-2 pl-4 text-[12px] marker:text-[var(--foreground-muted)]">
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
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader
              eyebrow="Calidad"
              title="Defectuosos"
              subtitle="Pérdida en el período"
              action={
                <Link
                  href="/historial"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Historial
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <CardContent>
              <p className="text-[22px] font-semibold tabular-nums text-[var(--foreground-strong)]">
                {formatCurrency(m.defectiveLoss)}
              </p>
              <p className="mt-2 text-[12px] text-[var(--foreground-muted)]">
                {m.defectiveLoss > 0
                  ? "Revisá merma y proveedor."
                  : "Sin registros en el período."}
              </p>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader
              eyebrow="Clientes"
              title="Actividad"
              subtitle="Altas y ranking"
              action={
                <Link
                  href="/clientes"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Ver
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] text-[var(--foreground-muted)]">
                  Nuevos (30 días)
                </p>
                <p className="text-xl font-semibold tabular-nums text-[var(--foreground-strong)]">
                  {newCustomers}
                </p>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-3">
                <p className="text-[11px] text-[var(--foreground-muted)]">
                  Mejor cliente (hist.)
                </p>
                {bestCustomers[0] ? (
                  <p className="mt-1 truncate text-[13px] font-medium text-[var(--foreground)]">
                    {bestCustomers[0].c.name}
                  </p>
                ) : (
                  <p className="text-[12px] text-[var(--foreground-muted)]">—</p>
                )}
                {bestCustomers[0] ? (
                  <p className="text-[12px] tabular-nums text-[var(--foreground-muted)]">
                    {formatCurrency(bestCustomers[0].totalSpent)}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader
              eyebrow="Inventario"
              title="Valor al costo"
              subtitle="Todo el catálogo"
              action={
                <Link
                  href="/stock"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Ajustes
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <CardContent>
              <p className="text-[22px] font-semibold tabular-nums text-[var(--foreground-strong)]">
                {formatCurrency(inventoryValueAtCost)}
              </p>
              <p className="mt-2 text-[12px] text-[var(--foreground-muted)]">
                Stock × costo de compra actual.
              </p>
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
