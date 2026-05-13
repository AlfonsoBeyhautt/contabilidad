"use client";

import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  PackageX,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart as RBarChart,
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
  periodMetrics,
  salesAggregatedByMonth,
  stockStatus,
  topProductsByRevenue,
  type DateRange,
} from "@/lib/data/finance-calcs";
import { upcomingPayments } from "@/lib/data/calendar-helpers";
import { formatCurrency, formatPercent } from "@/lib/format";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const presetLabels: Record<string, string> = {
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

  const m = periodMetrics(data, range);
  const yoyRange = compareToPreviousYear(range);
  const mYoy = periodMetrics(data, yoyRange);

  const prevMonthRange = monthPreviousRange(range);
  const mPrevMonth = periodMetrics(data, prevMonthRange);

  const revenueMomDelta =
    preset === "este_mes" ? pctChange(m.revenue, mPrevMonth.revenue) : null;
  const netMomDelta =
    preset === "este_mes" ? pctChange(m.netProfit, mPrevMonth.netProfit) : null;
  const expensesMomDelta =
    preset === "este_mes" ? pctChange(m.expenses, mPrevMonth.expenses) : null;

  const revenueYoyDelta = pctChange(m.revenue, mYoy.revenue);
  const netYoyDelta = pctChange(m.netProfit, mYoy.netProfit);
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
  }));

  const expensesByMonth = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year, i, 1);
    const monthEnd = new Date(year, i + 1, 0, 23, 59, 59);
    const r: DateRange = { start: monthStart, end: monthEnd };
    const ex = periodMetrics(data, r).expenses;
    return ex;
  });
  for (let i = 0; i < 12; i++) {
    monthly[i].Gastos = Math.round(expensesByMonth[i] ?? 0);
  }

  const chartMix = monthly.map((row) => ({
    ...row,
    "Ganancia neta": Math.round(row["Ganancia bruta"] - row.Gastos),
  }));

  const next7Days = upcomingPayments(data, 7);
  const next7Total = next7Days.reduce((a, it) => a + it.amount, 0);

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
    <div className="space-y-10 pb-8">
      {/* ── Hero stripe ─────────────────────────────────────────────────── */}
      <section className="space-y-6 animate-rise">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">
            Panel ejecutivo · {periodLabel}
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[32px]">
            {greeting()},{" "}
            <span className="text-[var(--foreground-muted)] font-medium">
              acá está tu resumen.
            </span>
          </h1>
          <p className="max-w-3xl text-[13.5px] text-[var(--foreground-muted)]">
            Indicadores clave del negocio, evolución mensual y atención
            prioritaria. Cambiá el período desde la barra superior para
            ajustar el alcance de los datos.
          </p>
        </div>

        {/* Hero KPI cards (3 destacadas) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            size="hero"
            accent="info"
            label="Ingresos"
            value={formatCurrency(m.revenue)}
            hint={`${m.saleCount} ventas · ${Math.round(m.unitsSold)} uds.`}
            icon={<TrendingUp className="h-4 w-4" aria-hidden />}
            delta={{
              value: revenueYoyDelta,
              label: "vs año anterior",
              neutralOnZero: true,
            }}
          />
          <StatCard
            size="hero"
            accent="positive"
            label="Ganancia neta"
            value={formatCurrency(m.netProfit)}
            hint={`Margen ${formatPercent(m.marginPct)}`}
            icon={<PiggyBank className="h-4 w-4" aria-hidden />}
            delta={{
              value: netYoyDelta,
              label: "vs año anterior",
              neutralOnZero: true,
            }}
          />
          <StatCard
            size="hero"
            accent="neutral"
            label="Ganancia bruta"
            value={formatCurrency(m.grossProfit)}
            hint={formatPercent(m.grossMarginPct)}
            icon={<BarChart3 className="h-4 w-4" aria-hidden />}
            delta={{
              value: grossYoyDelta,
              label: "vs año anterior",
              neutralOnZero: true,
            }}
          />
        </div>

        {/* Secondary KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Costo de mercadería"
            value={formatCurrency(m.cogsSales)}
            hint="COGS de las ventas del período"
            icon={<ShoppingBag className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            label="Gastos operativos"
            value={formatCurrency(m.expenses)}
            hint="No incluye compras de stock"
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
            label="Pérdida por defectuosos"
            value={formatCurrency(m.defectiveLoss)}
            hint="Costo de unidades no vendibles"
            icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
            accent={m.defectiveLoss > 0 ? "warning" : "neutral"}
          />
          <StatCard
            label="Margen neto"
            value={formatPercent(m.marginPct)}
            hint="Neto / ingresos"
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
      </section>

      {/* ── Atención prioritaria ────────────────────────────────────────── */}
      {totalAlerts > 0 ? (
        <section className="space-y-4">
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
        </section>
      ) : null}

      {/* ── Evolución y top productos ───────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Performance"
          title="Evolución del negocio"
          description={`Comparativa mensual de ingresos, gastos y ganancia neta durante ${year}. Los topes se calculan con datos cerrados de cada mes.`}
        />
        <div className="grid gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader
              eyebrow="Mensual"
              title="Ingresos, gastos y ganancia neta"
              subtitle={`Acumulado mensual · ${year}`}
            />
            <CardContent className="h-[320px] pl-2 pr-4 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartMix}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={chart.areaPrimaryTop}
                        stopOpacity={1}
                      />
                      <stop
                        offset="100%"
                        stopColor={chart.areaPrimaryBottom}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
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
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.grid, opacity: 0.35 }} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: 12,
                      color: chart.axisLabel,
                      paddingTop: 8,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Ingresos"
                    stroke={chart.lineAccent}
                    strokeWidth={2}
                    fill="url(#grad-revenue)"
                    fillOpacity={1}
                  />
                  <Bar
                    dataKey="Gastos"
                    fill={chart.lineMuted}
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                    fillOpacity={0.55}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ganancia neta"
                    stroke={chart.linePositive}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
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
