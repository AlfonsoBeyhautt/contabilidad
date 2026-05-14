import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  isBefore,
  isSameDay,
  min as minDate,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import type {
  AppData,
  Customer,
  DefectiveEntry,
  Expense,
  ExpenseCategory,
  ExpenseRecurrence,
  PaymentMethod,
  Product,
  ProductCategory,
  Sale,
} from "./types";

export interface DateRange {
  start: Date;
  end: Date;
}

export function parseISODate(s: string): Date {
  return new Date(s);
}

export function inRange(d: Date, r: DateRange): boolean {
  return !isBefore(d, r.start) && !isAfter(d, r.end);
}

export function saleLineRevenue(line: {
  quantity: number;
  unitPrice: number;
  discount: number;
}): number {
  return Math.max(0, line.quantity * line.unitPrice - line.discount);
}

export function saleTotal(sale: Sale): number {
  return sale.lines.reduce((acc, l) => acc + saleLineRevenue(l), 0);
}

export function saleCogs(sale: Sale): number {
  let cogs = 0;
  for (const line of sale.lines) {
    const unit = sale.costSnapshot[line.productId] ?? 0;
    cogs += unit * line.quantity;
  }
  return cogs;
}

export function saleGrossProfit(sale: Sale): number {
  return saleTotal(sale) - saleCogs(sale);
}

export function filterSalesInRange(sales: Sale[], range: DateRange): Sale[] {
  return sales.filter((s) => {
    const d = parseISODate(s.date);
    return inRange(d, range);
  });
}

export function filterExpensesInRange(
  expenses: Expense[],
  range: DateRange,
): Expense[] {
  return expenses.filter((e) => inRange(parseISODate(e.date), range));
}

export function filterPurchasesInRange(
  purchases: import("./types").InventoryPurchase[],
  range: DateRange,
) {
  return purchases.filter((p) => inRange(parseISODate(p.date), range));
}

export function filterDefectivesInRange(
  entries: DefectiveEntry[],
  range: DateRange,
): DefectiveEntry[] {
  return entries.filter((x) => inRange(parseISODate(x.recordedAt), range));
}

export function periodMetrics(data: AppData, range: DateRange) {
  const sales = filterSalesInRange(data.sales, range);
  const expenses = filterExpensesInRange(data.expenses, range);
  const purchases = filterPurchasesInRange(data.purchases, range);
  const defectives = filterDefectivesInRange(data.defectives ?? [], range);

  const revenue = sales.reduce((a, s) => a + saleTotal(s), 0);
  const cogsFromSales = sales.reduce((a, s) => a + saleCogs(s), 0);
  const cogsFromPurchases = purchases.reduce(
    (a, p) => a + p.quantity * p.unitCost,
    0,
  );
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const defectiveLoss = defectives.reduce(
    (a, d) => a + d.quantity * d.unitCost,
    0,
  );
  const grossProfit = revenue - cogsFromSales;
  /** Resultado operativo (antes de defectuosos): ingresos − COGS − gastos operativos. */
  const operatingProfit = grossProfit - expenseTotal;
  const netProfit = operatingProfit - defectiveLoss;
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const operatingMarginPct =
    revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

  return {
    revenue,
    /** Costo directo reconocido por ventas en el período */
    cogsSales: cogsFromSales,
    /** Compras de mercadería registradas en el período (distinto de COGS) */
    inventoryPurchasesValue: cogsFromPurchases,
    expenses: expenseTotal,
    /** Costo de unidades defectuosas en el período (no vendibles). */
    defectiveLoss,
    grossProfit,
    operatingProfit,
    netProfit,
    marginPct,
    grossMarginPct,
    operatingMarginPct,
    saleCount: sales.length,
    unitsSold: sales.reduce(
      (a, s) => a + s.lines.reduce((b, l) => b + l.quantity, 0),
      0,
    ),
  };
}

export function previousPeriodRange(range: DateRange): DateRange {
  const len =
    differenceInCalendarDays(endOfDay(range.end), startOfDay(range.start)) + 1;
  const end = minDate([endOfDay(subYears(range.end, 1)), range.end]);
  const start = startOfDay(new Date(end.getTime() - (len - 1) * 86400000));
  return { start, end };
}

export function monthPreviousRange(range: DateRange): DateRange {
  const ref = range.start;
  const prev = subMonths(ref, 1);
  return {
    start: startOfMonth(prev),
    end: endOfMonth(prev),
  };
}

export function compareToPreviousYear(range: DateRange): DateRange {
  return {
    start: subYears(range.start, 1),
    end: subYears(range.end, 1),
  };
}

export type PeriodPreset =
  | "desde_operacion"
  | "hoy"
  | "esta_semana"
  | "este_mes"
  | "este_año"
  | "año_anterior"
  | "personalizado";

/**
 * Rango desde la fecha operativa más antigua detectada (productos, ventas,
 * compras, gastos, clientes, defectuosos) hasta hoy. Si no hay datos, cae al
 * mes calendario actual.
 */
export function operationalBaselineRange(
  data: AppData,
  now = new Date(),
): DateRange {
  const end = endOfDay(now);
  const candidates: Date[] = [];

  for (const s of data.sales ?? []) {
    candidates.push(parseISODate(s.date));
  }
  for (const e of data.expenses ?? []) {
    candidates.push(parseISODate(e.date));
  }
  for (const p of data.purchases ?? []) {
    candidates.push(parseISODate(p.date));
  }
  for (const d of data.defectives ?? []) {
    candidates.push(parseISODate(d.recordedAt));
  }
  for (const pr of data.products ?? []) {
    candidates.push(parseISODate(pr.entryDate));
  }
  for (const f of data.productFamilies ?? []) {
    candidates.push(parseISODate(f.entryDate));
  }
  for (const c of data.customers ?? []) {
    candidates.push(parseISODate(c.registeredAt));
  }

  const valid = candidates.filter((d) => !Number.isNaN(d.getTime()));
  if (valid.length === 0) {
    return { start: startOfMonth(now), end };
  }
  const minTs = Math.min(...valid.map((d) => d.getTime()));
  let start = startOfDay(new Date(minTs));
  if (start.getTime() > end.getTime()) {
    start = startOfMonth(now);
  }
  return { start, end };
}

export function rangeFromPreset(
  preset: PeriodPreset,
  custom?: { start: Date; end: Date },
  now = new Date(),
): DateRange {
  switch (preset) {
    case "desde_operacion":
      /** Sin `AppData` aquí: fallback conservador; el layout real usa `operationalBaselineRange`. */
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "hoy":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "esta_semana":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfDay(now),
      };
    case "este_mes":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "este_año":
      return { start: startOfYear(now), end: endOfDay(now) };
    case "año_anterior": {
      const y = subYears(now, 1);
      return { start: startOfYear(y), end: endOfYear(y) };
    }
    case "personalizado":
      if (!custom) {
        return { start: startOfMonth(now), end: endOfDay(now) };
      }
      return {
        start: startOfDay(custom.start),
        end: endOfDay(custom.end),
      };
    default:
      return { start: startOfMonth(now), end: endOfDay(now) };
  }
}

export function productByIdMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((p) => [p.id, p]));
}

export function topProductsByRevenue(
  sales: Sale[],
  products: Product[],
  limit = 8,
) {
  const pmap = productByIdMap(products);
  const rev = new Map<string, number>();
  const qty = new Map<string, number>();
  for (const s of sales) {
    for (const l of s.lines) {
      const r = saleLineRevenue(l);
      rev.set(l.productId, (rev.get(l.productId) ?? 0) + r);
      qty.set(l.productId, (qty.get(l.productId) ?? 0) + l.quantity);
    }
  }
  return [...rev.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, revenue]) => ({
      productId,
      name: pmap.get(productId)?.name ?? productId,
      category: pmap.get(productId)?.category ?? "Remeras",
      revenue,
      quantity: qty.get(productId) ?? 0,
    }));
}

export function stockStatus(p: Product): "disponible" | "bajo" | "agotado" {
  if (p.stock <= 0) return "agotado";
  if (p.stock <= p.minStock) return "bajo";
  return "disponible";
}

export function customerMetrics(
  customer: Customer,
  sales: Sale[],
  products: Product[],
  now = new Date(),
) {
  const custSales = sales.filter((s) => s.customerId === customer.id);
  const sorted = [...custSales].sort(
    (a, b) => parseISODate(a.date).getTime() - parseISODate(b.date).getTime(),
  );
  const totalSpent = custSales.reduce((a, s) => a + saleTotal(s), 0);
  const purchaseCount = custSales.length;
  const lastPurchase =
    sorted.length > 0 ? sorted[sorted.length - 1].date : undefined;
  const daysSinceLast =
    lastPurchase != null
      ? differenceInCalendarDays(now, parseISODate(lastPurchase))
      : undefined;

  const pmap = productByIdMap(products);
  const productIds = new Set<string>();
  for (const s of custSales) {
    for (const l of s.lines) productIds.add(l.productId);
  }
  const productsBought = [...productIds].map((id) => pmap.get(id)?.name ?? id);

  let segment: "nuevo" | "frecuente" | "inactivo" | "normal" = "normal";
  if (purchaseCount === 0) segment = "nuevo";
  else if (daysSinceLast != null && daysSinceLast > 90) segment = "inactivo";
  else if (purchaseCount >= 3 || totalSpent > 150000) segment = "frecuente";
  else if (sorted.length === 1) {
    const first = parseISODate(sorted[0].date);
    if (differenceInCalendarDays(now, first) <= 30) segment = "nuevo";
  }

  return {
    totalSpent,
    purchaseCount,
    lastPurchase,
    productsBought,
    segment,
    daysSinceLast,
  };
}

export function expensesByCategory(expenses: Expense[]): Record<
  ExpenseCategory,
  number
> {
  const init = {} as Record<ExpenseCategory, number>;
  const cats: ExpenseCategory[] = [
    "producción",
    "marketing",
    "envíos",
    "otros",
  ];
  for (const c of cats) init[c] = 0;
  for (const e of expenses) {
    init[e.category] = (init[e.category] ?? 0) + e.amount;
  }
  return init;
}

function bumpRecurrenceSchedule(
  from: Date,
  freq: ExpenseRecurrence["frequency"],
): Date {
  switch (freq) {
    case "semanal":
      return addWeeks(from, 1);
    case "quincenal":
      return addDays(from, 14);
    case "mensual":
      return addMonths(from, 1);
    case "trimestral":
      return addMonths(from, 3);
    case "anual":
      return addYears(from, 1);
    default:
      return addMonths(from, 1);
  }
}

function unbumpRecurrenceSchedule(
  from: Date,
  freq: ExpenseRecurrence["frequency"],
): Date {
  switch (freq) {
    case "semanal":
      return subWeeks(from, 1);
    case "quincenal":
      return subDays(from, 14);
    case "mensual":
      return subMonths(from, 1);
    case "trimestral":
      return subMonths(from, 3);
    case "anual":
      return subYears(from, 1);
    default:
      return subMonths(from, 1);
  }
}

/**
 * Cuotas de recurrencias en el período que aún no tienen gasto emitido (mismo día +
 * `fromRecurrenceId`). Usa `nextRunAt` como ancla del calendario (alineado al tick).
 */
export function missingRecurrenceAccrualByCategory(
  data: AppData,
  range: DateRange,
): Record<ExpenseCategory, number> {
  const cats: ExpenseCategory[] = [
    "producción",
    "marketing",
    "envíos",
    "otros",
  ];
  const init = {} as Record<ExpenseCategory, number>;
  for (const c of cats) init[c] = 0;

  const expenses = data.expenses ?? [];
  const recurrences = data.expenseRecurrences ?? [];
  const rangeStart = startOfDay(range.start);
  const rangeEnd = endOfDay(range.end);

  for (const r of recurrences) {
    if (r.paused) continue;
    const recStart = r.startDate
      ? startOfDay(parseISO(`${r.startDate}T12:00:00`))
      : null;
    const recEnd = r.endDate
      ? endOfDay(parseISO(`${r.endDate}T12:00:00`))
      : null;

    const dayKeys = new Set<string>();
    let x = startOfDay(parseISO(`${r.nextRunAt}T12:00:00`));
    let guard = 0;
    // Hacia atrás desde nextRunAt, frenando si cruzamos recStart o el rango.
    while (guard < 240 && !isBefore(x, rangeStart)) {
      guard++;
      if (recStart && isBefore(x, recStart)) break;
      if (recEnd && isAfter(x, recEnd)) {
        x = unbumpRecurrenceSchedule(x, r.frequency);
        continue;
      }
      if (!isBefore(x, rangeStart) && !isAfter(x, rangeEnd)) {
        dayKeys.add(format(x, "yyyy-MM-dd"));
      }
      x = unbumpRecurrenceSchedule(x, r.frequency);
    }

    x = startOfDay(parseISO(`${r.nextRunAt}T12:00:00`));
    x = bumpRecurrenceSchedule(x, r.frequency);
    guard = 0;
    while (guard < 240 && !isAfter(x, rangeEnd)) {
      guard++;
      if (recEnd && isAfter(x, recEnd)) break;
      if (!isBefore(x, rangeStart) && !isAfter(x, rangeEnd)) {
        dayKeys.add(format(x, "yyyy-MM-dd"));
      }
      x = bumpRecurrenceSchedule(x, r.frequency);
    }

    for (const key of dayKeys) {
      const d = startOfDay(parseISO(`${key}T12:00:00`));
      if (recStart && isBefore(d, recStart)) continue;
      if (recEnd && isAfter(d, recEnd)) continue;
      const dup = expenses.some(
        (e) =>
          e.fromRecurrenceId === r.id && isSameDay(parseISO(e.date), d),
      );
      if (!dup) {
        init[r.category] = (init[r.category] ?? 0) + r.amount;
      }
    }
  }
  return init;
}

/**
 * Detalle de los gastos del período para reporting profesional:
 *
 *   • emittedByCategory     → suma de `expenses` ya cargados (manuales + autoemitidos)
 *   • projectedByCategory   → suma de cuotas de recurrencias que aún no se emitieron
 *   • totalByCategory       → emittedByCategory + projectedByCategory
 *   • emittedTotal          → suma de emittedByCategory
 *   • projectedTotal        → suma de projectedByCategory
 *   • total                 → emittedTotal + projectedTotal
 *
 * El "total" es la cifra correcta para usar en KPIs de gastos del período en
 * reportes que se descargan antes de fin de mes/año: refleja el costo real
 * esperado, no sólo lo ya emitido en el momento de la descarga.
 */
export function expensesForReportingPeriod(
  data: AppData,
  range: DateRange,
): {
  emittedByCategory: Record<ExpenseCategory, number>;
  projectedByCategory: Record<ExpenseCategory, number>;
  totalByCategory: Record<ExpenseCategory, number>;
  emittedTotal: number;
  projectedTotal: number;
  total: number;
} {
  const emittedByCategory = expensesByCategory(
    filterExpensesInRange(data.expenses ?? [], range),
  );
  const projectedByCategory = missingRecurrenceAccrualByCategory(data, range);
  const cats: ExpenseCategory[] = [
    "producción",
    "marketing",
    "envíos",
    "otros",
  ];
  const totalByCategory = {} as Record<ExpenseCategory, number>;
  for (const c of cats) {
    totalByCategory[c] =
      (emittedByCategory[c] ?? 0) + (projectedByCategory[c] ?? 0);
  }
  const emittedTotal = Object.values(emittedByCategory).reduce(
    (a, v) => a + (v as number),
    0,
  );
  const projectedTotal = Object.values(projectedByCategory).reduce(
    (a, v) => a + (v as number),
    0,
  );
  return {
    emittedByCategory,
    projectedByCategory,
    totalByCategory,
    emittedTotal,
    projectedTotal,
    total: emittedTotal + projectedTotal,
  };
}

/**
 * `periodMetrics` enriquecido con la proyección de recurrencias.
 * Útil para informes ejecutivos (mensual / anual / costos / ganancias).
 *
 * La diferencia clave con `periodMetrics`:
 *   - `expensesProjected` ≥ `expenses` (incluye recurrencias sin emitir)
 *   - `netProfitProjected` usa `expensesProjected`
 */
export function periodMetricsWithProjections(
  data: AppData,
  range: DateRange,
): ReturnType<typeof periodMetrics> & {
  expensesEmitted: number;
  expensesProjected: number;
  expensesProjectedExtra: number;
  operatingProfitProjected: number;
  operatingMarginPctProjected: number;
  netProfitProjected: number;
  marginPctProjected: number;
} {
  const base = periodMetrics(data, range);
  const breakdown = expensesForReportingPeriod(data, range);
  const expensesProjected = breakdown.total;
  const expensesProjectedExtra = breakdown.projectedTotal;
  const operatingProfitProjected = base.grossProfit - expensesProjected;
  const netProfitProjected =
    operatingProfitProjected - base.defectiveLoss;
  const marginPctProjected =
    base.revenue > 0 ? (netProfitProjected / base.revenue) * 100 : 0;
  const operatingMarginPctProjected =
    base.revenue > 0 ? (operatingProfitProjected / base.revenue) * 100 : 0;
  return {
    ...base,
    expensesEmitted: base.expenses,
    expensesProjected,
    expensesProjectedExtra,
    operatingProfitProjected,
    operatingMarginPctProjected,
    netProfitProjected,
    marginPctProjected,
  };
}

export function salesAggregatedByMonth(
  sales: Sale[],
  year: number,
): { month: number; revenue: number; cogs: number; gross: number }[] {
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: 0,
    cogs: 0,
    gross: 0,
  }));
  for (const s of sales) {
    const d = parseISODate(s.date);
    if (d.getFullYear() !== year) continue;
    const m = d.getMonth();
    const rev = saleTotal(s);
    const cg = saleCogs(s);
    buckets[m].revenue += rev;
    buckets[m].cogs += cg;
    buckets[m].gross += rev - cg;
  }
  return buckets;
}

/**
 * Agregado mensual completo con gastos proyectados (recurrencias incluidas),
 * defectuosos y ganancia neta. Útil para reporte anual / mensual.
 */
export function periodMetricsByMonth(
  data: AppData,
  year: number,
): {
  month: number;
  revenue: number;
  cogs: number;
  gross: number;
  expensesEmitted: number;
  expensesProjected: number;
  expensesTotal: number;
  defectiveLoss: number;
  netProfit: number;
}[] {
  const out: ReturnType<typeof periodMetricsByMonth> = [];
  for (let i = 0; i < 12; i++) {
    const monthStart = startOfMonth(new Date(year, i, 1));
    const monthEnd = endOfMonth(monthStart);
    const range: DateRange = {
      start: startOfDay(monthStart),
      end: endOfDay(monthEnd),
    };
    const m = periodMetricsWithProjections(data, range);
    out.push({
      month: i + 1,
      revenue: m.revenue,
      cogs: m.cogsSales,
      gross: m.grossProfit,
      expensesEmitted: m.expensesEmitted,
      expensesProjected: m.expensesProjectedExtra,
      expensesTotal: m.expensesProjected,
      defectiveLoss: m.defectiveLoss,
      netProfit: m.netProfitProjected,
    });
  }
  return out;
}

/** Fila mensual lista para Recharts (ingresos, egresos totales, neto y desglose). */
export type MonthlyChartRow = {
  name: string;
  month: number;
  Ingresos: number;
  Egresos: number;
  "Ganancia neta": number;
  COGS: number;
  Gastos: number;
  Defectuosos: number;
};

/**
 * Serie mensual para gráficos: en el año calendario actual solo hasta el mes en curso;
 * en años anteriores, los 12 meses completos.
 */
export function monthlyChartSeriesThroughCurrentMonth(
  data: AppData,
  year: number,
  now = new Date(),
): MonthlyChartRow[] {
  const raw = periodMetricsByMonth(data, year).map((row) => {
    const cogs = Math.round(row.cogs);
    const gastos = Math.round(row.expensesTotal);
    const def = Math.round(row.defectiveLoss);
    const egresos = cogs + gastos + def;
    return {
      name: String(row.month).padStart(2, "0"),
      month: row.month,
      Ingresos: Math.round(row.revenue),
      Egresos: egresos,
      "Ganancia neta": Math.round(row.netProfit),
      COGS: cogs,
      Gastos: gastos,
      Defectuosos: def,
    };
  });
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  if (year > cy) return [];
  if (year < cy) return raw;
  return raw.filter((r) => r.month <= cm);
}

export function filterSales(
  sales: Sale[],
  opts: {
    range?: DateRange;
    productId?: string;
    category?: ProductCategory;
    payment?: PaymentMethod;
    customerId?: string;
  },
  products: Product[],
): Sale[] {
  let out = sales;
  const pmap = productByIdMap(products);
  if (opts.range) {
    out = filterSalesInRange(out, opts.range);
  }
  if (opts.productId) {
    out = out.filter((s) => s.lines.some((l) => l.productId === opts.productId));
  }
  if (opts.category) {
    out = out.filter((s) =>
      s.lines.some((l) => pmap.get(l.productId)?.category === opts.category),
    );
  }
  if (opts.payment) {
    out = out.filter((s) => s.paymentMethod === opts.payment);
  }
  if (opts.customerId) {
    out = out.filter((s) => s.customerId === opts.customerId);
  }
  return out;
}
