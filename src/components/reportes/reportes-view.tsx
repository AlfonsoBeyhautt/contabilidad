"use client";

import { useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { useChartColors } from "@/contexts/theme-context";
import {
  filterDefectivesInRange,
  filterSalesInRange,
  productByIdMap,
  saleGrossProfit,
  saleLineRevenue,
  saleTotal,
  salesAggregatedByMonth,
  topProductsByRevenue,
} from "@/lib/data/finance-calcs";
import type { DefectiveReason } from "@/lib/data/types";
import { downloadCsv, downloadPdfTable } from "@/lib/export";
import { formatCurrency } from "@/lib/format";
import { endOfYear, startOfYear } from "date-fns";

export function ReportesView() {
  const { data } = useAppData();
  const chart = useChartColors();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [compareYear, setCompareYear] = useState(currentYear - 1);

  const rangeYear = useMemo(
    () => ({
      start: startOfYear(new Date(year, 0, 1)),
      end: endOfYear(new Date(year, 0, 1)),
    }),
    [year],
  );

  const salesY = useMemo(
    () => filterSalesInRange(data.sales, rangeYear),
    [data, rangeYear],
  );

  const defectivesY = useMemo(
    () => filterDefectivesInRange(data.defectives ?? [], rangeYear),
    [data, rangeYear],
  );

  const defectiveYearQty = defectivesY.reduce((a, d) => a + d.quantity, 0);
  const defectiveYearLoss = defectivesY.reduce(
    (a, d) => a + d.quantity * d.unitCost,
    0,
  );

  const monthly = useMemo(
    () => salesAggregatedByMonth(data.sales, year),
    [data, year],
  );
  const monthlyPrev = useMemo(
    () => salesAggregatedByMonth(data.sales, compareYear),
    [data, compareYear],
  );

  const combined = monthly.map((m, i) => ({
    mes: String(m.month).padStart(2, "0"),
    ingresos: Math.round(m.revenue),
    ingresosComp: Math.round(monthlyPrev[i]?.revenue ?? 0),
    ganancia: Math.round(m.gross),
  }));

  const pmap = useMemo(() => productByIdMap(data.products), [data.products]);

  const profitability = useMemo(() => {
    const map = new Map<
      string,
      { revenue: number; cogs: number; qty: number }
    >();
    for (const s of salesY) {
      for (const l of s.lines) {
        const rev = saleLineRevenue(l);
        const unit = s.costSnapshot[l.productId] ?? 0;
        const cg = unit * l.quantity;
        const cur = map.get(l.productId) ?? { revenue: 0, cogs: 0, qty: 0 };
        cur.revenue += rev;
        cur.cogs += cg;
        cur.qty += l.quantity;
        map.set(l.productId, cur);
      }
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        id,
        name: pmap.get(id)?.name ?? id,
        margin:
          v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0,
        profit: v.revenue - v.cogs,
        qty: v.qty,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [salesY, pmap]);

  const rotation = useMemo(() => {
    return topProductsByRevenue(salesY, data.products, 50).map((t) => {
      const p = pmap.get(t.productId);
      const avgStock = p ? Math.max(1, p.stock + t.quantity) : t.quantity;
      const score = t.quantity / avgStock;
      return { ...t, rotation: score };
    });
  }, [salesY, data.products, pmap]);

  const lowRotation = useMemo(
    () => [...rotation].sort((a, b) => a.rotation - b.rotation).slice(0, 6),
    [rotation],
  );

  const topCustomers = useMemo(() => {
    const spend = new Map<string, number>();
    for (const s of salesY) {
      if (!s.customerId) continue;
      spend.set(
        s.customerId,
        (spend.get(s.customerId) ?? 0) + saleTotal(s),
      );
    }
    return [...spend.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, total]) => ({
        id,
        name: data.customers.find((c) => c.id === id)?.name ?? id,
        total,
      }));
  }, [salesY, data.customers]);

  function exportMonthlyCsv() {
    downloadCsv(
      `reporte_mensual_${year}.csv`,
      monthly.map((m) => ({
        mes: m.month,
        ingresos: Math.round(m.revenue),
        cogs: Math.round(m.cogs),
        ganancia_bruta: Math.round(m.gross),
      })),
    );
  }

  function defectReasonLabel(r: DefectiveReason): string {
    if (r === "agujero") return "Agujero";
    if (r === "costura_fallada") return "Costura fallada";
    return "Otro";
  }

  function exportDefectivesCsv() {
    downloadCsv(
      `defectuosos_${year}.csv`,
      defectivesY.map((d) => ({
        producto: pmap.get(d.productId)?.name ?? d.productId,
        cantidad: d.quantity,
        costo_unitario: d.unitCost,
        costo_total: d.quantity * d.unitCost,
        motivo: defectReasonLabel(d.reason),
        registrado: d.recordedAt,
      })),
    );
  }

  function exportProfitPdf() {
    downloadPdfTable(
      `rentabilidad_${year}.pdf`,
      `Productos más rentables ${year}`,
      ["Producto", "Margen %", "Ganancia", "Unidades"],
      profitability.slice(0, 15).map((r) => [
        r.name,
        r.margin.toFixed(1),
        formatCurrency(r.profit),
        String(r.qty),
      ]),
    );
  }

  const avgMargin =
    salesY.length > 0
      ? (salesY.reduce((a, s) => a + saleGrossProfit(s), 0) /
          salesY.reduce((a, s) => a + saleTotal(s), 1)) *
        100
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Año informe
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block w-28 rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Comparar con año
          <input
            type="number"
            value={compareYear}
            onChange={(e) => setCompareYear(Number(e.target.value))}
            className="mt-1 block w-28 rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setCompareYear(year - 1);
            setYear(year);
          }}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700"
        >
          Año vs año anterior
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportMonthlyCsv}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Exportar CSV mensual
          </button>
          <button
            type="button"
            onClick={exportProfitPdf}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700"
          >
            PDF rentabilidad
          </button>
          <button
            type="button"
            onClick={exportDefectivesCsv}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700"
          >
            CSV defectuosos
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">
            Margen bruto promedio ({year})
          </p>
          <p className="mt-1 text-xl font-semibold">{avgMargin.toFixed(1)} %</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">
            Ingresos año {year}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatCurrency(monthly.reduce((a, m) => a + m.revenue, 0))}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">
            vs {compareYear}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatCurrency(monthlyPrev.reduce((a, m) => a + m.revenue, 0))}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">
            Pérdida defectuosos ({year})
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatCurrency(defectiveYearLoss)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {defectiveYearQty} unidades ·{" "}
            {defectivesY.length === 1
              ? "1 registro"
              : `${defectivesY.length} registros`}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Comparación de ingresos mes a mes"
          subtitle={`${year} vs ${compareYear}`}
        />
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combined}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v ?? 0))}
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${chart.tooltipBorder}`,
                  background: chart.tooltipBg,
                  color: chart.tooltipColor,
                  fontSize: 12,
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="ingresos" name={`${year}`} stroke={chart.linePrimary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ingresosComp" name={`${compareYear}`} stroke={chart.lineMuted} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Productos más rentables" subtitle={`Año ${year}`} />
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitability.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
                <XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v ?? 0))}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${chart.tooltipBorder}`,
                    background: chart.tooltipBg,
                    color: chart.tooltipColor,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="profit" fill={chart.lineAccent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Clientes más valiosos" subtitle={`Año ${year}`} />
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomers}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} height={70} />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v ?? 0))}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${chart.tooltipBorder}`,
                    background: chart.tooltipBg,
                    color: chart.tooltipColor,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill={chart.bar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Defectuosos / imperfectos"
          subtitle={`Registros con fecha en el año ${year} — no afectan stock vendible`}
        />
        <CardContent className="overflow-x-auto">
          {defectivesY.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay registros de defectuosos en este año.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                  <th className="py-2">Producto</th>
                  <th className="py-2 text-right">Cant.</th>
                  <th className="py-2 text-right">Costo u.</th>
                  <th className="py-2 text-right">Pérdida</th>
                  <th className="py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {defectivesY.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="py-2">
                      {pmap.get(d.productId)?.name ?? d.productId}
                    </td>
                    <td className="py-2 text-right tabular-nums">{d.quantity}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(d.unitCost)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(d.quantity * d.unitCost)}
                    </td>
                    <td className="py-2">{defectReasonLabel(d.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Menor rotación relativa (aprox.)"
          subtitle="Unidades vendidas vs stock aproximado — referencia operativa"
        />
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Unidades</th>
                <th className="py-2 text-right">Índice</th>
              </tr>
            </thead>
            <tbody>
              {lowRotation.map((r) => (
                <tr key={r.productId} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right tabular-nums">{r.quantity}</td>
                  <td className="py-2 text-right tabular-nums">
                    {r.rotation.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
