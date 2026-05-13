/**
 * Métricas analíticas avanzadas usadas por los detectores del motor de
 * inteligencia. No reemplaza `finance-calcs`: se apoya en él. Centraliza
 * cálculos de:
 *
 *   • tendencias (slope sobre N meses)
 *   • concentración (top-N, Herfindahl–Hirschman normalizado)
 *   • rotación de inventario y "días de venta" por producto
 *   • mix por categoría y por talle
 *   • participación de gastos recurrentes en la estructura de costos
 *   • ticket promedio y derivados
 */

import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type {
  AppData,
  DefectiveEntry,
  Product,
  ProductCategory,
  Sale,
  SaleLine,
} from "@/lib/data/types";
import {
  filterDefectivesInRange,
  filterSalesInRange,
  inRange,
  parseISODate,
  periodMetrics,
  periodMetricsWithProjections,
  productByIdMap,
  saleCogs,
  saleLineRevenue,
  saleTotal,
  stockStatus,
  type DateRange,
} from "@/lib/data/finance-calcs";
import type { CategoryMix } from "./types";

/* ─────────────────────────────────────────────────────────────────── */
/*  Range helpers                                                      */
/* ─────────────────────────────────────────────────────────────────── */

export function previousMonthlyRange(range: DateRange): DateRange {
  const lengthDays =
    differenceInCalendarDays(endOfDay(range.end), startOfDay(range.start)) + 1;
  const end = startOfDay(range.start);
  const start = startOfDay(subDays(end, lengthDays));
  return { start, end: addDays(end, -1) };
}

export function longRangeFor(now: Date, monthsBack = 6): DateRange {
  return {
    start: startOfMonth(subMonths(now, monthsBack - 1)),
    end: endOfDay(now),
  };
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Slope / tendencia                                                  */
/* ─────────────────────────────────────────────────────────────────── */

/** Regresión lineal simple sobre y_i = a + b * i. Devuelve `b` (pendiente). */
export function slope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/** Variación porcentual entre dos magnitudes (resistente a 0). */
export function pctChange(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0)
    return current > 0 ? 100 : current < 0 ? -100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** CAGR mensual aproximado a partir de una serie de N meses. */
export function monthlyCagr(values: number[]): number {
  const first = values.find((v) => v > 0) ?? 0;
  const last = values[values.length - 1] ?? 0;
  if (first <= 0 || last <= 0 || values.length < 2) return 0;
  return (last / first) ** (1 / (values.length - 1)) - 1;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Series mensuales para tendencias                                    */
/* ─────────────────────────────────────────────────────────────────── */

export type MonthlyPoint = {
  month: string; // "YYYY-MM"
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  expensesProjected: number;
  netProfit: number;
  unitsSold: number;
  saleCount: number;
  defectiveLoss: number;
};

export function monthlySeries(
  data: AppData,
  monthsBack: number,
  now = new Date(),
): MonthlyPoint[] {
  const out: MonthlyPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const ref = subMonths(now, i);
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    const range: DateRange = { start: startOfDay(start), end: endOfDay(end) };
    const m = periodMetricsWithProjections(data, range);
    out.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      revenue: m.revenue,
      cogs: m.cogsSales,
      grossProfit: m.grossProfit,
      expenses: m.expensesEmitted,
      expensesProjected: m.expensesProjected,
      netProfit: m.netProfitProjected,
      unitsSold: m.unitsSold,
      saleCount: m.saleCount,
      defectiveLoss: m.defectiveLoss,
    });
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Concentración (HHI normalizado y top-N share)                       */
/* ─────────────────────────────────────────────────────────────────── */

export type ConcentrationStats = {
  /** Participación de los top-N (0..1). */
  topNShare: number;
  /** Índice HHI normalizado 0..1 (0 = perfectamente diversificado). */
  hhi: number;
  /** Top-N nombres + share. */
  topItems: { id: string; label: string; share: number; value: number }[];
};

export function concentrationStats(
  weighted: { id: string; label: string; weight: number }[],
  topN = 3,
): ConcentrationStats {
  const filtered = weighted.filter((w) => w.weight > 0);
  const total = filtered.reduce((a, b) => a + b.weight, 0);
  if (total <= 0)
    return { topNShare: 0, hhi: 0, topItems: [] };
  const shares = filtered
    .map((w) => ({ ...w, share: w.weight / total }))
    .sort((a, b) => b.share - a.share);
  const topItems = shares.slice(0, topN).map((w) => ({
    id: w.id,
    label: w.label,
    share: w.share,
    value: w.weight,
  }));
  const topNShare = topItems.reduce((a, b) => a + b.share, 0);
  // HHI clásico = sumatoria de cuadrados de shares; lo dejamos en 0..1
  const hhi = shares.reduce((a, b) => a + b.share * b.share, 0);
  return { topNShare, hhi, topItems };
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Mix por categoría y por talle                                       */
/* ─────────────────────────────────────────────────────────────────── */

export function categoryMix(data: AppData, range: DateRange): CategoryMix[] {
  const sales = filterSalesInRange(data.sales, range);
  const productMap = productByIdMap(data.products);
  const cats: ProductCategory[] = [
    "Remeras",
    "Pantalones",
    "Abrigos",
    "Accesorios",
    "Calzado",
  ];
  const init: Record<ProductCategory, CategoryMix> = {} as Record<
    ProductCategory,
    CategoryMix
  >;
  for (const c of cats) {
    init[c] = {
      category: c,
      revenue: 0,
      units: 0,
      cogs: 0,
      grossProfit: 0,
      grossMarginPct: 0,
    };
  }
  for (const s of sales) {
    for (const l of s.lines) {
      const product = productMap.get(l.productId);
      if (!product) continue;
      const rev = saleLineRevenue(l);
      const cost = (s.costSnapshot[l.productId] ?? 0) * l.quantity;
      init[product.category].revenue += rev;
      init[product.category].cogs += cost;
      init[product.category].units += l.quantity;
      init[product.category].grossProfit += rev - cost;
    }
  }
  return Object.values(init).map((c) => ({
    ...c,
    grossMarginPct: c.revenue > 0 ? (c.grossProfit / c.revenue) * 100 : 0,
  }));
}

export function sizeMix(
  data: AppData,
  range: DateRange,
): { size: string; units: number; share: number }[] {
  const sales = filterSalesInRange(data.sales, range);
  const counts = new Map<string, number>();
  let total = 0;
  for (const s of sales) {
    for (const l of s.lines) {
      const sz = (l.size && l.size.trim() !== "" ? l.size : "S/T").toUpperCase();
      counts.set(sz, (counts.get(sz) ?? 0) + l.quantity);
      total += l.quantity;
    }
  }
  return [...counts.entries()]
    .map(([size, units]) => ({
      size,
      units,
      share: total > 0 ? units / total : 0,
    }))
    .sort((a, b) => b.units - a.units);
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Productos: rendimiento + rotación                                  */
/* ─────────────────────────────────────────────────────────────────── */

export type ProductRotation = {
  productId: string;
  product: Product;
  /** Unidades vendidas en la ventana. */
  unitsSold: number;
  /** Ingresos generados en la ventana. */
  revenue: number;
  /** COGS generado en la ventana. */
  cogs: number;
  /** Margen bruto en la ventana. */
  grossProfit: number;
  marginPct: number;
  /** Stock actual (unidades). */
  stock: number;
  /** Días sin venta. -1 si nunca tuvo venta. */
  daysSinceLastSale: number;
  /** Días de venta estimada para liquidar el stock actual (Infinity si rota 0). */
  daysOfInventory: number;
  /** Capital inmovilizado estimado (stock * costo unitario). */
  capitalLocked: number;
  status: "estrella" | "saludable" | "lento" | "muerto" | "sin_stock";
};

export function productRotation(
  data: AppData,
  windowDays = 90,
  now = new Date(),
): ProductRotation[] {
  const start = startOfDay(subDays(now, windowDays));
  const range: DateRange = { start, end: endOfDay(now) };
  const sales = filterSalesInRange(data.sales, range);
  const unitsMap = new Map<string, number>();
  const revenueMap = new Map<string, number>();
  const cogsMap = new Map<string, number>();
  const lastSaleAt = new Map<string, Date>();
  for (const s of sales) {
    for (const l of s.lines) {
      unitsMap.set(l.productId, (unitsMap.get(l.productId) ?? 0) + l.quantity);
      revenueMap.set(
        l.productId,
        (revenueMap.get(l.productId) ?? 0) + saleLineRevenue(l),
      );
      cogsMap.set(
        l.productId,
        (cogsMap.get(l.productId) ?? 0) +
          (s.costSnapshot[l.productId] ?? 0) * l.quantity,
      );
      const d = parseISODate(s.date);
      const prev = lastSaleAt.get(l.productId);
      if (!prev || d.getTime() > prev.getTime()) {
        lastSaleAt.set(l.productId, d);
      }
    }
  }
  // Productos que no aparecieron en la ventana también necesitan lastSaleAt global.
  const allSales = data.sales;
  for (const s of allSales) {
    for (const l of s.lines) {
      if (lastSaleAt.has(l.productId)) continue;
      const d = parseISODate(s.date);
      const prev = lastSaleAt.get(l.productId);
      if (!prev || d.getTime() > prev.getTime()) {
        lastSaleAt.set(l.productId, d);
      }
    }
  }

  return data.products.map((p) => {
    const units = unitsMap.get(p.id) ?? 0;
    const revenue = revenueMap.get(p.id) ?? 0;
    const cogs = cogsMap.get(p.id) ?? 0;
    const grossProfit = revenue - cogs;
    const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const last = lastSaleAt.get(p.id);
    const daysSinceLastSale = last
      ? differenceInCalendarDays(now, last)
      : -1;
    const dailyVelocity = units / windowDays;
    const daysOfInventory =
      dailyVelocity > 0 ? p.stock / dailyVelocity : Number.POSITIVE_INFINITY;
    const capitalLocked = (p.stock ?? 0) * (p.purchaseCost ?? 0);
    let status: ProductRotation["status"] = "saludable";
    if (p.stock <= 0) status = "sin_stock";
    else if (units === 0 && daysSinceLastSale > 120) status = "muerto";
    else if (units === 0 || dailyVelocity * 30 < 0.5) status = "lento";
    else if (units >= 12 && marginPct >= 35) status = "estrella";

    return {
      productId: p.id,
      product: p,
      unitsSold: units,
      revenue,
      cogs,
      grossProfit,
      marginPct,
      stock: p.stock,
      daysSinceLastSale,
      daysOfInventory,
      capitalLocked,
      status,
    };
  });
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Defectuosos                                                         */
/* ─────────────────────────────────────────────────────────────────── */

export function defectiveCostByCategory(
  data: AppData,
  range: DateRange,
): { category: ProductCategory; loss: number; units: number }[] {
  const map = productByIdMap(data.products);
  const filtered: DefectiveEntry[] = filterDefectivesInRange(
    data.defectives ?? [],
    range,
  );
  const init: Record<ProductCategory, { loss: number; units: number }> = {
    Remeras: { loss: 0, units: 0 },
    Pantalones: { loss: 0, units: 0 },
    Abrigos: { loss: 0, units: 0 },
    Accesorios: { loss: 0, units: 0 },
    Calzado: { loss: 0, units: 0 },
  };
  for (const d of filtered) {
    const p = map.get(d.productId);
    if (!p) continue;
    init[p.category].loss += d.quantity * d.unitCost;
    init[p.category].units += d.quantity;
  }
  return Object.entries(init).map(([category, v]) => ({
    category: category as ProductCategory,
    loss: v.loss,
    units: v.units,
  }));
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Ticket promedio                                                     */
/* ─────────────────────────────────────────────────────────────────── */

export function averageTicket(sales: Sale[]): number {
  if (sales.length === 0) return 0;
  const total = sales.reduce((a, s) => a + saleTotal(s), 0);
  return total / sales.length;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Recurrencias: peso en estructura de costos                          */
/* ─────────────────────────────────────────────────────────────────── */

export function recurrencesShareOfExpenses(
  data: AppData,
  range: DateRange,
): number {
  const baseExpenses = periodMetrics(data, range).expenses;
  const recurringEmitted = (data.expenses ?? []).reduce(
    (a, e) =>
      a +
      (e.fromRecurrenceId && inRange(parseISODate(e.date), range)
        ? e.amount
        : 0),
    0,
  );
  if (baseExpenses <= 0) return 0;
  return recurringEmitted / baseExpenses;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Clientes                                                            */
/* ─────────────────────────────────────────────────────────────────── */

export function customerRevenueWeights(
  data: AppData,
  range: DateRange,
): { id: string; label: string; weight: number }[] {
  const sales = filterSalesInRange(data.sales, range);
  const totals = new Map<string, number>();
  for (const s of sales) {
    if (!s.customerId) continue;
    totals.set(s.customerId, (totals.get(s.customerId) ?? 0) + saleTotal(s));
  }
  const map = new Map(data.customers.map((c) => [c.id, c]));
  return [...totals.entries()].map(([id, weight]) => ({
    id,
    label: map.get(id)?.name ?? id,
    weight,
  }));
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Misc utils                                                          */
/* ─────────────────────────────────────────────────────────────────── */

export function stockHealth(products: Product[]) {
  const total = products.length;
  if (total === 0) {
    return { low: 0, out: 0, healthy: 0, totalProducts: 0, lockedCapital: 0 };
  }
  let low = 0;
  let out = 0;
  let healthy = 0;
  let lockedCapital = 0;
  for (const p of products) {
    const status = stockStatus(p);
    if (status === "agotado") out++;
    else if (status === "bajo") low++;
    else healthy++;
    lockedCapital += (p.stock ?? 0) * (p.purchaseCost ?? 0);
  }
  return { low, out, healthy, totalProducts: total, lockedCapital };
}

/** Cuenta líneas de venta vinculadas a un set de productos. */
export function unitsByProductInRange(
  sales: Sale[],
  productIds: Set<string>,
): number {
  let units = 0;
  for (const s of sales) {
    for (const l of s.lines) {
      if (productIds.has(l.productId)) units += l.quantity;
    }
  }
  return units;
}

/** Convierte fecha ISO 'YYYY-MM-DD' a Date local seguro. */
export function parseDayLocal(s: string): Date {
  return parseISO(`${s}T12:00:00`);
}

/** Acceso a líneas de venta del período. */
export function saleLinesInRange(
  sales: Sale[],
  range: DateRange,
): { line: SaleLine; sale: Sale }[] {
  const out: { line: SaleLine; sale: Sale }[] = [];
  for (const s of filterSalesInRange(sales, range)) {
    for (const l of s.lines) out.push({ line: l, sale: s });
  }
  return out;
}

/** Recalcula COGS efectivo de un sale (mantener parity con finance-calcs). */
export const saleCogsLocal = saleCogs;
