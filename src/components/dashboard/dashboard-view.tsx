"use client";

import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Brain,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  PackageX,
  PiggyBank,
  Scale,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart as RBarChart,
  Bar,
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
    <div className="space-y-8 pb-8">
      {/* ── Hero: estado → 3 KPI → waterfall → detalle ─────────────────── */}
      <section className="space-y-6 animate-rise">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">
            Panel ejecutivo · {periodLabel}
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[32px]">
            {greeting()},{" "}
            <span className="text-[var(--foreground-muted)] font-medium">
              estado financiero del negocio.
            </span>
          </h1>
          <blockquote className="max-w-4xl border-l-2 border-[var(--accent)] pl-4 text-[14px] font-medium leading-snug text-[var(--foreground-strong)]">
            {executiveLine}
          </blockquote>
          <p className="max-w-3xl text-[13px] text-[var(--foreground-muted)]">
            Prioridad: resultado neto, riesgo y resultado operativo. Ingresos y
            margen bruto como contexto. Ajustá el período en la barra superior.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <StatCard
              size="hero"
              prominence="primary"
              accent={m.netProfitProjected >= 0 ? "positive" : "negative"}
              financialStress={
                m.netProfitProjected < 0
                  ? "danger"
                  : m.marginPctProjected < 3
                    ? "warning"
                    : "none"
              }
              label="Resultado neto (proyectado)"
              value={formatCurrency(m.netProfitProjected)}
              countUpAmount={m.netProfitProjected}
              formatCountUp={formatCurrency}
              hint={`Margen neto ${formatPercent(m.marginPctProjected)} · ${m.saleCount} ventas`}
              icon={
                m.netProfitProjected >= 0 ? (
                  <PiggyBank className="h-4 w-4" aria-hidden />
                ) : (
                  <TrendingDown className="h-4 w-4" aria-hidden />
                )
              }
              delta={{
                value: netYoyDelta,
                label: "vs año anterior",
                neutralOnZero: true,
              }}
            />
          </div>
          <div className="lg:col-span-3">
            <StatCard
              size="hero"
              prominence="secondary"
              accent="neutral"
              label="Resultado operativo"
              value={formatCurrency(m.operatingProfitProjected)}
              countUpAmount={m.operatingProfitProjected}
              formatCountUp={formatCurrency}
              hint={`Antes de defectuosos · margen op. ${formatPercent(m.operatingMarginPctProjected)}`}
              icon={<BarChart3 className="h-4 w-4" aria-hidden />}
            />
          </div>
          <div className="lg:col-span-3">
            <StatCard
              size="hero"
              prominence="secondary"
              accent={
                risk.accent === "negative"
                  ? "negative"
                  : risk.accent === "warning"
                    ? "warning"
                    : "neutral"
              }
              financialStress={
                risk.accent === "negative"
                  ? "danger"
                  : risk.accent === "warning"
                    ? "warning"
                    : "none"
              }
              label="Nivel de riesgo financiero"
              value={risk.label}
              hint={risk.hint}
              icon={<Scale className="h-4 w-4" aria-hidden />}
            />
          </div>
        </div>

        <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-[var(--shadow-sm)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Construcción del resultado
            </p>
            <p className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--foreground-strong)]">
              De ingresos al resultado neto
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--foreground-muted)]">
              Secuencia ejecutiva: ingresos → costo de mercadería → gastos
              operativos → defectuosos → resultado neto.
            </p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <FinancialWaterfall m={m} />
          </div>
        </Card>

        <details className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-5">
          <summary className="cursor-pointer list-none text-[13px] font-semibold text-[var(--foreground-strong)] outline-none marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
              Detalle comercial y de márgenes
              <ChevronRight className="h-4 w-4 text-[var(--foreground-muted)] transition-transform group-open:rotate-90" aria-hidden />
            </span>
          </summary>
          <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
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
              label="Ganancia bruta"
              value={formatCurrency(m.grossProfit)}
              hint={formatPercent(m.grossMarginPct)}
              icon={<BarChart3 className="h-4 w-4" aria-hidden />}
              accent="neutral"
              delta={{
                value: grossYoyDelta,
                label: "vs año anterior",
                neutralOnZero: true,
              }}
            />
            <StatCard
              label="Costo de mercadería (COGS)"
              value={formatCurrency(m.cogsSales)}
              hint="Costo reconocido por ventas"
              icon={<ShoppingBag className="h-4 w-4" aria-hidden />}
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
              label="Defectuosos"
              value={formatCurrency(m.defectiveLoss)}
              hint="Pérdida por unidades no vendibles"
              icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
              accent={m.defectiveLoss > 0 ? "warning" : "neutral"}
            />
            <StatCard
              label="Margen neto proyectado"
              value={formatPercent(m.marginPctProjected)}
              hint="Sobre ingresos del período"
              icon={<CircleDollarSign className="h-4 w-4" aria-hidden />}
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
        </details>
      </section>

      {/* ── Inteligencia del negocio ───────────────────────────────────── */}
      <section>
        <Link
          href="/inteligencia"
          className="group block rounded-2xl border border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] bg-[color-mix(in_oklab,var(--accent-soft)_35%,var(--surface))] p-5 shadow-[var(--shadow-sm)] transition-all duration-300 hover:border-[color-mix(in_oklab,var(--accent)_45%,var(--border))] hover:shadow-md sm:p-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] ring-1 ring-inset ring-[var(--border)] transition-transform duration-300 group-hover:scale-[1.03]">
                <Brain className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                  Centro de inteligencia del negocio
                </p>
                <p className="mt-0.5 text-[15px] font-semibold tracking-tight text-[var(--foreground-strong)]">
                  Health score {intel.health.score}/100 ·{" "}
                  <span className="capitalize text-[var(--foreground-muted)]">
                    {intel.health.grade}
                  </span>
                  <span className="mx-2 text-[var(--foreground-subtle)]">·</span>
                  <span className="text-[13px] font-medium text-[var(--foreground-muted)]">
                    Estado financiero:{" "}
                    <span className="text-[var(--foreground-strong)]">
                      {risk.label}
                    </span>
                  </span>
                </p>
                {topInsight ? (
                  <p className="mt-1 line-clamp-2 max-w-2xl text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
                    {topInsight.summary}
                  </p>
                ) : (
                  <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
                    Análisis ejecutivo, riesgos y oportunidades del período.
                  </p>
                )}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 self-start rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] transition-colors group-hover:bg-[var(--surface-muted)] sm:self-auto">
              Abrir análisis estratégico
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </Link>
      </section>

      {/* ── Atención prioritaria ────────────────────────────────────────── */}
      {(totalAlerts > 0 || m.netProfitProjected < 0) ? (
        <section className="space-y-4">
          {m.netProfitProjected < 0 ? (
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger-soft)_55%,transparent)] px-5 py-4 text-[13px] leading-relaxed text-[var(--foreground-strong)] sm:px-6">
              <p className="font-semibold text-[var(--danger)]">
                Pérdida neta en el período
              </p>
              <p className="mt-1 text-[var(--foreground)]">
                El resultado neto proyectado es {formatCurrency(m.netProfitProjected)} (
                {formatPercent(m.marginPctProjected)} sobre ingresos). Revisá gastos,
                precios y mix antes de priorizar solo el volumen de ventas.
              </p>
            </div>
          ) : null}
          {totalAlerts > 0 ? (
            <>
          <SectionHeader
            eyebrow="Atención prioritaria"
            title="Qué necesita revisión"
            description="Alertas operativas y financieras relevantes en este momento. Resolvé lo crítico para evitar quiebres de stock y pagos olvidados."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <AlertCard
              tone="warning"
              icon={<CalendarClock className="h-4 w-4" aria-hidden />}
              title={
                next7Days.length === 0
                  ? "Sin pagos próximos"
                  : `${next7Days.length} pago${next7Days.length === 1 ? "" : "s"} en 7 días`
              }
              value={next7Days.length > 0 ? formatCurrency(next7Total) : "—"}
              description="Próximos pagos previstos (programados y recurrencias)."
              hrefLabel="Ver calendario"
              href="/calendario"
              items={next7Days.slice(0, 3).map((it) => ({
                key: it.key,
                primary: it.description,
                secondary: parseISO(`${it.date}T12:00:00`).toLocaleDateString(
                  "es-AR",
                  { day: "2-digit", month: "short" },
                ),
                value: formatCurrency(it.amount),
              }))}
              empty={next7Days.length === 0}
            />
            <AlertCard
              tone={outStock.length > 0 ? "danger" : "info"}
              icon={<PackageX className="h-4 w-4" aria-hidden />}
              title={
                outStock.length === 0 && lowStock.length === 0
                  ? "Stock saludable"
                  : `${outStock.length + lowStock.length} producto${
                      outStock.length + lowStock.length === 1 ? "" : "s"
                    } a revisar`
              }
              value={
                outStock.length > 0
                  ? `${outStock.length} agotado${outStock.length === 1 ? "" : "s"}`
                  : `${lowStock.length} stock bajo`
              }
              description="Riesgo de quiebre. Considerá reposición urgente."
              hrefLabel="Ir a stock"
              href="/stock"
              items={[...outStock, ...lowStock].slice(0, 3).map((p) => ({
                key: p.id,
                primary: p.name,
                secondary: `min ${p.minStock}`,
                value: `${p.stock} uds`,
              }))}
              empty={outStock.length === 0 && lowStock.length === 0}
            />
            <AlertCard
              tone={m.defectiveLoss > 0 ? "warning" : "info"}
              icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
              title={
                m.defectiveLoss > 0
                  ? "Defectuosos en el período"
                  : "Sin defectuosos"
              }
              value={
                m.defectiveLoss > 0 ? formatCurrency(m.defectiveLoss) : "—"
              }
              description="Pérdida por unidades dadas de baja del inventario."
              hrefLabel="Ver historial"
              href="/historial"
              empty={m.defectiveLoss === 0}
            />
          </div>
            </>
          ) : null}
        </section>
      ) : null}

      {/* ── Evolución y top productos ───────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Tendencia"
          title="Evolución del resultado neto mensual"
          description={`Sólo línea temporal (proyectado por mes, incluye recurrencias) · año ${year}. La pregunta que responde: ¿cómo cerró el resultado neto cada mes?`}
        />
        <div className="grid gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader
              eyebrow="Mensual"
              title="Resultado neto por mes"
              subtitle={`Año calendario ${year} · proyección de gastos`}
            />
            <CardContent className="h-[300px] min-h-[280px] min-w-0 pl-2 pr-4 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartNetMonthly}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
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
                    tick={{
                      fontSize: 11,
                      fill: chart.axisLabel,
                      fontFamily: "var(--font-geist-sans)",
                    }}
                    dy={6}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{
                      fontSize: 11,
                      fill: chart.axisLabel,
                      fontFamily: "var(--font-geist-sans)",
                    }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                    }
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: chart.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
                  <Line
                    type="monotone"
                    dataKey="Ganancia neta"
                    stroke={chart.lineAccent}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: chart.lineAccent, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive
                    animationDuration={700}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader
              eyebrow="Catálogo"
              title="Productos top por facturación"
              subtitle="En el período filtrado"
            />
            <CardContent className="h-[320px] pl-1 pr-3">
              {topProducts.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  title="Sin ventas en el período"
                  description="Cuando registres ventas, acá verás los productos que más facturan."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
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
                      tick={{
                        fontSize: 11,
                        fill: chart.axisLabel,
                      }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tickLine={false}
                      axisLine={false}
                      tick={{
                        fontSize: 11.5,
                        fill: chart.axisLabel,
                      }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: chart.grid, opacity: 0.35 }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill={chart.barAccent}
                      radius={[0, 6, 6, 0]}
                      barSize={14}
                      isAnimationActive
                      animationDuration={650}
                    />
                  </RBarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Operación / clientela ──────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Operación"
          title="Stock y clientela"
          description="Productos con menor disponibilidad y comportamiento de la base de clientes."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader
              eyebrow="Inventario"
              title="Productos a revisar"
              subtitle="Stock bajo y agotado"
              action={
                <Link
                  href="/stock"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Detalles
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <CardContent>
              <ul className="space-y-3">
                {[...outStock, ...lowStock].slice(0, 6).map((p) => {
                  const isOut = stockStatus(p) === "agotado";
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--foreground)]">
                          {p.name}
                        </p>
                        <p className="text-[11.5px] text-[var(--foreground-subtle)]">
                          mín {p.minStock} · {p.supplier || "sin proveedor"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                          isOut
                            ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                            : "bg-[var(--warning-soft)] text-[var(--warning)]"
                        }`}
                      >
                        {p.stock} uds
                      </span>
                    </li>
                  );
                })}
                {outStock.length === 0 && lowStock.length === 0 ? (
                  <EmptyState
                    icon={<Sparkles className="h-4 w-4" aria-hidden />}
                    title="Stock saludable"
                    description="No hay productos por debajo del umbral configurado."
                  />
                ) : null}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Clientela"
              title="Clientes nuevos · 30 días"
              subtitle="Recientes en el sistema"
              action={
                <Link
                  href="/clientes"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  Ver clientes
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <CardContent>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[42px] font-semibold leading-none tabular-nums tracking-tight text-[var(--foreground-strong)]">
                    {newCustomers}
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--foreground-muted)]">
                    Alta en los últimos 30 días.
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <UserPlus className="h-5 w-5" aria-hidden />
                </span>
              </div>
              <div className="mt-5 h-px bg-[var(--border-subtle)]" />
              <p className="mt-4 text-[12px] text-[var(--foreground-muted)]">
                Para segmentaciones por volumen, recurrencia y RFM ingresá a la
                sección{" "}
                <Link
                  href="/clientes"
                  className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
                >
                  Clientes
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Top"
              title="Mejores clientes"
              subtitle="Por volumen histórico"
            />
            <CardContent>
              {bestCustomers.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  title="Sin clientes con ventas"
                  description="Cargá ventas asociadas a clientes para ver este ranking."
                />
              ) : (
                <ul className="space-y-3">
                  {bestCustomers.map(({ c, totalSpent, purchaseCount }, i) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[11px] font-semibold tabular-nums text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--foreground)]">
                            {c.name}
                          </p>
                          <p className="text-[11.5px] text-[var(--foreground-subtle)]">
                            {purchaseCount} compras
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--foreground)]">
                        {formatCurrency(totalSpent)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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

function FinancialWaterfall({
  m,
}: {
  m: ReturnType<typeof periodMetricsWithProjections>;
}) {
  const steps: {
    key: string;
    label: string;
    sub: string;
    amount: number;
  }[] = [
    {
      key: "rev",
      label: "Ingresos",
      sub: "Facturación del período",
      amount: m.revenue,
    },
    {
      key: "cogs",
      label: "Costo de mercadería (COGS)",
      sub: "Costo reconocido por ventas",
      amount: -m.cogsSales,
    },
    {
      key: "opex",
      label: "Gastos operativos (proyectados)",
      sub: "Incluye recurrencias aún no emitidas",
      amount: -m.expensesProjected,
    },
    {
      key: "def",
      label: "Defectuosos",
      sub: "Pérdida por unidades no vendibles",
      amount: -m.defectiveLoss,
    },
    {
      key: "net",
      label: "Resultado neto",
      sub: "Saldo final del período (proyectado)",
      amount: m.netProfitProjected,
    },
  ];

  const maxAbs = Math.max(
    m.revenue,
    m.cogsSales,
    m.expensesProjected,
    m.defectiveLoss,
    Math.abs(m.netProfitProjected),
    1,
  );

  return (
    <div className="space-y-1">
      {steps.map((s, i) => {
        const w = (Math.abs(s.amount) / maxAbs) * 100;
        const isNet = s.key === "net";
        const isNeg = s.amount < 0;
        return (
          <div key={s.key}>
            <div className="flex flex-wrap items-start justify-between gap-3 py-3 sm:py-3.5">
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[13px] font-semibold tracking-tight ${
                    isNet ? "text-[var(--foreground-strong)]" : "text-[var(--foreground)]"
                  }`}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--foreground-muted)]">
                  {s.sub}
                </p>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)] ring-1 ring-inset ring-[var(--border-subtle)]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                      isNeg
                        ? "bg-[color-mix(in_oklab,var(--danger)_75%,transparent)]"
                        : isNet && s.amount >= 0
                          ? "bg-[var(--success)]"
                          : "bg-[var(--accent)]"
                    }`}
                    style={{ width: `${Math.max(3, Math.min(100, w))}%` }}
                  />
                </div>
              </div>
              <p
                className={`shrink-0 text-right text-[14px] font-semibold tabular-nums tracking-tight ${
                  isNeg
                    ? "text-[var(--danger)]"
                    : isNet && s.amount >= 0
                      ? "text-[var(--success)]"
                      : "text-[var(--foreground-strong)]"
                }`}
              >
                {formatCurrency(s.amount)}
              </p>
            </div>
            {i < steps.length - 1 ? (
              <div className="h-px bg-[var(--border-subtle)]" aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type AlertTone = "info" | "warning" | "danger" | "neutral";

function toneClasses(tone: AlertTone) {
  switch (tone) {
    case "warning":
      return {
        chip: "bg-[var(--warning-soft)] text-[var(--warning)]",
        ring: "ring-[color-mix(in_oklab,var(--warning)_25%,transparent)]",
      };
    case "danger":
      return {
        chip: "bg-[var(--danger-soft)] text-[var(--danger)]",
        ring: "ring-[color-mix(in_oklab,var(--danger)_25%,transparent)]",
      };
    case "info":
      return {
        chip: "bg-[var(--accent-soft)] text-[var(--accent)]",
        ring: "ring-[color-mix(in_oklab,var(--accent)_22%,transparent)]",
      };
    case "neutral":
    default:
      return {
        chip: "bg-[var(--surface-muted)] text-[var(--foreground-muted)]",
        ring: "ring-[var(--border)]",
      };
  }
}

function AlertCard({
  tone,
  icon,
  title,
  value,
  description,
  items,
  href,
  hrefLabel = "Abrir",
  empty,
}: {
  tone: AlertTone;
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  items?: { key: string; primary: string; secondary?: string; value: string }[];
  href: string;
  hrefLabel?: string;
  empty?: boolean;
}) {
  const tc = toneClasses(empty ? "neutral" : tone);
  return (
    <Card>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ${tc.chip} ${tc.ring}`}
            aria-hidden
          >
            {icon}
          </span>
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            {hrefLabel}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
            {title}
          </p>
          <p className="text-[22px] font-semibold tabular-nums tracking-tight text-[var(--foreground-strong)]">
            {value}
          </p>
          <p className="text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
            {description}
          </p>
        </div>
        {items && items.length > 0 ? (
          <ul className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-3 text-[12.5px]">
            {items.map((it) => (
              <li
                key={it.key}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="truncate font-medium text-[var(--foreground)]">
                    {it.primary}
                  </span>
                  {it.secondary ? (
                    <span className="ml-2 text-[11.5px] text-[var(--foreground-subtle)]">
                      {it.secondary}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--foreground-muted)]">
                  {it.value}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

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
