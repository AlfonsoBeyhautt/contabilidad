import {
  averageTicket,
  concentrationStats,
  customerRevenueWeights,
  defectiveCostByCategory,
  monthlySeries,
  productRotation,
  recurrencesShareOfExpenses,
  stockHealth,
} from "@/lib/intelligence/metrics";
import type { IntelligenceReport } from "@/lib/intelligence/types";
import type { AppData } from "@/lib/data/types";
import {
  filterDefectivesInRange,
  filterSalesInRange,
  inRange,
  parseISODate,
  periodMetricsWithProjections,
  productByIdMap,
  saleLineRevenue,
  topProductsByRevenue,
  expensesByCategory,
  filterExpensesInRange,
  monthlyChartSeriesThroughCurrentMonth,
  stockStatus,
  type DateRange,
  type PeriodPreset,
} from "@/lib/data/finance-calcs";

const SCHEMA_VERSION = 1 as const;

function clipText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type ProductPeriodRow = {
  productId: string;
  name: string;
  revenue: number;
  cogs: number;
  quantity: number;
  marginPct: number;
  grossProfit: number;
};

function productPerformanceInPeriod(
  data: AppData,
  range: DateRange,
): ProductPeriodRow[] {
  const sales = filterSalesInRange(data.sales, range);
  const pmap = productByIdMap(data.products);
  const acc = new Map<
    string,
    { revenue: number; cogs: number; quantity: number }
  >();
  for (const s of sales) {
    for (const l of s.lines) {
      const r = saleLineRevenue(l);
      const c = (s.costSnapshot[l.productId] ?? 0) * l.quantity;
      const cur = acc.get(l.productId) ?? { revenue: 0, cogs: 0, quantity: 0 };
      cur.revenue += r;
      cur.cogs += c;
      cur.quantity += l.quantity;
      acc.set(l.productId, cur);
    }
  }
  const rows: ProductPeriodRow[] = [];
  for (const [productId, v] of acc) {
    if (v.revenue <= 0) continue;
    const gp = v.revenue - v.cogs;
    rows.push({
      productId,
      name: pmap.get(productId)?.name ?? productId,
      revenue: v.revenue,
      cogs: v.cogs,
      quantity: v.quantity,
      grossProfit: gp,
      marginPct: (gp / v.revenue) * 100,
    });
  }
  return rows;
}

function defectiveTopProducts(
  data: AppData,
  range: DateRange,
  limit = 6,
): { name: string; loss: number; units: number }[] {
  const pmap = productByIdMap(data.products);
  const m = new Map<string, { loss: number; units: number }>();
  for (const d of filterDefectivesInRange(data.defectives ?? [], range)) {
    const cur = m.get(d.productId) ?? { loss: 0, units: 0 };
    cur.loss += d.quantity * d.unitCost;
    cur.units += d.quantity;
    m.set(d.productId, cur);
  }
  return [...m.entries()]
    .map(([id, v]) => ({
      name: pmap.get(id)?.name ?? id,
      loss: v.loss,
      units: v.units,
    }))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, limit);
}

export type BusinessContextForAI = {
  schemaVersion: typeof SCHEMA_VERSION;
  currency: string;
  shopName: string;
  period: {
    preset: PeriodPreset | string;
    start: string;
    end: string;
    label: string;
  };
  referencePeriod: { start: string; end: string; label: string };
  financialSummary: {
    revenue: number;
    totalEgresos: number;
    cogsSales: number;
    operatingExpensesProjected: number;
    defectiveLoss: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingProfitProjected: number;
    operatingMarginPctProjected: number;
    netProfitProjected: number;
    netMarginPctProjected: number;
    saleCount: number;
    unitsSold: number;
    avgTicket: number;
  };
  /** Año calendario en curso, meses hasta el mes actual (sin futuros). */
  monthlyCalendarYear: {
    year: number;
    rows: {
      month: number;
      revenue: number;
      egresosTotales: number;
      cogs: number;
      gastosProyectados: number;
      defectivos: number;
      netProfit: number;
      netMarginPct: number;
    }[];
  };
  /** Últimos 12 meses calendario (ventana móvil). */
  monthlyRolling12: {
    month: string;
    revenue: number;
    expensesProjected: number;
    netProfit: number;
    defectiveLoss: number;
  }[];
  products: {
    topByRevenue: { name: string; revenue: number; quantity: number }[];
    bestMarginByGrossProfit: {
      name: string;
      revenue: number;
      marginPct: number;
      grossProfit: number;
    }[];
    worstMarginAmongMaterial: {
      name: string;
      revenue: number;
      marginPct: number;
      grossProfit: number;
    }[];
    lowRotation: {
      name: string;
      status: string;
      stock: number;
      capitalLocked: number;
      daysSinceLastSale: number;
    }[];
    criticalStock: { name: string; stock: number; minStock: number; status: string }[];
    immobilizedCapital: { name: string; stock: number; capitalLocked: number }[];
  };
  stock: {
    totalUnits: number;
    skuCount: number;
    lowCount: number;
    outCount: number;
    healthyCount: number;
    lockedCapitalEstimate: number;
  };
  expenses: {
    emittedByCategory: Record<string, number>;
    recurrenceShareOfEmittedExpenses: number;
  };
  customers: {
    top: { name: string; revenue: number; shareAmongAttributed: number }[];
    top3ConcentrationAmongAttributed: number;
    attributedRevenueVsTotal: number;
    walkInRevenueShareOfTotal: number;
    newCustomersRegisteredInPeriod: number;
  };
  defectives: {
    totalCost: number;
    byCategory: { category: string; loss: number; units: number }[];
    topProducts: { name: string; loss: number; units: number }[];
  };
  deterministicIntel: {
    healthScore: number;
    healthGrade: string;
    healthDeltaVsReferencePeriod: number;
    healthComponents: {
      id: string;
      label: string;
      score: number;
      rationale: string;
    }[];
    executiveSummaryParagraphs: string[];
    executiveHighlights: string[];
    priorityInsights: {
      id: string;
      category: string;
      severity: string;
      title: string;
      summary: string;
      recommendation?: string;
    }[];
    otherInsights: { id: string; category: string; severity: string; title: string }[];
    recommendations: { priority: string; title: string; rationale: string }[];
    risks: { title: string; summary: string }[];
    opportunities: { title: string; summary: string }[];
  };
};

export function buildBusinessContextForAI(input: {
  data: AppData;
  periodRange: DateRange;
  periodPreset: PeriodPreset;
  periodLabel: string;
  report: IntelligenceReport;
  now?: Date;
}): BusinessContextForAI {
  const now = input.now ?? new Date();
  const { data, periodRange: range, periodPreset, periodLabel, report } = input;
  const cur = periodMetricsWithProjections(data, range);
  const salesIn = filterSalesInRange(data.sales, range);
  const avgTicket = averageTicket(salesIn);

  const totalEgresos =
    cur.cogsSales + cur.expensesProjected + cur.defectiveLoss;

  const year = now.getFullYear();
  const calRows = monthlyChartSeriesThroughCurrentMonth(data, year, now).map(
    (r) => ({
      month: r.month,
      revenue: r.Ingresos,
      egresosTotales: r.Egresos,
      cogs: r.COGS,
      gastosProyectados: r.Gastos,
      defectivos: r.Defectuosos,
      netProfit: r["Ganancia neta"],
      netMarginPct:
        r.Ingresos > 0 ? (r["Ganancia neta"] / r.Ingresos) * 100 : 0,
    }),
  );

  const roll = monthlySeries(data, 12, now).map((m) => ({
    month: m.month,
    revenue: m.revenue,
    expensesProjected: m.expensesProjected,
    netProfit: m.netProfit,
    defectiveLoss: m.defectiveLoss,
  }));

  const topRev = topProductsByRevenue(
    salesIn,
    data.products,
    8,
  ).map((p) => ({
    name: p.name,
    revenue: p.revenue,
    quantity: p.quantity,
  }));

  const perf = productPerformanceInPeriod(data, range);
  const byGp = [...perf].sort((a, b) => b.grossProfit - a.grossProfit);
  const bestMarginByGrossProfit = byGp.slice(0, 5).map((p) => ({
    name: p.name,
    revenue: p.revenue,
    marginPct: p.marginPct,
    grossProfit: p.grossProfit,
  }));
  const material = perf.filter((p) => p.revenue >= 5000);
  const worstPool =
    material.length > 0
      ? [...material].sort((a, b) => a.marginPct - b.marginPct)
      : [...perf].sort((a, b) => a.marginPct - b.marginPct);
  const worstMarginAmongMaterial = worstPool.slice(0, 5).map((p) => ({
    name: p.name,
    revenue: p.revenue,
    marginPct: p.marginPct,
    grossProfit: p.grossProfit,
  }));

  const rot = productRotation(data, 90, now);
  const lowRotation = [...rot]
    .filter((r) => (r.status === "lento" || r.status === "muerto") && r.stock > 0)
    .sort((a, b) => b.capitalLocked - a.capitalLocked)
    .slice(0, 8)
    .map((r) => ({
      name: r.product.name,
      status: r.status,
      stock: r.stock,
      capitalLocked: r.capitalLocked,
      daysSinceLastSale: r.daysSinceLastSale,
    }));

  const crit = data.products
    .filter((p) => {
      const st = stockStatus(p);
      return st === "bajo" || st === "agotado";
    })
    .map((p) => ({
      name: p.name,
      stock: p.stock,
      minStock: p.minStock,
      status: stockStatus(p),
    }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 12);

  const immobilized = [...rot]
    .filter((r) => r.capitalLocked > 0 && r.stock > 0)
    .sort((a, b) => b.capitalLocked - a.capitalLocked)
    .slice(0, 8)
    .map((r) => ({
      name: r.product.name,
      stock: r.stock,
      capitalLocked: r.capitalLocked,
    }));

  const sh = stockHealth(data.products);
  const totalUnits = data.products.reduce((a, p) => a + (p.stock ?? 0), 0);

  const emitted = filterExpensesInRange(data.expenses ?? [], range);
  const emittedBy = expensesByCategory(emitted);
  const emittedByCategory: Record<string, number> = {
    producción: emittedBy.producción,
    marketing: emittedBy.marketing,
    envíos: emittedBy.envíos,
    otros: emittedBy.otros,
  };

  const custWeights = customerRevenueWeights(data, range);
  const custForConc = custWeights.map((w) => ({
    id: w.id,
    label: w.label,
    weight: w.weight,
  }));
  const concTop5 = concentrationStats(custForConc, 5);
  const concTop3 = concentrationStats(custForConc, 3);
  const attributed = custWeights.reduce((a, w) => a + w.weight, 0);
  const walkIn = Math.max(0, cur.revenue - attributed);
  const walkInShare = cur.revenue > 0 ? walkIn / cur.revenue : 0;
  const attributedShare = cur.revenue > 0 ? attributed / cur.revenue : 0;

  const newCustomers = (data.customers ?? []).filter((c) =>
    inRange(parseISODate(c.registeredAt), range),
  ).length;

  const defCat = defectiveCostByCategory(data, range);
  const defTop = defectiveTopProducts(data, range);

  const priority = report.insights.slice(0, 5).map((i) => ({
    id: i.id,
    category: i.category,
    severity: i.severity,
    title: i.title,
    summary: clipText(i.summary, 420),
    recommendation: i.recommendation
      ? clipText(i.recommendation, 220)
      : undefined,
  }));

  const other = report.insights.slice(5, 22).map((i) => ({
    id: i.id,
    category: i.category,
    severity: i.severity,
    title: i.title,
  }));

  const recs = report.recommendations.slice(0, 12).map((r) => ({
    priority: r.priority,
    title: r.title,
    rationale: clipText(r.rationale, 280),
  }));

  const risks = report.insights
    .filter((i) => i.category === "riesgo")
    .slice(0, 6)
    .map((i) => ({
      title: i.title,
      summary: clipText(i.summary, 320),
    }));

  const opportunities = report.insights
    .filter((i) => i.category === "oportunidad")
    .slice(0, 6)
    .map((i) => ({
      title: i.title,
      summary: clipText(i.summary, 320),
    }));

  return {
    schemaVersion: SCHEMA_VERSION,
    currency: data.settings?.currency ?? "ARS",
    shopName: clipText(data.settings?.shopName ?? "Negocio", 80),
    period: {
      preset: periodPreset,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      label: periodLabel,
    },
    referencePeriod: {
      start: report.context.reference.start,
      end: report.context.reference.end,
      label: report.context.reference.label,
    },
    financialSummary: {
      revenue: cur.revenue,
      totalEgresos,
      cogsSales: cur.cogsSales,
      operatingExpensesProjected: cur.expensesProjected,
      defectiveLoss: cur.defectiveLoss,
      grossProfit: cur.grossProfit,
      grossMarginPct: cur.grossMarginPct,
      operatingProfitProjected: cur.operatingProfitProjected,
      operatingMarginPctProjected: cur.operatingMarginPctProjected,
      netProfitProjected: cur.netProfitProjected,
      netMarginPctProjected: cur.marginPctProjected,
      saleCount: cur.saleCount,
      unitsSold: cur.unitsSold,
      avgTicket,
    },
    monthlyCalendarYear: { year, rows: calRows },
    monthlyRolling12: roll,
    products: {
      topByRevenue: topRev,
      bestMarginByGrossProfit,
      worstMarginAmongMaterial,
      lowRotation,
      criticalStock: crit,
      immobilizedCapital: immobilized,
    },
    stock: {
      totalUnits,
      skuCount: sh.totalProducts,
      lowCount: sh.low,
      outCount: sh.out,
      healthyCount: sh.healthy,
      lockedCapitalEstimate: sh.lockedCapital,
    },
    expenses: {
      emittedByCategory,
      recurrenceShareOfEmittedExpenses: recurrencesShareOfExpenses(data, range),
    },
    customers: {
      top: concTop5.topItems.map((t) => ({
        name: t.label,
        revenue: t.value,
        shareAmongAttributed: t.share,
      })),
      top3ConcentrationAmongAttributed: concTop3.topNShare,
      attributedRevenueVsTotal: attributedShare,
      walkInRevenueShareOfTotal: walkInShare,
      newCustomersRegisteredInPeriod: newCustomers,
    },
    defectives: {
      totalCost: cur.defectiveLoss,
      byCategory: defCat.map((d) => ({
        category: d.category,
        loss: d.loss,
        units: d.units,
      })),
      topProducts: defTop,
    },
    deterministicIntel: {
      healthScore: report.health.score,
      healthGrade: report.health.grade,
      healthDeltaVsReferencePeriod: report.health.delta,
      healthComponents: report.health.components.map((c) => ({
        id: c.id,
        label: c.label,
        score: c.score,
        rationale: clipText(c.rationale, 200),
      })),
      executiveSummaryParagraphs: report.summary.paragraphs.map((p) =>
        clipText(p, 600),
      ),
      executiveHighlights: report.summary.highlights.map((h) =>
        clipText(h, 220),
      ),
      priorityInsights: priority,
      otherInsights: other,
      recommendations: recs,
      risks,
      opportunities,
    },
  };
}
