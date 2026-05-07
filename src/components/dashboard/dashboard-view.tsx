"use client";

import { differenceInCalendarDays } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  PiggyBank,
  ShoppingBag,
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
import { formatCurrency, formatPercent } from "@/lib/format";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function trendLabel(deltaPct: number, label: string) {
  const rounded = deltaPct.toFixed(1);
  if (Math.abs(deltaPct) < 0.05) return { label: `${label}: estable`, positive: undefined };
  return {
    label: `${label}: ${deltaPct >= 0 ? "+" : ""}${rounded} %`,
    positive: deltaPct >= 0,
  };
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
    preset === "este_mes"
      ? pctChange(m.revenue, mPrevMonth.revenue)
      : null;
  const netMomDelta =
    preset === "este_mes" ? pctChange(m.netProfit, mPrevMonth.netProfit) : null;

  const revenueYoyDelta = pctChange(m.revenue, mYoy.revenue);
  const netYoyDelta = pctChange(m.netProfit, mYoy.netProfit);

  const salesInRange = filterSalesInRange(data.sales, range);
  const topProducts = topProductsByRevenue(salesInRange, data.products, 6);

  const lowStock = data.products.filter((p) => stockStatus(p) === "bajo");
  const outStock = data.products.filter((p) => stockStatus(p) === "agotado");

  const now = new Date();
  const newCustomers = data.customers.filter((c) => {
    const reg = parseISODate(c.registeredAt);
    return differenceInCalendarDays(now, reg) <= 30;
  }).length;

  const year = now.getFullYear();
  const monthly = salesAggregatedByMonth(data.sales, year).map((row) => ({
    name: `${String(row.month).padStart(2, "0")}`,
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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Resumen financiero y operativo según el período seleccionado arriba.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <StatCard
          label="Ingresos"
          value={formatCurrency(m.revenue)}
          hint={`${m.saleCount} ventas · ${Math.round(m.unitsSold)} uds.`}
          trend={trendLabel(revenueYoyDelta, "vs mismo período año anterior")}
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Costo de mercadería (COGS)"
          value={formatCurrency(m.cogsSales)}
          hint="Según costos registrados en cada venta"
          icon={<ShoppingBag className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Gastos operativos"
          value={formatCurrency(m.expenses)}
          hint="No incluye compras de stock en este KPI"
          icon={<Wallet className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Defectuosos"
          value={formatCurrency(m.defectiveLoss)}
          hint="Pérdida de costo no vendible en el período"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Ganancia bruta"
          value={formatCurrency(m.grossProfit)}
          hint={formatPercent(m.grossMarginPct)}
          icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Ganancia neta"
          value={formatCurrency(m.netProfit)}
          trend={trendLabel(netYoyDelta, "vs mismo período año anterior")}
          icon={<PiggyBank className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Margen neto"
          value={formatPercent(m.marginPct)}
          hint="Neto / ingresos"
          trend={
            preset === "este_mes" && revenueMomDelta !== null && netMomDelta !== null
              ? {
                  label: `Mes ant.: ingresos ${revenueMomDelta >= 0 ? "+" : ""}${revenueMomDelta.toFixed(1)} % · neto ${netMomDelta >= 0 ? "+" : ""}${netMomDelta.toFixed(1)} %`,
                  positive: netMomDelta >= 0,
                }
              : undefined
          }
          icon={<TrendingDown className="h-5 w-5" aria-hidden />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Ingresos, gastos y ganancia bruta"
            subtitle={`Acumulado mensual · ${year}`}
          />
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMix}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(value) =>
                    formatCurrency(Number(value ?? 0))
                  }
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${chart.tooltipBorder}`,
                    background: chart.tooltipBg,
                    color: chart.tooltipColor,
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="Ingresos" stroke={chart.linePrimary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Gastos" stroke={chart.lineMuted} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Ganancia bruta" stroke={chart.lineAccent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Productos más vendidos (importe)" subtitle="En el período filtrado" />
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    formatCurrency(Number(value ?? 0))
                  }
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${chart.tooltipBorder}`,
                    background: chart.tooltipBg,
                    color: chart.tooltipColor,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" fill={chart.bar} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Stock bajo" subtitle={`Umbral de alerta activo`} />
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[...lowStock, ...outStock].slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800"
                >
                  <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {p.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {p.stock} uds · min {p.minStock}
                  </span>
                </li>
              ))}
              {lowStock.length === 0 && outStock.length === 0 ? (
                <li className="text-zinc-500">Sin alertas de stock.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Clientes nuevos (30 días)" subtitle="Registrados en el sistema" />
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {newCustomers}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Segmentación de clientes disponible en la sección Clientes.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Mejores clientes (lifetime)" subtitle="Por volumen histórico" />
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[...data.customers]
                .map((c) => ({
                  c,
                  ...customerMetrics(c, data.sales, data.products),
                }))
                .sort((a, b) => b.totalSpent - a.totalSpent)
                .slice(0, 5)
                .map(({ c, totalSpent, purchaseCount }) => (
                  <li
                    key={c.id}
                    className="flex justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatCurrency(totalSpent)} · {purchaseCount} compras
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
