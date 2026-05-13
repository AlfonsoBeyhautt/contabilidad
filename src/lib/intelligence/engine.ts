/**
 * Engine principal. Combina detectores y produce un IntelligenceReport.
 * Toda la salida es serializable y barata de re-calcular (no hace I/O).
 */

import type { AppData } from "@/lib/data/types";
import {
  filterSalesInRange,
  periodMetricsWithProjections,
  previousPeriodRange,
  type DateRange,
} from "@/lib/data/finance-calcs";
import {
  averageTicket,
  categoryMix,
  longRangeFor,
  pctChange,
} from "./metrics";
import { buildHealthScore } from "./health-score";
import {
  buildExecutiveSummary,
  buildExplorationQuestions,
  buildRecommendations,
} from "./narrative";
import { detectCommercial } from "./detectors/commercial";
import { detectFinancial } from "./detectors/financial";
import { detectOperational } from "./detectors/operational";
import { detectOpportunities } from "./detectors/opportunity";
import { detectRisks } from "./detectors/risk";
import type {
  Insight,
  IntelligenceContext,
  IntelligenceReport,
} from "./types";

const severityOrder = {
  critical: 0,
  warning: 1,
  watch: 2,
  positive: 3,
  info: 4,
} as const;

function sortInsights(insights: Insight[]): Insight[] {
  return [...insights].sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      b.impact - a.impact,
  );
}

function dedupe(insights: Insight[]): Insight[] {
  const seen = new Set<string>();
  const out: Insight[] = [];
  for (const ins of insights) {
    if (seen.has(ins.id)) continue;
    seen.add(ins.id);
    out.push(ins);
  }
  return out;
}

export type BuildReportOptions = {
  period: DateRange;
  periodLabel: string;
  reference?: DateRange;
  referenceLabel?: string;
  now?: Date;
};

export function buildIntelligenceReport(
  data: AppData,
  opts: BuildReportOptions,
): IntelligenceReport {
  const now = opts.now ?? new Date();
  const period = opts.period;
  const reference = opts.reference ?? previousPeriodRange(period);
  const longRange = longRangeFor(now, 6);

  const context: IntelligenceContext = {
    generatedAt: now.toISOString(),
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      label: opts.periodLabel,
    },
    reference: {
      start: reference.start.toISOString(),
      end: reference.end.toISOString(),
      label: opts.referenceLabel ?? "período comparativo",
    },
    longRange: {
      start: longRange.start.toISOString(),
      end: longRange.end.toISOString(),
      label: "últimos 6 meses",
    },
  };

  /* Detectores */
  const rawInsights: Insight[] = [
    ...detectFinancial(data, period, reference, longRange),
    ...detectOperational(data, period),
    ...detectCommercial(data, period, reference),
    ...detectRisks(data, period, reference),
    ...detectOpportunities(data, period),
  ];
  const insights = sortInsights(dedupe(rawInsights));

  /* KPIs base */
  const cur = periodMetricsWithProjections(data, period);
  const prev = periodMetricsWithProjections(data, reference);
  const curSales = filterSalesInRange(data.sales, period);
  const prevSales = filterSalesInRange(data.sales, reference);
  const ticketCur = averageTicket(curSales);
  const ticketPrev = averageTicket(prevSales);
  const revenueDeltaPct = pctChange(cur.revenue, prev.revenue);
  const expensesDeltaPct = pctChange(cur.expensesProjected, prev.expensesProjected);

  const kpis: IntelligenceReport["kpis"] = {
    revenue: cur.revenue,
    revenuePrev: prev.revenue,
    revenueDeltaPct,
    grossProfit: cur.grossProfit,
    grossMarginPct: cur.grossMarginPct,
    netProfit: cur.netProfitProjected,
    netMarginPct: cur.marginPctProjected,
    expenses: cur.expensesProjected,
    expensesPrev: prev.expensesProjected,
    expensesDeltaPct,
    cogsSales: cur.cogsSales,
    defectiveLoss: cur.defectiveLoss,
    saleCount: cur.saleCount,
    unitsSold: cur.unitsSold,
    avgTicket: ticketCur,
    avgTicketPrev: ticketPrev,
  };

  /* Health score */
  const health = buildHealthScore(data, period, reference);

  /* Narrativa, recomendaciones, preguntas */
  const summary = buildExecutiveSummary(health, insights, kpis, context);
  const recommendations = buildRecommendations(insights);
  const explorationQuestions = buildExplorationQuestions(insights);
  const cMix = categoryMix(data, period);

  return {
    context,
    health,
    summary,
    insights,
    recommendations,
    explorationQuestions,
    categoryMix: cMix,
    kpis,
  };
}
