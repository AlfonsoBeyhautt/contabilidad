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
  expensesForReportingPeriod,
  filterDefectivesInRange,
  filterExpensesInRange,
  filterPurchasesInRange,
  filterSalesInRange,
  periodMetricsByMonth,
  periodMetricsWithProjections,
  productByIdMap,
  saleCogs,
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
  ExpenseRecurrence,
  PaymentMethod,
  Product,
  ProductFamily,
} from "@/lib/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  COLORS,
  createReport,
  drawBullets,
  drawDonut,
  drawHeroKpi,
  drawHorizontalBars,
  drawKpiGrid,
  drawLineChart,
  drawParagraph,
  drawSection,
  drawStackedBars,
  drawTable,
  drawVerticalBars,
  finishAndSave,
  forcePageBreak,
  monthLabel,
  rangeLabel,
  type DonutSlice,
  type StackPoint,
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

/** Orden catálogo: familia → modelo → nombre (misma lógica que la vista Stock). */
function sortProductsForStockPdf(products: Product[], families: ProductFamily[]): Product[] {
  const famMap = new Map(families.map((f) => [f.id, f]));
  return [...products].sort((a, b) => {
    const fa = famMap.get(a.familyId)?.name ?? "";
    const fb = famMap.get(b.familyId)?.name ?? "";
    const c1 = fa.localeCompare(fb, "es", { sensitivity: "base" });
    if (c1 !== 0) return c1;
    const c2 = a.model.localeCompare(b.model, "es", { sensitivity: "base" });
    if (c2 !== 0) return c2;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
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
    "Facturación y margen bruto del período",
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
  drawSection(ctx, "Síntesis");
  const topProduct = top[0];
  const conclusions: string[] = [
    `${formatCurrency(revenue, currency)} · ${sales.length} operaciones · ticket medio ${formatCurrency(avgTicket, currency)}.`,
    topProduct
      ? `Mayor facturación: ${topProduct.name} (${formatCurrency(topProduct.revenue, currency)}, ${topProduct.quantity} uds).`
      : `Sin líneas de venta con producto identificado.`,
    `Margen bruto ${(safeDiv(grossProfit, revenue) * 100).toFixed(1)}% (${formatCurrency(grossProfit, currency)}).`,
  ];
  if (paymentDistribution.size > 0) {
    const top1 = (
      Array.from(paymentDistribution.entries()) as [PaymentMethod, number][]
    ).sort((a, b) => b[1] - a[1])[0];
    conclusions.push(
      `Medio de pago principal: ${top1[0]} (${((top1[1] / revenue) * 100).toFixed(1)}%).`,
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
    "COGS, compras, gastos operativos y defectuosos",
  );
  const currency = data.settings.currency || "ARS";
  const pmap = productByIdMap(data.products);
  const sales = filterSalesInRange(data.sales, range);
  const purchases = filterPurchasesInRange(data.purchases, range);
  const expenses = filterExpensesInRange(data.expenses, range);
  const defectives = filterDefectivesInRange(data.defectives ?? [], range);

  const cogs = sales.reduce((a, s) => a + saleCogs(s), 0);
  const purchaseSpend = purchases.reduce((a, p) => a + p.quantity * p.unitCost, 0);
  const expBreakdown = expensesForReportingPeriod(data, range);
  const defectiveLoss = defectives.reduce((a, d) => a + d.quantity * d.unitCost, 0);
  const totalOutflow = cogs + expBreakdown.total + defectiveLoss;

  drawKpiGrid(ctx, [
    { label: "COGS (costo ventas)", value: formatCurrency(cogs, currency), tone: "negative" },
    { label: "Compras de mercadería", value: formatCurrency(purchaseSpend, currency), hint: `${purchases.length} órdenes` },
    {
      label: "Gastos operativos",
      value: formatCurrency(expBreakdown.total, currency),
      hint:
        expBreakdown.projectedTotal > 0
          ? `Emitido ${formatCurrency(expBreakdown.emittedTotal, currency)} + proyectado ${formatCurrency(expBreakdown.projectedTotal, currency)}`
          : `${expenses.length} registros emitidos`,
      tone: "negative",
    },
    {
      label: "Pérdida defectuosos",
      value: formatCurrency(defectiveLoss, currency),
      hint: `${defectives.reduce((a, d) => a + d.quantity, 0)} uds`,
      tone: "warn",
    },
  ]);

  drawParagraph(
    ctx,
    `Egresos reconocidos o esperados: ${formatCurrency(totalOutflow, currency)} (COGS + gastos operativos con recurrencias proyectadas + defectuosos). Las compras de mercadería figuran como movimiento de inventario.`,
    { size: 8.5 },
  );

  // Gastos por categoría (totales: emitido + proyectado)
  const expenseCatsTotal = Object.entries(expBreakdown.totalByCategory).filter(
    ([, v]) => (v as number) > 0,
  );
  if (expenseCatsTotal.length > 0) {
    drawSection(
      ctx,
      "Gastos operativos por categoría",
      "Incluye recurrencias proyectadas no emitidas",
    );
    const slices: DonutSlice[] = expenseCatsTotal.map(([cat, v]) => ({
      label: CAT_LABELS[cat as ExpenseCategory] ?? cat,
      value: v as number,
      color: CAT_COLORS[cat as ExpenseCategory] ?? COLORS.accent,
    }));
    drawDonut(ctx, slices, {
      centerLabel: "Total",
      centerValue: formatCurrency(expBreakdown.total, currency),
    });

    drawTable(
      ctx,
      ["Categoría", "Emitido", "Proyectado", "Total"],
      (Object.keys(expBreakdown.totalByCategory) as ExpenseCategory[])
        .filter(
          (c) =>
            (expBreakdown.emittedByCategory[c] ?? 0) +
              (expBreakdown.projectedByCategory[c] ?? 0) >
            0,
        )
        .map((c) => [
          CAT_LABELS[c],
          formatCurrency(expBreakdown.emittedByCategory[c] ?? 0, currency),
          formatCurrency(expBreakdown.projectedByCategory[c] ?? 0, currency),
          formatCurrency(expBreakdown.totalByCategory[c] ?? 0, currency),
        ]),
      {
        columnStyles: {
          1: { halign: "right", cellWidth: 36 },
          2: { halign: "right", cellWidth: 36 },
          3: { halign: "right", cellWidth: 36 },
        },
      },
    );
  }

  // Estructura completa de recurrencias en el período
  const recurrencesInRange = projectRecurrencesInRange(
    data.expenseRecurrences ?? [],
    range,
  ).filter((r) => r.expectedTotal > 0);
  if (recurrencesInRange.length > 0) {
    drawSection(
      ctx,
      "Estructura de gastos recurrentes",
      "Compromiso total del período por cada recurrencia activa",
    );
    const recurrenceRows = recurrencesInRange
      .sort((a, b) => b.expectedTotal - a.expectedTotal)
      .map((r) => [
        r.description,
        CAT_LABELS[r.category],
        r.frequencyLabel,
        String(r.occurrences),
        formatCurrency(r.amount, currency),
        formatCurrency(r.expectedTotal, currency),
      ]);
    drawTable(
      ctx,
      ["Recurrencia", "Categoría", "Frec.", "Cuotas", "Monto cuota", "Total período"],
      recurrenceRows,
      {
        columnStyles: {
          3: { halign: "right", cellWidth: 16 },
          4: { halign: "right", cellWidth: 28 },
          5: { halign: "right", cellWidth: 30 },
        },
      },
    );
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

  // Gastos detallados (emitidos)
  if (expenses.length > 0) {
    drawSection(ctx, "Gastos emitidos en el período");
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
  drawSection(ctx, "Síntesis");
  const cogsPct = (safeDiv(cogs, totalOutflow) * 100).toFixed(1);
  const expensePct = (safeDiv(expBreakdown.total, totalOutflow) * 100).toFixed(1);
  drawBullets(ctx, [
    `Total egresos cargados: ${formatCurrency(totalOutflow, currency)} (COGS ${cogsPct}%, gastos ${expensePct}%).`,
    expBreakdown.projectedTotal > 0
      ? `Pendiente de emisión por recurrencias: ${formatCurrency(expBreakdown.projectedTotal, currency)}.`
      : `Sin montos de recurrencia pendientes de emisión en el período.`,
    `Compras registradas: ${formatCurrency(purchaseSpend, currency)} (${purchases.length} órdenes).`,
    defectiveLoss > 0
      ? `Defectuosos: ${formatCurrency(defectiveLoss, currency)}.`
      : `Sin costo por defectuosos en el período.`,
  ]);

  finishAndSave(ctx, `reporte_costos_${timestampSuffix()}.pdf`);
}

/* -------------------------------------------------------------------------- */
/* Helper: proyección detallada de recurrencias en un rango                   */
/* -------------------------------------------------------------------------- */

const FREQ_LABEL: Record<ExpenseRecurrence["frequency"], string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  anual: "Anual",
};

function projectRecurrencesInRange(
  recurrences: ExpenseRecurrence[],
  range: DateRange,
): {
  id: string;
  description: string;
  category: ExpenseCategory;
  frequencyLabel: string;
  amount: number;
  occurrences: number;
  expectedTotal: number;
}[] {
  const start = range.start;
  const end = range.end;
  return recurrences.map((r) => {
    if (r.paused) {
      return {
        id: r.id,
        description: r.description || "(sin descripción)",
        category: r.category,
        frequencyLabel: FREQ_LABEL[r.frequency] + " (pausada)",
        amount: r.amount,
        occurrences: 0,
        expectedTotal: 0,
      };
    }
    const recStart = r.startDate
      ? new Date(`${r.startDate}T00:00:00`)
      : null;
    const recEnd = r.endDate ? new Date(`${r.endDate}T23:59:59`) : null;
    let count = 0;
    let cursor = new Date(`${r.nextRunAt}T12:00:00`);

    // back-track hasta antes del start del rango (frenando si cruzamos recStart)
    while (cursor >= start) {
      if (recStart && cursor < recStart) break;
      const prev = stepBack(cursor, r.frequency);
      if (prev < start) break;
      if (recStart && prev < recStart) break;
      cursor = prev;
    }
    // contar ocurrencias en el rango
    while (cursor <= end) {
      const validStart = !recStart || cursor >= recStart;
      const validEnd = !recEnd || cursor <= recEnd;
      if (cursor >= start && validStart && validEnd) {
        count++;
      }
      cursor = stepForward(cursor, r.frequency);
    }
    return {
      id: r.id,
      description: r.description || "(sin descripción)",
      category: r.category,
      frequencyLabel: FREQ_LABEL[r.frequency],
      amount: r.amount,
      occurrences: count,
      expectedTotal: count * r.amount,
    };
  });
}

function stepForward(d: Date, freq: ExpenseRecurrence["frequency"]): Date {
  const x = new Date(d);
  switch (freq) {
    case "semanal":
      x.setDate(x.getDate() + 7);
      break;
    case "quincenal":
      x.setDate(x.getDate() + 14);
      break;
    case "mensual":
      x.setMonth(x.getMonth() + 1);
      break;
    case "trimestral":
      x.setMonth(x.getMonth() + 3);
      break;
    case "anual":
      x.setFullYear(x.getFullYear() + 1);
      break;
  }
  return x;
}

function stepBack(d: Date, freq: ExpenseRecurrence["frequency"]): Date {
  const x = new Date(d);
  switch (freq) {
    case "semanal":
      x.setDate(x.getDate() - 7);
      break;
    case "quincenal":
      x.setDate(x.getDate() - 14);
      break;
    case "mensual":
      x.setMonth(x.getMonth() - 1);
      break;
    case "trimestral":
      x.setMonth(x.getMonth() - 3);
      break;
    case "anual":
      x.setFullYear(x.getFullYear() - 1);
      break;
  }
  return x;
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
    "Resultado y rentabilidad por producto",
  );
  const currency = data.settings.currency || "ARS";
  const m = periodMetricsWithProjections(data, range);
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
      value: formatCurrency(m.netProfitProjected, currency),
      hint: `Margen ${m.marginPctProjected.toFixed(1)}% · incluye recurrencias`,
      tone: m.netProfitProjected >= 0 ? "positive" : "negative",
    },
    {
      label: "Egresos totales",
      value: formatCurrency(
        m.cogsSales + m.expensesProjected + m.defectiveLoss,
        currency,
      ),
      hint:
        m.expensesProjectedExtra > 0
          ? `Incluye ${formatCurrency(m.expensesProjectedExtra, currency)} proyectados`
          : "COGS + gastos + pérdidas",
    },
  ]);

  drawParagraph(
    ctx,
    `Neto = ingresos − COGS − gastos operativos (incluye recurrencias proyectadas) − defectuosos. Las compras no impactan este resultado.`,
    { size: 8.5 },
  );

  // Comparativa Bruta vs Neta
  drawSection(
    ctx,
    "Composición del resultado",
    "Desglose de cómo se forma la ganancia neta del período",
  );
  drawTable(
    ctx,
    ["Concepto", "Importe", "% sobre ingresos"],
    [
      [
        "Ingresos",
        formatCurrency(m.revenue, currency),
        `${(safeDiv(m.revenue, m.revenue) * 100).toFixed(1)}%`,
      ],
      [
        "(−) COGS",
        formatCurrency(m.cogsSales, currency),
        `${(safeDiv(m.cogsSales, m.revenue) * 100).toFixed(1)}%`,
      ],
      [
        "Ganancia bruta",
        formatCurrency(m.grossProfit, currency),
        `${m.grossMarginPct.toFixed(1)}%`,
      ],
      [
        "(−) Gastos operativos emitidos",
        formatCurrency(m.expensesEmitted, currency),
        `${(safeDiv(m.expensesEmitted, m.revenue) * 100).toFixed(1)}%`,
      ],
      [
        "(−) Recurrencias proyectadas",
        formatCurrency(m.expensesProjectedExtra, currency),
        `${(safeDiv(m.expensesProjectedExtra, m.revenue) * 100).toFixed(1)}%`,
      ],
      [
        "(−) Pérdida por defectuosos",
        formatCurrency(m.defectiveLoss, currency),
        `${(safeDiv(m.defectiveLoss, m.revenue) * 100).toFixed(1)}%`,
      ],
      [
        "Ganancia neta",
        formatCurrency(m.netProfitProjected, currency),
        `${m.marginPctProjected.toFixed(1)}%`,
      ],
    ],
    {
      columnStyles: {
        1: { halign: "right", cellWidth: 42 },
        2: { halign: "right", cellWidth: 36 },
      },
    },
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

  drawSection(ctx, "Síntesis");
  const topProfit = profitability[0];
  const conclusions: string[] = [
    `Resultado neto ${formatCurrency(m.netProfitProjected, currency)} · margen neto ${m.marginPctProjected.toFixed(1)}%.`,
  ];
  if (m.expensesProjectedExtra > 0) {
    conclusions.push(
      `Recurrencias no emitidas en el período: ${formatCurrency(m.expensesProjectedExtra, currency)} (imputadas al neto proyectado).`,
    );
  }
  if (topProfit) {
    conclusions.push(
      `Mayor contribución bruta: ${topProfit.name} (${formatCurrency(topProfit.profit, currency)}, margen ${topProfit.margin.toFixed(1)}%).`,
    );
  }
  if (m.defectiveLoss > 0) {
    conclusions.push(
      `Defectuosos: ${formatCurrency(m.defectiveLoss, currency)} (${(safeDiv(m.defectiveLoss, m.revenue) * 100).toFixed(1)}% de ingresos).`,
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
    "Reporte de inventario",
    `Corte ${formatDate(new Date().toISOString())}`,
    "Existencias y reposición",
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
  drawSection(ctx, "Referencias críticas");
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
    drawSection(ctx, "SKU sin stock");
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

  drawSection(ctx, "Detalle por familia y modelo");
  const sortedStock = sortProductsForStockPdf(products, data.productFamilies);
  const allRows = sortedStock.map((p) => [
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

  drawSection(ctx, "Síntesis");
  const conclusions: string[] = [
    `${formatCurrency(valuation, currency)} al costo · ${totalUnits} unidades · ${products.length} variantes.`,
  ];
  if (out.length > 0) {
    conclusions.push(`${out.length} SKU sin stock.`);
  }
  if (low.length > 0) {
    const totalGap = low.reduce(
      (a, p) => a + Math.max(0, p.minStock - p.stock) * p.purchaseCost,
      0,
    );
    conclusions.push(
      `${low.length} SKU bajo mínimo · reposición estimada ${formatCurrency(totalGap, currency)}.`,
    );
  }
  if (out.length === 0 && low.length === 0) {
    conclusions.push("Sin alertas de reposición según mínimos configurados.");
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
    "Informe mensual",
    monthLabel(month, year),
    `Comparativo con ${monthLabel(month, year - 1)}`,
  );
  const currency = data.settings.currency || "ARS";

  const m = periodMetricsWithProjections(data, range);
  const mPrev = periodMetricsWithProjections(data, prevRange);
  const expBreakdown = expensesForReportingPeriod(data, range);
  const sales = filterSalesInRange(data.sales, range);
  const top = topProductsByRevenue(sales, data.products, 6);
  const low = data.products.filter((p) => stockStatus(p) === "bajo");

  // Conclusiones
  const revenueChange = changePct(m.revenue, mPrev.revenue);
  const profitChange = changePct(m.netProfitProjected, mPrev.netProfitProjected);

  drawKpiGrid(ctx, [
    {
      label: "Ventas (ingresos)",
      value: formatCurrency(m.revenue, currency),
      hint: `vs ${monthLabel(month, year - 1)} ${fmtPct(revenueChange)}`,
      tone: revenueChange >= 0 ? "positive" : "negative",
    },
    {
      label: "Ganancia neta",
      value: formatCurrency(m.netProfitProjected, currency),
      hint: `Margen ${m.marginPctProjected.toFixed(1)}% · incluye recurrencias`,
      tone: m.netProfitProjected >= 0 ? "positive" : "negative",
    },
    {
      label: "Gastos del mes",
      value: formatCurrency(m.expensesProjected, currency),
      hint:
        m.expensesProjectedExtra > 0
          ? `Emitido ${formatCurrency(m.expensesEmitted, currency)} + ${formatCurrency(m.expensesProjectedExtra, currency)} pendientes`
          : `${m.expensesEmitted > 0 ? "Solo gastos emitidos" : "Sin gastos cargados"}`,
      tone: "negative",
    },
    {
      label: "Stock bajo",
      value: String(low.length),
      hint:
        low.length > 0
          ? "Reposición sugerida"
          : "Niveles saludables",
      tone: low.length > 0 ? "warn" : "neutral",
    },
  ]);

  drawParagraph(
    ctx,
    `Consolidado de ${monthLabel(month, year)}. Los gastos incluyen recurrencias proyectadas no emitidas donde corresponda.`,
    { size: 8.5 },
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
        "Gastos operativos (con recurrencias)",
        formatCurrency(m.expensesProjected, currency),
        formatCurrency(mPrev.expensesProjected, currency),
        fmtPct(changePct(m.expensesProjected, mPrev.expensesProjected)),
      ],
      [
        "    └ emitidos",
        formatCurrency(m.expensesEmitted, currency),
        formatCurrency(mPrev.expensesEmitted, currency),
        fmtPct(changePct(m.expensesEmitted, mPrev.expensesEmitted)),
      ],
      [
        "    └ recurrencias proyectadas",
        formatCurrency(m.expensesProjectedExtra, currency),
        formatCurrency(mPrev.expensesProjectedExtra, currency),
        fmtPct(
          changePct(m.expensesProjectedExtra, mPrev.expensesProjectedExtra),
        ),
      ],
      [
        "Ganancia bruta",
        formatCurrency(m.grossProfit, currency),
        formatCurrency(mPrev.grossProfit, currency),
        fmtPct(changePct(m.grossProfit, mPrev.grossProfit)),
      ],
      [
        "Ganancia neta",
        formatCurrency(m.netProfitProjected, currency),
        formatCurrency(mPrev.netProfitProjected, currency),
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
        1: { halign: "right", cellWidth: 38 },
        2: { halign: "right", cellWidth: 42 },
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

  // Gastos por categoría (totales: emitidos + recurrencias proyectadas)
  const expenseCats = (
    Object.keys(expBreakdown.totalByCategory) as ExpenseCategory[]
  ).filter((c) => (expBreakdown.totalByCategory[c] ?? 0) > 0);
  if (expenseCats.length > 0) {
    drawSection(
      ctx,
      "Gastos del mes por categoría",
      "Suma de gastos emitidos y recurrencias proyectadas no emitidas",
    );
    const slices: DonutSlice[] = expenseCats.map((c) => ({
      label: CAT_LABELS[c],
      value: expBreakdown.totalByCategory[c]!,
      color: CAT_COLORS[c] ?? COLORS.accent,
    }));
    drawDonut(ctx, slices, {
      centerLabel: "Total",
      centerValue: formatCurrency(m.expensesProjected, currency),
    });

    drawTable(
      ctx,
      ["Categoría", "Emitido", "Proyectado", "Total"],
      expenseCats.map((c) => [
        CAT_LABELS[c],
        formatCurrency(expBreakdown.emittedByCategory[c] ?? 0, currency),
        formatCurrency(expBreakdown.projectedByCategory[c] ?? 0, currency),
        formatCurrency(expBreakdown.totalByCategory[c] ?? 0, currency),
      ]),
      {
        columnStyles: {
          1: { halign: "right", cellWidth: 36 },
          2: { halign: "right", cellWidth: 36 },
          3: { halign: "right", cellWidth: 36 },
        },
      },
    );
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
  drawSection(ctx, "Síntesis");
  const conclusions: string[] = [
    `Ingresos ${formatCurrency(m.revenue, currency)} (${fmtPct(revenueChange)} vs ${monthLabel(month, year - 1)}).`,
    `Neto ${formatCurrency(m.netProfitProjected, currency)} · margen ${m.marginPctProjected.toFixed(1)}%.`,
  ];
  if (m.expensesProjectedExtra > 0) {
    conclusions.push(
      `Recurrencias pendientes de emisión: ${formatCurrency(m.expensesProjectedExtra, currency)}.`,
    );
  }
  if (top[0]) {
    conclusions.push(
      `Principal SKU por facturación: ${top[0].name} (${formatCurrency(top[0].revenue, currency)}).`,
    );
  }
  if (low.length > 0) {
    conclusions.push(`${low.length} SKU bajo mínimo de stock.`);
  }
  drawBullets(ctx, conclusions);

  finishAndSave(
    ctx,
    `reporte_mensual_${year}-${String(month).padStart(2, "0")}.pdf`,
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Reporte anual (formato ejecutivo)                                       */
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
    "Informe anual",
    `Ejercicio ${year}`,
    `Comparativo con ${year - 1}`,
  );
  const currency = data.settings.currency || "ARS";

  const m = periodMetricsWithProjections(data, range);
  const mPrev = periodMetricsWithProjections(data, prevRange);
  const expBreakdown = expensesForReportingPeriod(data, range);
  const sales = filterSalesInRange(data.sales, range);
  const top = topProductsByRevenue(sales, data.products, 8);
  const monthlyMetrics = periodMetricsByMonth(data, year);
  const monthlySales = salesAggregatedByMonth(data.sales, year);
  const prevMonthlySales = salesAggregatedByMonth(data.sales, year - 1);

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

  // -------------------------------------------------------------------------
  // PORTADA — Hero + KPIs
  // -------------------------------------------------------------------------
  drawHeroKpi(ctx, {
    label: `Resultado neto ${year}`,
    value: formatCurrency(m.netProfitProjected, currency),
    deltaLabel: `${fmtPct(changePct(m.netProfitProjected, mPrev.netProfitProjected))} vs ${year - 1}`,
    deltaTone:
      m.netProfitProjected >= mPrev.netProfitProjected ? "positive" : "negative",
    description: `Margen neto ${m.marginPctProjected.toFixed(1)}% · ingresos ${formatCurrency(m.revenue, currency)} (incluye gastos recurrentes proyectados).`,
  });

  drawKpiGrid(ctx, [
    {
      label: "Ingresos anuales",
      value: formatCurrency(m.revenue, currency),
      hint: `vs ${year - 1} ${fmtPct(changePct(m.revenue, mPrev.revenue))}`,
      tone: m.revenue >= mPrev.revenue ? "positive" : "negative",
    },
    {
      label: "COGS (costo ventas)",
      value: formatCurrency(m.cogsSales, currency),
      hint: `Margen bruto ${m.grossMarginPct.toFixed(1)}%`,
    },
    {
      label: "Gastos operativos",
      value: formatCurrency(m.expensesProjected, currency),
      hint:
        m.expensesProjectedExtra > 0
          ? `${formatCurrency(m.expensesEmitted, currency)} emitidos + ${formatCurrency(m.expensesProjectedExtra, currency)} proyectados`
          : "Sólo gastos emitidos",
      tone: "negative",
    },
    {
      label: "Ventas",
      value: String(m.saleCount),
      hint: `${m.unitsSold} unidades · ticket prom. ${formatCurrency(safeDiv(m.revenue, m.saleCount || 1), currency)}`,
    },
    {
      label: "Ganancia bruta",
      value: formatCurrency(m.grossProfit, currency),
      hint: `${m.grossMarginPct.toFixed(1)}% de margen`,
      tone: m.grossProfit >= 0 ? "positive" : "negative",
    },
    {
      label: "Pérdida defectuosos",
      value: formatCurrency(m.defectiveLoss, currency),
      hint: m.defectiveLoss > 0 ? "Impacto sobre el neto" : "Sin pérdidas registradas",
      tone: m.defectiveLoss > 0 ? "warn" : "neutral",
    },
    {
      label: "Producto líder",
      value: top[0]?.name ?? "—",
      hint: top[0]
        ? `${top[0].quantity} uds · ${formatCurrency(top[0].revenue, currency)}`
        : "Sin datos",
    },
    {
      label: "Margen neto",
      value: `${m.marginPctProjected.toFixed(1)}%`,
      hint: `Año anterior: ${mPrev.marginPctProjected.toFixed(1)}%`,
      tone: m.marginPctProjected >= mPrev.marginPctProjected ? "positive" : "negative",
    },
  ]);

  // Highlights ejecutivos rápidos
  drawSection(ctx, "Síntesis del ejercicio");
  const bestMonth = monthlyMetrics
    .map((row, i) => ({ ...row, idx: i }))
    .sort((a, b) => b.revenue - a.revenue)[0];
  const worstMonth = monthlyMetrics
    .map((row, i) => ({ ...row, idx: i }))
    .sort((a, b) => a.revenue - b.revenue)[0];
  const summary: string[] = [];
  summary.push(
    `Ingresos ${formatCurrency(m.revenue, currency)} (${fmtPct(changePct(m.revenue, mPrev.revenue))} vs ${year - 1}).`,
  );
  if (bestMonth && bestMonth.revenue > 0) {
    summary.push(
      `Mayor facturación mensual: ${monthsLabels[bestMonth.idx]} (${formatCurrency(bestMonth.revenue, currency)}); menor: ${monthsLabels[worstMonth.idx]} (${formatCurrency(worstMonth.revenue, currency)}).`,
    );
  }
  summary.push(
    `COGS ${formatCurrency(m.cogsSales, currency)} (${(safeDiv(m.cogsSales, m.revenue) * 100).toFixed(1)}% ing.) · Gastos ${formatCurrency(m.expensesProjected, currency)} (${(safeDiv(m.expensesProjected, m.revenue) * 100).toFixed(1)}% ing.)${m.defectiveLoss > 0 ? ` · Defectuosos ${formatCurrency(m.defectiveLoss, currency)}` : ""}.`,
  );
  if (m.expensesProjectedExtra > 0) {
    summary.push(
      `Recurrencias proyectadas no emitidas al cierre: ${formatCurrency(m.expensesProjectedExtra, currency)}.`,
    );
  }
  drawBullets(ctx, summary);

  // -------------------------------------------------------------------------
  // PÁGINA 2 — Evolución de ingresos / ganancia
  // -------------------------------------------------------------------------
  forcePageBreak(ctx);
  drawSection(
    ctx,
    "Evolución de ingresos por mes",
    `${year} contra ${year - 1}`,
  );
  drawLineChart(
    ctx,
    monthlySales.map((mm, i) => ({ label: monthsLabels[i], value: mm.revenue })),
    {
      currency,
      secondary: prevMonthlySales.map((mm, i) => ({
        label: monthsLabels[i],
        value: mm.revenue,
      })),
      primaryLabel: String(year),
      secondaryLabel: String(year - 1),
      height: 70,
    },
  );

  drawSection(
    ctx,
    "Ganancia neta mensual",
    "Ingresos − COGS − Gastos del mes (incluye recurrencias proyectadas) − Defectuosos",
  );
  drawVerticalBars(
    ctx,
    monthlyMetrics.map((mm, i) => ({
      label: monthsLabels[i],
      value: mm.netProfit,
      color: mm.netProfit < 0 ? COLORS.negative : COLORS.accent,
    })),
    { currency, height: 60 },
  );

  drawSection(
    ctx,
    "Ganancia bruta y gastos mensuales",
    "Barras: ganancia bruta vs. gastos operativos más defectuosos",
  );
  drawVerticalBars(
    ctx,
    monthlyMetrics.map((mm, i) => ({
      label: monthsLabels[i],
      value: mm.gross,
    })),
    {
      currency,
      height: 60,
      secondary: monthlyMetrics.map((mm) => mm.expensesTotal + mm.defectiveLoss),
      secondaryColor: COLORS.negative,
      primaryLabel: "Ganancia bruta",
      secondaryLabel: "Gastos + defectuosos",
    },
  );

  // -------------------------------------------------------------------------
  // PÁGINA 3 — Estructura de costos
  // -------------------------------------------------------------------------
  forcePageBreak(ctx);
  drawSection(
    ctx,
    "Estructura de gastos por categoría",
    "Incluye gastos emitidos y recurrencias proyectadas no emitidas",
  );
  const expenseCatsAnnual = (
    Object.keys(expBreakdown.totalByCategory) as ExpenseCategory[]
  ).filter((c) => (expBreakdown.totalByCategory[c] ?? 0) > 0);
  if (expenseCatsAnnual.length > 0) {
    const slices: DonutSlice[] = expenseCatsAnnual.map((c) => ({
      label: CAT_LABELS[c],
      value: expBreakdown.totalByCategory[c]!,
      color: CAT_COLORS[c] ?? COLORS.accent,
    }));
    drawDonut(ctx, slices, {
      centerLabel: "Gastos año",
      centerValue: formatCurrency(m.expensesProjected, currency),
    });
    drawTable(
      ctx,
      ["Categoría", "Emitido", "Proyectado", "Total"],
      expenseCatsAnnual.map((c) => [
        CAT_LABELS[c],
        formatCurrency(expBreakdown.emittedByCategory[c] ?? 0, currency),
        formatCurrency(expBreakdown.projectedByCategory[c] ?? 0, currency),
        formatCurrency(expBreakdown.totalByCategory[c] ?? 0, currency),
      ]),
      {
        columnStyles: {
          1: { halign: "right", cellWidth: 36 },
          2: { halign: "right", cellWidth: 36 },
          3: { halign: "right", cellWidth: 36 },
        },
      },
    );
  } else {
    drawParagraph(
      ctx,
      "El ejercicio no registra gastos operativos ni recurrencias activas con impacto en el año.",
    );
  }

  // Composición mensual: COGS + Gastos + Defectuosos (barras apiladas)
  drawSection(
    ctx,
    "Composición de costos mes a mes",
    "COGS, gastos operativos (con recurrencias) y pérdida por defectuosos",
  );
  const stack: StackPoint[] = monthlyMetrics.map((mm, i) => ({
    label: monthsLabels[i],
    segments: [
      { value: mm.cogs, color: COLORS.accent },
      { value: mm.expensesTotal, color: COLORS.blue },
      { value: mm.defectiveLoss, color: COLORS.warn },
    ],
  }));
  drawStackedBars(ctx, stack, {
    currency,
    height: 64,
    legend: [
      { label: "COGS", color: COLORS.accent },
      { label: "Gastos operativos", color: COLORS.blue },
      { label: "Defectuosos", color: COLORS.warn },
    ],
  });

  // -------------------------------------------------------------------------
  // PÁGINA 4 — Tabla mensual + recurrencias estructurales + cierre
  // -------------------------------------------------------------------------
  forcePageBreak(ctx);
  drawSection(
    ctx,
    "Detalle mensual completo",
    "Incluye COGS, gastos del mes (emitidos + recurrencias proyectadas) y resultado neto",
  );
  drawTable(
    ctx,
    [
      "Mes",
      "Ingresos",
      "COGS",
      "Gastos",
      "Defect.",
      "Neto",
      "Margen",
    ],
    monthlyMetrics.map((row, i) => [
      monthsLabels[i],
      formatCurrency(row.revenue, currency),
      formatCurrency(row.cogs, currency),
      formatCurrency(row.expensesTotal, currency),
      formatCurrency(row.defectiveLoss, currency),
      formatCurrency(row.netProfit, currency),
      row.revenue > 0
        ? `${((row.netProfit / row.revenue) * 100).toFixed(1)}%`
        : "—",
    ]),
    {
      columnStyles: {
        1: { halign: "right", cellWidth: 26 },
        2: { halign: "right", cellWidth: 24 },
        3: { halign: "right", cellWidth: 24 },
        4: { halign: "right", cellWidth: 20 },
        5: { halign: "right", cellWidth: 26 },
        6: { halign: "right", cellWidth: 18 },
      },
    },
  );

  // Recurrencias estructurales
  const annualRecurrences = projectRecurrencesInRange(
    data.expenseRecurrences ?? [],
    range,
  ).filter((r) => r.expectedTotal > 0);
  if (annualRecurrences.length > 0) {
    drawSection(
      ctx,
      "Compromisos recurrentes del año",
      "Costo total anualizado de cada recurrencia activa (frecuencia × monto)",
    );
    drawTable(
      ctx,
      ["Recurrencia", "Categoría", "Frec.", "Cuotas año", "Monto cuota", "Total año"],
      annualRecurrences
        .sort((a, b) => b.expectedTotal - a.expectedTotal)
        .map((r) => [
          r.description,
          CAT_LABELS[r.category],
          r.frequencyLabel,
          String(r.occurrences),
          formatCurrency(r.amount, currency),
          formatCurrency(r.expectedTotal, currency),
        ]),
      {
        columnStyles: {
          3: { halign: "right", cellWidth: 22 },
          4: { halign: "right", cellWidth: 30 },
          5: { halign: "right", cellWidth: 32 },
        },
      },
    );
  }

  // Top productos
  if (top.length > 0) {
    drawSection(ctx, "Productos más vendidos del año");
    drawHorizontalBars(
      ctx,
      top.map((t) => ({ label: t.name, value: t.revenue })),
      { currency },
    );
  }

  // Conclusiones ejecutivas
  drawSection(ctx, "Cierre");
  const conclusions: string[] = [
    `Ingresos ${formatCurrency(m.revenue, currency)} (${fmtPct(changePct(m.revenue, mPrev.revenue))} vs ${year - 1}).`,
    `Neto ${formatCurrency(m.netProfitProjected, currency)} · margen ${m.marginPctProjected.toFixed(1)}%.`,
    `COGS ${(safeDiv(m.cogsSales, m.revenue) * 100).toFixed(1)}% ing. · Gastos ${(safeDiv(m.expensesProjected, m.revenue) * 100).toFixed(1)}% ing.`,
  ];
  if (top[0]) {
    conclusions.push(
      `SKU líder: ${top[0].name} (${formatCurrency(top[0].revenue, currency)} · ${top[0].quantity} uds).`,
    );
  }
  if (m.defectiveLoss > 0) {
    conclusions.push(`Defectuosos: ${formatCurrency(m.defectiveLoss, currency)}.`);
  }
  drawBullets(ctx, conclusions);

  finishAndSave(ctx, `reporte_anual_${year}.pdf`);
}
