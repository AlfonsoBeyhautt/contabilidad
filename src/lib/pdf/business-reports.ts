/**
 * Generadores de reportes PDF profesionales.
 *
 * Cada función toma `AppData` y devuelve un archivo descargable. Comparten el
 * mismo header/footer y look-and-feel definido en `foundation.ts`.
 *
 * Reportes incluidos:
 *   - generateSalesReport          (ventas en un rango)
 *   - generateCostsReport          (costos / compras de mercadería en un rango)
 *   - generateProfitReport         (ganancias / margen en un rango)
 *   - generateStockReport          (estado actual de stock, no usa período)
 *   - generateMonthlyReport        (informe ejecutivo mensual)
 *   - generateAnnualReport         (informe ejecutivo anual con evolución)
 */
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subYears,
} from "date-fns";
import {
  expensesByCategory,
  filterDefectivesInRange,
  filterExpensesInRange,
  filterPurchasesInRange,
  filterSalesInRange,
  periodMetrics,
  productByIdMap,
  saleCogs,
  saleGrossProfit,
  saleLineRevenue,
  saleTotal,
  salesAggregatedByMonth,
  stockStatus,
  topProductsByRevenue,
  type DateRange,
} from "@/lib/data/finance-calcs";
import type {
  AppData,
  ExpenseCategory,
  PaymentMethod,
} from "@/lib/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  COLORS,
  createReport,
  drawBullets,
  drawDonut,
  drawHorizontalBars,
  drawKpiGrid,
  drawLineChart,
  drawParagraph,
  drawSection,
  drawTable,
  drawVerticalBars,
  finishAndSave,
  monthLabel,
  rangeLabel,
  type DonutSlice,
} from "./foundation";

const CAT_COLORS: Record<ExpenseCategory, [number, number, number]> = {
  producción: [55, 65, 81],
  marketing: [37, 78, 138],
  "envíos": [180, 83, 9],
  otros: [120, 113, 108],
};

const CAT_LABELS: Record<ExpenseCategory, string> = {
  producción: "Producción",
  marketing: "Marketing",
  "envíos": "Envíos",
  otros: "Otros",
};

const PAYMENT_COLORS: Record<PaymentMethod, [number, number, number]> = {
  efectivo: [21, 128, 61],
  tarjeta: [37, 78, 138],
  transferencia: [124, 58, 237],
  otro: [120, 113, 108],
};

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function timestampSuffix(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function changePct(current: number, base: number): number {
  if (base === 0) return current > 0 ? 100 : 0;
  return ((current - base) / Math.abs(base)) * 100;
}

function fmtPct(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(decimals)} %`;
}

/* -------------------------------------------------------------------------- */
/* 1. Reporte de ventas                                                       */
/* -------------------------------------------------------------------------- */

export function generateSalesReport(
  data: AppData,
  range: DateRange,
  options?: { periodLabel?: string },
): void {
  const periodLabel = options?.periodLabel ?? rangeLabel(range.start, range.end);
  const ctx = createReport(
    data.settings,
    "Reporte de ventas",
    periodLabel,
    "Resumen ejecutivo del rendimiento comercial",
  );
  const currency = data.settings.currency || "ARS";
  const sales = filterSalesInRange(data.sales, range);
  const pmap = productByIdMap(data.products);

  const revenue = sales.reduce((a, s) => a + saleTotal(s), 0);
  const cogs = sales.reduce((a, s) => a + saleCogs(s), 0);
  const grossProfit = revenue - cogs;
  const unitsSold = sales.reduce(
    (a, s) => a + s.lines.reduce((b, l) => b + l.quantity, 0),
    0,
  );
  const avgTicket = sales.length > 0 ? revenue / sales.length : 0;

  drawKpiGrid(ctx, [
    { label: "Ingresos", value: formatCurrency(revenue, currency), tone: "positive" },
    { label: "Ganancia bruta", value: formatCurrency(grossProfit, currency), hint: `Margen ${(safeDiv(grossProfit, revenue) * 100).toFixed(1)}%`, tone: grossProfit >= 0 ? "positive" : "negative" },
    { label: "Ventas", value: String(sales.length), hint: `${unitsSold} unidades` },
    { label: "Ticket promedio", value: formatCurrency(avgTicket, currency) },
  ]);

  // Distribución por método de pago
  const paymentDistribution = new Map<PaymentMethod, number>();
  for (const s of sales) {
    paymentDistribution.set(
      s.paymentMethod,
      (paymentDistribution.get(s.paymentMethod) ?? 0) + saleTotal(s),
    );
  }
  if (paymentDistribution.size > 0) {
    drawSection(ctx, "Distribución por método de pago");
    const slices: DonutSlice[] = (
      Array.from(paymentDistribution.entries()) as [PaymentMethod, number][]
    )
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({
        label: `${k.charAt(0).toUpperCase()}${k.slice(1)}`,
        value: v,
        color: PAYMENT_COLORS[k] ?? COLORS.accent,
      }));
    drawDonut(ctx, slices, {
      centerLabel: "Total",
      centerValue: formatCurrency(revenue, currency),
    });
  }

  // Top productos
  const top = topProductsByRevenue(sales, data.products, 8);
  if (top.length > 0) {
    drawSection(ctx, "Productos más vendidos");
    drawHorizontalBars(
      ctx,
      top.map((t) => ({ label: t.name, value: t.revenue })),
      { currency },
    );
  }

  // Detalle de ventas (limitado a 25 para no saturar)
  drawSection(
    ctx,
    "Detalle de operaciones",
    sales.length > 25
      ? `Se muestran las 25 ventas más recientes (de ${sales.length} totales).`
      : `${sales.length} ventas registradas`,
  );
  const detail = [...sales]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 25)
    .map((s) => {
      const productos = s.lines
        .map((l) => `${l.quantity} × ${pmap.get(l.productId)?.name ?? "—"}`)
        .join("; ");
      return [
        formatDate(s.date),
        s.paymentMethod,
        productos,
        formatCurrency(saleTotal(s), currency),
      ];
    });
  drawTable(
    ctx,
    ["Fecha", "Pago", "Productos", "Total"],
    detail,
    {
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 22 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 28, halign: "right" },
      },
    },
  );

  // Conclusiones
  drawSection(ctx, "Conclusiones");
  const topProduct = top[0];
  const conclusions: string[] = [];
  conclusions.push(
    `Ingresos del período: ${formatCurrency(revenue, currency)} en ${sales.length} ventas; ticket promedio ${formatCurrency(avgTicket, currency)}.`,
  );
  if (topProduct) {
    conclusions.push(
      `Producto líder por facturación: ${topProduct.name} con ${formatCurrency(topProduct.revenue, currency)} (${topProduct.quantity} unidades).`,
    );
  }
  conclusions.push(
    `Margen bruto: ${(safeDiv(grossProfit, revenue) * 100).toFixed(1)}% — ganancia ${formatCurrency(grossProfit, currency)} sobre ${formatCurrency(revenue, currency)}.`,
  );
  if (paymentDistribution.size > 0) {
    const top1 = (
      Array.from(paymentDistribution.entries()) as [PaymentMethod, number][]
    ).sort((a, b) => b[1] - a[1])[0];
    conclusions.push(
      `Medio de pago dominante: ${top1[0]} (${((top1[1] / revenue) * 100).toFixed(1)}% del total).`,
    );
  }
  drawBullets(ctx, conclusions);

  finishAndSave(ctx, `reporte_ventas_${timestampSuffix()}.pdf`);
}

/* -------------------------------------------------------------------------- */
/* 2. Reporte de costos                                                       */
/* -------------------------------------------------------------------------- */

export function generateCostsReport(
  data: AppData,
  range: DateRange,
  options?: { periodLabel?: string },
): void {
  const periodLabel = options?.periodLabel ?? rangeLabel(range.start, range.end);
  const ctx = createReport(
    data.settings,
    "Reporte de costos",
    periodLabel,
    "Costo de ventas, compras de mercadería, gastos operativos y pérdidas",
  );
  const currency = data.settings.currency || "ARS";
  const pmap = productByIdMap(data.products);
  const sales = filterSalesInRange(data.sales, range);
  const purchases = filterPurchasesInRange(data.purchases, range);
  const expenses = filterExpensesInRange(data.expenses, range);
  const defectives = filterDefectivesInRange(data.defectives ?? [], range);

  const cogs = sales.reduce((a, s) => a + saleCogs(s), 0);
  const purchaseSpend = purchases.reduce((a, p) => a + p.quantity * p.unitCost, 0);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const defectiveLoss = defectives.reduce((a, d) => a + d.quantity * d.unitCost, 0);
  const totalOutflow = cogs + expenseTotal + defectiveLoss;

  drawKpiGrid(ctx, [
    { label: "COGS (costo ventas)", value: formatCurrency(cogs, currency), tone: "negative" },
    { label: "Compras de mercadería", value: formatCurrency(purchaseSpend, currency), hint: `${purchases.length} órdenes` },
    { label: "Gastos operativos", value: formatCurrency(expenseTotal, currency), hint: `${expenses.length} registros` },
    { label: "Pérdida defectuosos", value: formatCurrency(defectiveLoss, currency), hint: `${defectives.reduce((a, d) => a + d.quantity, 0)} uds`, tone: "warn" },
  ]);

  drawParagraph(
    ctx,
    `Egreso económico reconocido en el período: ${formatCurrency(totalOutflow, currency)} (COGS + gastos operativos + pérdida por defectuosos). Las compras de mercadería se contabilizan como inversión en inventario, no como costo del período.`,
  );

  // Gastos por categoría
  const byCat = expensesByCategory(expenses);
  const expenseCats = Object.entries(byCat).filter(([, v]) => (v as number) > 0);
  if (expenseCats.length > 0) {
    drawSection(ctx, "Gastos operativos por categoría");
    const slices: DonutSlice[] = expenseCats.map(([cat, v]) => ({
      label: CAT_LABELS[cat as ExpenseCategory] ?? cat,
      value: v as number,
      color: CAT_COLORS[cat as ExpenseCategory] ?? COLORS.accent,
    }));
    drawDonut(ctx, slices, {
      centerLabel: "Total",
      centerValue: formatCurrency(expenseTotal, currency),
    });
  }

  // Compras detalladas
  if (purchases.length > 0) {
    drawSection(ctx, "Compras de mercadería");
    const rows = [...purchases]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map((p) => [
        formatDate(p.date),
        pmap.get(p.productId)?.name ?? "(producto eliminado)",
        p.supplier || "—",
        String(p.quantity),
        formatCurrency(p.unitCost, currency),
        formatCurrency(p.quantity * p.unitCost, currency),
      ]);
    drawTable(
      ctx,
      ["Fecha", "Producto", "Proveedor", "Cant.", "Costo u.", "Total"],
      rows,
      {
        columnStyles: {
          3: { halign: "right", cellWidth: 14 },
          4: { halign: "right", cellWidth: 22 },
          5: { halign: "right", cellWidth: 24 },
        },
      },
    );
  }

  // Gastos detallados
  if (expenses.length > 0) {
    drawSection(ctx, "Gastos operativos");
    const rows = [...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 25)
      .map((e) => [
        formatDate(e.date),
        CAT_LABELS[e.category] ?? e.category,
        e.description,
        e.kind,
        formatCurrency(e.amount, currency),
      ]);
    drawTable(
      ctx,
      ["Fecha", "Categoría", "Descripción", "Tipo", "Monto"],
      rows,
      {
        columnStyles: {
          4: { halign: "right", cellWidth: 24 },
        },
      },
    );
  }

  // Conclusiones
  drawSection(ctx, "Conclusiones");
  const cogsPct = (safeDiv(cogs, totalOutflow) * 100).toFixed(1);
  const expensePct = (safeDiv(expenseTotal, totalOutflow) * 100).toFixed(1);
  drawBullets(ctx, [
    `Total de costos reconocidos: ${formatCurrency(totalOutflow, currency)} (COGS ${cogsPct}%, gastos ${expensePct}%).`,
    `Inversión en inventario del período: ${formatCurrency(purchaseSpend, currency)} en ${purchases.length} compras.`,
    defectiveLoss > 0
      ? `Pérdida por unidades defectuosas: ${formatCurrency(defectiveLoss, currency)} — revisar control de calidad.`
      : "Sin pérdidas registradas por unidades defectuosas en el período.",
  ]);

  finishAndSave(ctx, `reporte_costos_${timestampSuffix()}.pdf`);
}

/* -------------------------------------------------------------------------- */
/* 3. Reporte de ganancias                                                    */
/* -------------------------------------------------------------------------- */

export function generateProfitReport(
  data: AppData,
  range: DateRange,
  options?: { periodLabel?: string },
): void {
  const periodLabel = options?.periodLabel ?? rangeLabel(range.start, range.end);
  const ctx = createReport(
    data.settings,
    "Reporte de ganancias",
    periodLabel,
    "Análisis de margen, ganancia neta y rentabilidad por producto",
  );
  const currency = data.settings.currency || "ARS";
  const m = periodMetrics(data, range);
  const sales = filterSalesInRange(data.sales, range);
  const pmap = productByIdMap(data.products);

  drawKpiGrid(ctx, [
    { label: "Ingresos", value: formatCurrency(m.revenue, currency), tone: "positive" },
    {
      label: "Ganancia bruta",
      value: formatCurrency(m.grossProfit, currency),
      hint: `Margen ${m.grossMarginPct.toFixed(1)}%`,
      tone: m.grossProfit >= 0 ? "positive" : "negative",
    },
    {
      label: "Ganancia neta",
      value: formatCurrency(m.netProfit, currency),
      hint: `Margen ${m.marginPct.toFixed(1)}%`,
      tone: m.netProfit >= 0 ? "positive" : "negative",
    },
    {
      label: "Egresos totales",
      value: formatCurrency(m.cogsSales + m.expenses + m.defectiveLoss, currency),
      hint: "COGS + gastos + pérdidas",
    },
  ]);

  drawParagraph(
    ctx,
    `La ganancia neta se calcula como Ingresos − COGS − Gastos operativos − Pérdida por defectuosos. ` +
      `Las compras de mercadería no impactan resultado del período (inventario).`,
  );

  // Rentabilidad por producto
  const profitabilityMap = new Map<
    string,
    { revenue: number; cogs: number; qty: number }
  >();
  for (const s of sales) {
    for (const l of s.lines) {
      const rev = saleLineRevenue(l);
      const unit = s.costSnapshot[l.productId] ?? 0;
      const cur = profitabilityMap.get(l.productId) ?? {
        revenue: 0,
        cogs: 0,
        qty: 0,
      };
      cur.revenue += rev;
      cur.cogs += unit * l.quantity;
      cur.qty += l.quantity;
      profitabilityMap.set(l.productId, cur);
    }
  }
  const profitability = Array.from(profitabilityMap.entries())
    .map(([id, v]) => ({
      id,
      name: pmap.get(id)?.name ?? "(producto eliminado)",
      revenue: v.revenue,
      profit: v.revenue - v.cogs,
      margin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0,
      qty: v.qty,
    }))
    .sort((a, b) => b.profit - a.profit);

  if (profitability.length > 0) {
    drawSection(
      ctx,
      "Productos más rentables",
      "Ranking por ganancia bruta acumulada",
    );
    drawHorizontalBars(
      ctx,
      profitability.slice(0, 8).map((p) => ({ label: p.name, value: p.profit })),
      { currency },
    );

    drawSection(ctx, "Detalle de rentabilidad por producto");
    drawTable(
      ctx,
      ["Producto", "Unidades", "Ingresos", "Ganancia", "Margen"],
      profitability.slice(0, 25).map((p) => [
        p.name,
        String(p.qty),
        formatCurrency(p.revenue, currency),
        formatCurrency(p.profit, currency),
        `${p.margin.toFixed(1)}%`,
      ]),
      {
        columnStyles: {
          1: { halign: "right", cellWidth: 22 },
          2: { halign: "right", cellWidth: 32 },
          3: { halign: "right", cellWidth: 32 },
          4: { halign: "right", cellWidth: 22 },
        },
      },
    );
  }

  drawSection(ctx, "Conclusiones");
  const topProfit = profitability[0];
  const conclusions: string[] = [];
  conclusions.push(
    m.netProfit >= 0
      ? `Resultado neto positivo: ${formatCurrency(m.netProfit, currency)} (margen ${m.marginPct.toFixed(1)}%).`
      : `Resultado neto negativo: ${formatCurrency(m.netProfit, currency)} (margen ${m.marginPct.toFixed(1)}%). Revisar estructura de costos.`,
  );
  if (topProfit) {
    conclusions.push(
      `Producto más rentable: ${topProfit.name} con ${formatCurrency(topProfit.profit, currency)} de ganancia (margen ${topProfit.margin.toFixed(1)}%).`,
    );
  }
  if (m.defectiveLoss > 0) {
    conclusions.push(
      `Pérdida por defectuosos: ${formatCurrency(m.defectiveLoss, currency)} — impacto de ${(safeDiv(m.defectiveLoss, m.revenue) * 100).toFixed(1)}% sobre ingresos.`,
    );
  }
  drawBullets(ctx, conclusions);

  finishAndSave(ctx, `reporte_ganancias_${timestampSuffix()}.pdf`);
}

/* -------------------------------------------------------------------------- */
/* 4. Reporte de stock                                                        */
/* -------------------------------------------------------------------------- */

export function generateStockReport(data: AppData): void {
  const ctx = createReport(
    data.settings,
    "Reporte de stock",
    `Foto al ${formatDate(new Date().toISOString())}`,
    "Estado actual del inventario y alertas de reposición",
  );
  const currency = data.settings.currency || "ARS";
  const products = data.products;
  const familyById = new Map(data.productFamilies.map((f) => [f.id, f]));

  const valuation = products.reduce((a, p) => a + p.stock * p.purchaseCost, 0);
  const totalUnits = products.reduce((a, p) => a + p.stock, 0);
  const low = products.filter((p) => stockStatus(p) === "bajo");
  const out = products.filter((p) => stockStatus(p) === "agotado");

  drawKpiGrid(ctx, [
    { label: "Valor inventario al costo", value: formatCurrency(valuation, currency) },
    { label: "Unidades totales", value: String(totalUnits) },
    {
      label: "Stock bajo",
      value: String(low.length),
      hint: "por debajo del mínimo",
      tone: low.length > 0 ? "warn" : "neutral",
    },
    {
      label: "Agotados",
      value: String(out.length),
      hint: "sin stock disponible",
      tone: out.length > 0 ? "negative" : "neutral",
    },
  ]);

  // Top productos por valor de inventario
  drawSection(ctx, "Top productos por valor de inventario");
  const byValue = [...products]
    .map((p) => ({
      name: p.name,
      value: p.stock * p.purchaseCost,
      stock: p.stock,
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  drawHorizontalBars(
    ctx,
    byValue.map((p) => ({ label: p.name, value: p.value })),
    { currency },
  );

  if (out.length > 0) {
    drawSection(
      ctx,
      "Productos agotados",
      "Acción recomendada: reponer urgente o pausar oferta",
    );
    drawTable(
      ctx,
      ["Producto", "Familia", "Stock mínimo", "Costo u."],
      out.map((p) => [
        p.name,
        familyById.get(p.familyId)?.name ?? "—",
        String(p.minStock),
        formatCurrency(p.purchaseCost, currency),
      ]),
      {
        columnStyles: {
          2: { halign: "right", cellWidth: 24 },
          3: { halign: "right", cellWidth: 26 },
        },
      },
    );
  }

  if (low.length > 0) {
    drawSection(
      ctx,
      "Stock por debajo del mínimo",
      "Programar reposición para no quedar fuera de oferta",
    );
    drawTable(
      ctx,
      ["Producto", "Stock actual", "Mínimo", "Faltante", "Costo reponer*"],
      low.map((p) => {
        const gap = Math.max(0, p.minStock - p.stock);
        return [
          p.name,
          String(p.stock),
          String(p.minStock),
          String(gap),
          formatCurrency(gap * p.purchaseCost, currency),
        ];
      }),
      {
        columnStyles: {
          1: { halign: "right", cellWidth: 22 },
          2: { halign: "right", cellWidth: 20 },
          3: { halign: "right", cellWidth: 22 },
          4: { halign: "right", cellWidth: 30 },
        },
      },
    );
    drawParagraph(
      ctx,
      "* Costo de reponer = unidades faltantes × costo unitario actual del producto.",
      { size: 8 },
    );
  }

  drawSection(ctx, "Inventario completo");
  const allRows = [...products]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => [
      p.name,
      familyById.get(p.familyId)?.name ?? "—",
      String(p.stock),
      String(p.minStock),
      formatCurrency(p.purchaseCost, currency),
      formatCurrency(p.stock * p.purchaseCost, currency),
    ]);
  drawTable(
    ctx,
    ["Producto", "Familia", "Stock", "Mínimo", "Costo u.", "Valor total"],
    allRows,
    {
      columnStyles: {
        2: { halign: "right", cellWidth: 18 },
        3: { halign: "right", cellWidth: 18 },
        4: { halign: "right", cellWidth: 24 },
        5: { halign: "right", cellWidth: 26 },
      },
    },
  );

  drawSection(ctx, "Conclusiones");
  const conclusions: string[] = [
    `Valor total del inventario al costo: ${formatCurrency(valuation, currency)} (${totalUnits} unidades, ${products.length} variantes).`,
  ];
  if (out.length > 0) {
    conclusions.push(
      `Hay ${out.length} producto${out.length === 1 ? "" : "s"} agotado${out.length === 1 ? "" : "s"} requiriendo reposición inmediata.`,
    );
  }
  if (low.length > 0) {
    const totalGap = low.reduce(
      (a, p) => a + Math.max(0, p.minStock - p.stock) * p.purchaseCost,
      0,
    );
    conclusions.push(
      `${low.length} producto${low.length === 1 ? "" : "s"} bajo el mínimo. Costo estimado de reposición: ${formatCurrency(totalGap, currency)}.`,
    );
  }
  if (out.length === 0 && low.length === 0) {
    conclusions.push("Niveles de stock saludables; sin alertas activas.");
  }
  drawBullets(ctx, conclusions);

  finishAndSave(ctx, `reporte_stock_${timestampSuffix()}.pdf`);
}

/* -------------------------------------------------------------------------- */
/* 5. Reporte general mensual                                                 */
/* -------------------------------------------------------------------------- */

export function generateMonthlyReport(
  data: AppData,
  year: number,
  month: number,
): void {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  const range: DateRange = { start: startOfDay(start), end: endOfDay(end) };

  // Comparativo: mismo mes año anterior
  const prevStart = startOfMonth(new Date(year - 1, month - 1, 1));
  const prevEnd = endOfMonth(prevStart);
  const prevRange: DateRange = {
    start: startOfDay(prevStart),
    end: endOfDay(prevEnd),
  };

  const ctx = createReport(
    data.settings,
    "Reporte mensual",
    monthLabel(month, year),
    "Resumen ejecutivo del mes con comparativo interanual",
  );
  const currency = data.settings.currency || "ARS";

  const m = periodMetrics(data, range);
  const mPrev = periodMetrics(data, prevRange);
  const sales = filterSalesInRange(data.sales, range);
  const pmap = productByIdMap(data.products);
  const top = topProductsByRevenue(sales, data.products, 6);
  const low = data.products.filter((p) => stockStatus(p) === "bajo");

  // Conclusiones
  const revenueChange = changePct(m.revenue, mPrev.revenue);
  const profitChange = changePct(m.netProfit, mPrev.netProfit);

  drawKpiGrid(ctx, [
    {
      label: "Ventas (ingresos)",
      value: formatCurrency(m.revenue, currency),
      hint: `vs ${monthLabel(month, year - 1)} ${fmtPct(revenueChange)}`,
      tone: revenueChange >= 0 ? "positive" : "negative",
    },
    {
      label: "Ganancia neta",
      value: formatCurrency(m.netProfit, currency),
      hint: `Margen ${m.marginPct.toFixed(1)}%`,
      tone: m.netProfit >= 0 ? "positive" : "negative",
    },
    {
      label: "Producto más vendido",
      value: top[0]?.name ?? "—",
      hint: top[0] ? `${top[0].quantity} unidades` : "Sin datos",
    },
    {
      label: "Stock bajo",
      value: String(low.length),
      hint: "Alertas activas",
      tone: low.length > 0 ? "warn" : "neutral",
    },
  ]);

  drawParagraph(
    ctx,
    `Este informe consolida el desempeño operativo de ${monthLabel(month, year)}. ` +
      `Se incluye comparativo con el mismo mes del año anterior, distribución de ventas, ` +
      `gastos por categoría y alertas operativas relevantes para la toma de decisión.`,
  );

  // KPIs adicionales
  drawSection(ctx, "Métricas clave");
  drawTable(
    ctx,
    ["Métrica", "Mes actual", `${monthLabel(month, year - 1)}`, "Variación"],
    [
      [
        "Ingresos",
        formatCurrency(m.revenue, currency),
        formatCurrency(mPrev.revenue, currency),
        fmtPct(revenueChange),
      ],
      [
        "COGS (costo ventas)",
        formatCurrency(m.cogsSales, currency),
        formatCurrency(mPrev.cogsSales, currency),
        fmtPct(changePct(m.cogsSales, mPrev.cogsSales)),
      ],
      [
        "Gastos operativos",
        formatCurrency(m.expenses, currency),
        formatCurrency(mPrev.expenses, currency),
        fmtPct(changePct(m.expenses, mPrev.expenses)),
      ],
      [
        "Ganancia bruta",
        formatCurrency(m.grossProfit, currency),
        formatCurrency(mPrev.grossProfit, currency),
        fmtPct(changePct(m.grossProfit, mPrev.grossProfit)),
      ],
      [
        "Ganancia neta",
        formatCurrency(m.netProfit, currency),
        formatCurrency(mPrev.netProfit, currency),
        fmtPct(profitChange),
      ],
      [
        "Ventas",
        String(m.saleCount),
        String(mPrev.saleCount),
        fmtPct(changePct(m.saleCount, mPrev.saleCount)),
      ],
    ],
    {
      columnStyles: {
        1: { halign: "right", cellWidth: 32 },
        2: { halign: "right", cellWidth: 36 },
        3: { halign: "right", cellWidth: 22 },
      },
    },
  );

  // Ventas diarias del mes
  drawSection(ctx, "Evolución de ingresos diarios");
  const daysInMonth = end.getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({
    label: String(i + 1).padStart(2, "0"),
    value: 0,
  }));
  for (const s of sales) {
    const d = new Date(s.date);
    const day = d.getDate();
    if (day >= 1 && day <= daysInMonth) {
      daily[day - 1].value += saleTotal(s);
    }
  }
  drawLineChart(ctx, daily, { currency, height: 55 });

  // Gastos por categoría (con donut)
  const expenses = filterExpensesInRange(data.expenses, range);
  const byCat = expensesByCategory(expenses);
  const expenseCats = Object.entries(byCat).filter(([, v]) => (v as number) > 0);
  if (expenseCats.length > 0) {
    drawSection(ctx, "Gastos del mes por categoría");
    const slices: DonutSlice[] = expenseCats.map(([cat, v]) => ({
      label: CAT_LABELS[cat as ExpenseCategory] ?? cat,
      value: v as number,
      color: CAT_COLORS[cat as ExpenseCategory] ?? COLORS.accent,
    }));
    drawDonut(ctx, slices, {
      centerLabel: "Total",
      centerValue: formatCurrency(m.expenses, currency),
    });
  }

  // Top productos
  if (top.length > 0) {
    drawSection(ctx, "Productos más vendidos");
    drawHorizontalBars(
      ctx,
      top.map((t) => ({ label: t.name, value: t.revenue })),
      { currency },
    );
  }

  // Conclusiones ejecutivas
  drawSection(ctx, "Conclusiones ejecutivas");
  const conclusions: string[] = [];
  conclusions.push(
    revenueChange >= 0
      ? `Ingresos creciendo ${fmtPct(revenueChange)} frente al mismo mes del año anterior (${formatCurrency(mPrev.revenue, currency)} → ${formatCurrency(m.revenue, currency)}).`
      : `Ingresos cayendo ${fmtPct(revenueChange)} frente al mismo mes del año anterior. Revisar canales de venta y estrategia comercial.`,
  );
  conclusions.push(
    m.netProfit >= 0
      ? `Mes con resultado positivo: ${formatCurrency(m.netProfit, currency)} de ganancia neta (margen ${m.marginPct.toFixed(1)}%).`
      : `Mes con resultado negativo: ${formatCurrency(m.netProfit, currency)}. Evaluar reducción de gastos o ajuste de precios.`,
  );
  if (top[0]) {
    conclusions.push(
      `Producto destacado: ${top[0].name} con ${formatCurrency(top[0].revenue, currency)} en ingresos y ${top[0].quantity} unidades vendidas.`,
    );
  }
  if (low.length > 0) {
    const sample = low
      .slice(0, 3)
      .map((p) => pmap.get(p.id)?.name ?? p.name)
      .join(", ");
    conclusions.push(
      `${low.length} producto${low.length === 1 ? "" : "s"} bajo stock mínimo${low.length > 0 ? ` (ej. ${sample})` : ""}. Programar reposición.`,
    );
  }
  drawBullets(ctx, conclusions);

  finishAndSave(
    ctx,
    `reporte_mensual_${year}-${String(month).padStart(2, "0")}.pdf`,
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Reporte anual                                                           */
/* -------------------------------------------------------------------------- */

export function generateAnnualReport(data: AppData, year: number): void {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(start);
  const range: DateRange = { start: startOfDay(start), end: endOfDay(end) };

  const prevStart = startOfYear(subYears(start, 1));
  const prevEnd = endOfYear(prevStart);
  const prevRange: DateRange = {
    start: startOfDay(prevStart),
    end: endOfDay(prevEnd),
  };

  const ctx = createReport(
    data.settings,
    "Reporte anual",
    `Año ${year}`,
    "Cierre integral del ejercicio con comparativo y evolución mensual",
  );
  const currency = data.settings.currency || "ARS";

  const m = periodMetrics(data, range);
  const mPrev = periodMetrics(data, prevRange);
  const sales = filterSalesInRange(data.sales, range);
  const top = topProductsByRevenue(sales, data.products, 8);
  const monthlySales = salesAggregatedByMonth(data.sales, year);
  const prevMonthlySales = salesAggregatedByMonth(data.sales, year - 1);

  drawKpiGrid(ctx, [
    {
      label: "Ingresos anuales",
      value: formatCurrency(m.revenue, currency),
      hint: `vs ${year - 1} ${fmtPct(changePct(m.revenue, mPrev.revenue))}`,
      tone: m.revenue >= mPrev.revenue ? "positive" : "negative",
    },
    {
      label: "Ganancia neta",
      value: formatCurrency(m.netProfit, currency),
      hint: `Margen ${m.marginPct.toFixed(1)}%`,
      tone: m.netProfit >= 0 ? "positive" : "negative",
    },
    {
      label: "Ventas",
      value: String(m.saleCount),
      hint: `${m.unitsSold} unidades`,
    },
    {
      label: "Gastos operativos",
      value: formatCurrency(m.expenses, currency),
      hint: `vs ${year - 1} ${fmtPct(changePct(m.expenses, mPrev.expenses))}`,
    },
  ]);

  drawParagraph(
    ctx,
    `Cierre integral del año ${year}: indicadores principales, evolución mes a mes y ` +
      `comparativo contra el ejercicio ${year - 1}. Incluye productos de mayor facturación y ` +
      `composición de gastos para análisis estratégico.`,
  );

  // Evolución mensual de ventas (línea con comparativo)
  drawSection(
    ctx,
    "Evolución de ingresos por mes",
    `${year} contra ${year - 1}`,
  );
  const monthsLabels = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  drawLineChart(
    ctx,
    monthlySales.map((m, i) => ({ label: monthsLabels[i], value: m.revenue })),
    {
      currency,
      secondary: prevMonthlySales.map((m, i) => ({
        label: monthsLabels[i],
        value: m.revenue,
      })),
      primaryLabel: String(year),
      secondaryLabel: String(year - 1),
      height: 65,
    },
  );

  // Ganancia mensual (barras)
  drawSection(ctx, "Ganancia bruta mensual");
  drawVerticalBars(
    ctx,
    monthlySales.map((m, i) => ({
      label: monthsLabels[i],
      value: m.gross,
    })),
    { currency, height: 60 },
  );

  // Top productos
  if (top.length > 0) {
    drawSection(ctx, "Productos más vendidos del año");
    drawHorizontalBars(
      ctx,
      top.map((t) => ({ label: t.name, value: t.revenue })),
      { currency },
    );
  }

  // Tabla resumen mensual
  drawSection(ctx, "Detalle mensual");
  drawTable(
    ctx,
    ["Mes", "Ingresos", "COGS", "Ganancia bruta", "Margen"],
    monthlySales.map((row, i) => [
      monthsLabels[i],
      formatCurrency(row.revenue, currency),
      formatCurrency(row.cogs, currency),
      formatCurrency(row.gross, currency),
      `${(safeDiv(row.gross, row.revenue) * 100).toFixed(1)}%`,
    ]),
    {
      columnStyles: {
        1: { halign: "right", cellWidth: 32 },
        2: { halign: "right", cellWidth: 32 },
        3: { halign: "right", cellWidth: 36 },
        4: { halign: "right", cellWidth: 22 },
      },
    },
  );

  // Conclusiones
  drawSection(ctx, "Conclusiones del ejercicio");
  const bestMonth = monthlySales
    .map((row, i) => ({ ...row, idx: i }))
    .sort((a, b) => b.revenue - a.revenue)[0];
  const worstMonth = monthlySales
    .map((row, i) => ({ ...row, idx: i }))
    .sort((a, b) => a.revenue - b.revenue)[0];
  const conclusions: string[] = [];
  conclusions.push(
    m.revenue >= mPrev.revenue
      ? `Ingresos en crecimiento: ${formatCurrency(m.revenue, currency)} (${fmtPct(changePct(m.revenue, mPrev.revenue))} vs ${year - 1}).`
      : `Ingresos en contracción: ${formatCurrency(m.revenue, currency)} (${fmtPct(changePct(m.revenue, mPrev.revenue))} vs ${year - 1}).`,
  );
  if (bestMonth && bestMonth.revenue > 0) {
    conclusions.push(
      `Mejor mes: ${monthsLabels[bestMonth.idx]} con ${formatCurrency(bestMonth.revenue, currency)}. Peor mes: ${monthsLabels[worstMonth.idx]} con ${formatCurrency(worstMonth.revenue, currency)}.`,
    );
  }
  conclusions.push(
    m.netProfit >= 0
      ? `Resultado anual positivo: ${formatCurrency(m.netProfit, currency)} de ganancia neta.`
      : `Resultado anual negativo: ${formatCurrency(m.netProfit, currency)}. Revisar estrategia de pricing y estructura de costos.`,
  );
  if (top[0]) {
    conclusions.push(
      `Producto líder del año: ${top[0].name} (${formatCurrency(top[0].revenue, currency)}; ${top[0].quantity} unidades).`,
    );
  }
  drawBullets(ctx, conclusions);

  finishAndSave(ctx, `reporte_anual_${year}.pdf`);
}
