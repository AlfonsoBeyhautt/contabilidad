import type { AppData } from "@/lib/data/types";
import {
  periodMetricsWithProjections,
  type DateRange,
} from "@/lib/data/finance-calcs";
import { formatPercent } from "@/lib/format";
import {
  monthlySeries,
  productRotation,
  recurrencesShareOfExpenses,
  stockHealth,
} from "./metrics";
import type { HealthScore, HealthSubScore } from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/**
 * Linear mapping de `value` desde [from, to] hacia [0, 100]. Útil para convertir
 * métricas en puntajes acotados (ej. margen ∈ [-10, 30] → [0, 100]).
 */
function mapToScore(value: number, from: number, to: number): number {
  if (to === from) return 50;
  const pct = (value - from) / (to - from);
  return clamp(pct * 100);
}

function rentabilidad(metrics: ReturnType<typeof periodMetricsWithProjections>): HealthSubScore {
  // Margen neto proyectado domina (88 %); margen bruto solo matiza (12 %).
  const grossScore = mapToScore(metrics.grossMarginPct, 12, 55);
  const netMargin = metrics.marginPctProjected;
  const netScore = mapToScore(netMargin, -12, 28);
  const score = Math.round(grossScore * 0.12 + netScore * 0.88);
  return {
    id: "rentabilidad",
    label: "Rentabilidad",
    score,
    rationale: `Margen bruto ${formatPercent(metrics.grossMarginPct)} · margen neto proyectado ${formatPercent(netMargin)}.`,
  };
}

function crecimiento(
  cur: ReturnType<typeof periodMetricsWithProjections>,
  prev: ReturnType<typeof periodMetricsWithProjections>,
  data: AppData,
): HealthSubScore {
  const revDeltaPct =
    prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : 0;
  const deltaScore = mapToScore(revDeltaPct, -20, 30);
  const series = monthlySeries(data, 6);
  const avg = series.reduce((a, s) => a + s.revenue, 0) / Math.max(series.length, 1);
  const slopeNormalized = avg > 0
    ? series.length >= 2
      ? ((series[series.length - 1].revenue - series[0].revenue) /
          Math.max(series[0].revenue, 1))
      : 0
    : 0;
  const slopeScore = mapToScore(slopeNormalized * 100, -25, 35);
  let score = Math.round(deltaScore * 0.5 + slopeScore * 0.5);

  // Con pérdida neta, el volumen de ventas no debe inflar el subscore.
  if (cur.netProfitProjected < 0) {
    score = Math.round(score * 0.42);
  } else if (cur.marginPctProjected < 0) {
    score = Math.round(score * 0.62);
  }

  return {
    id: "crecimiento",
    label: "Crecimiento",
    score,
    rationale: `Variación de ingresos ${revDeltaPct >= 0 ? "+" : ""}${revDeltaPct.toFixed(1)} % vs período comparativo.`,
  };
}

function eficiencia(
  cur: ReturnType<typeof periodMetricsWithProjections>,
  data: AppData,
  current: DateRange,
): HealthSubScore {
  if (cur.revenue <= 0) {
    return {
      id: "eficiencia",
      label: "Eficiencia operativa",
      score: 50,
      rationale: "Sin ingresos suficientes para evaluar.",
    };
  }
  const expensesPct = (cur.expensesProjected / cur.revenue) * 100;
  const expensesScore = mapToScore(expensesPct, 60, 10);
  const defPct = (cur.defectiveLoss / cur.revenue) * 100;
  const defScore = mapToScore(defPct, 8, 0);
  const recShare = recurrencesShareOfExpenses(data, current) * 100;
  const recScore = mapToScore(recShare, 80, 25);
  const score = Math.round(
    expensesScore * 0.5 + defScore * 0.3 + recScore * 0.2,
  );
  return {
    id: "eficiencia",
    label: "Eficiencia operativa",
    score,
    rationale: `Gastos del período representan ${expensesPct.toFixed(1)} % de las ventas; defectuosos ${defPct.toFixed(1)} %.`,
  };
}

function stock(data: AppData): HealthSubScore {
  const sh = stockHealth(data.products);
  if (sh.totalProducts === 0) {
    return {
      id: "stock",
      label: "Salud de stock",
      score: 60,
      rationale: "Catálogo todavía sin productos cargados.",
    };
  }
  const healthyPct = (sh.healthy / sh.totalProducts) * 100;
  const outPct = (sh.out / sh.totalProducts) * 100;
  const healthyScore = mapToScore(healthyPct, 40, 95);
  const outScore = mapToScore(outPct, 20, 0);

  const rotation = productRotation(data, 90);
  const dead = rotation.filter((r) => r.status === "muerto").length;
  const deadPct = (dead / sh.totalProducts) * 100;
  const deadScore = mapToScore(deadPct, 25, 0);

  const score = Math.round(
    healthyScore * 0.5 + outScore * 0.3 + deadScore * 0.2,
  );
  return {
    id: "stock",
    label: "Salud de stock",
    score,
    rationale: `${sh.healthy} productos saludables, ${sh.low} en stock bajo y ${sh.out} agotados.`,
  };
}

function diversificacion(
  data: AppData,
  current: DateRange,
): HealthSubScore {
  const sales = data.sales.filter((s) => {
    const d = new Date(s.date);
    return d >= current.start && d <= current.end;
  });
  const prodRevenue = new Map<string, number>();
  for (const s of sales) {
    for (const l of s.lines) {
      const rev = Math.max(0, l.quantity * l.unitPrice - l.discount);
      prodRevenue.set(l.productId, (prodRevenue.get(l.productId) ?? 0) + rev);
    }
  }
  const totalRev = [...prodRevenue.values()].reduce((a, b) => a + b, 0);
  let prodHhi = 0;
  if (totalRev > 0) {
    for (const v of prodRevenue.values()) prodHhi += (v / totalRev) ** 2;
  }
  const prodScore = mapToScore(prodHhi, 0.7, 0.1);

  const custRevenue = new Map<string, number>();
  for (const s of sales) {
    if (!s.customerId) continue;
    custRevenue.set(
      s.customerId,
      (custRevenue.get(s.customerId) ?? 0) +
        s.lines.reduce((a, l) => a + Math.max(0, l.quantity * l.unitPrice - l.discount), 0),
    );
  }
  let custHhi = 0;
  const totCust = [...custRevenue.values()].reduce((a, b) => a + b, 0);
  if (totCust > 0) {
    for (const v of custRevenue.values()) custHhi += (v / totCust) ** 2;
  }
  const custScore =
    custRevenue.size === 0 ? 60 : mapToScore(custHhi, 0.8, 0.1);

  const score = Math.round(prodScore * 0.6 + custScore * 0.4);
  return {
    id: "diversificacion",
    label: "Diversificación",
    score,
    rationale: `Ingresos repartidos entre ${prodRevenue.size} productos y ${custRevenue.size} clientes.`,
  };
}

function estabilidad(data: AppData): HealthSubScore {
  const series = monthlySeries(data, 6);
  if (series.length < 3) {
    return {
      id: "estabilidad",
      label: "Estabilidad",
      score: 50,
      rationale: "Histórico insuficiente para evaluar volatilidad.",
    };
  }
  const revenues = series.map((s) => s.revenue);
  const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  if (mean <= 0) {
    return {
      id: "estabilidad",
      label: "Estabilidad",
      score: 40,
      rationale: "Aún sin volumen recurrente.",
    };
  }
  const variance =
    revenues.reduce((a, v) => a + (v - mean) ** 2, 0) / revenues.length;
  const cv = Math.sqrt(variance) / mean;
  const score = Math.round(mapToScore(cv, 0.6, 0.05));
  return {
    id: "estabilidad",
    label: "Estabilidad",
    score,
    rationale: `Coeficiente de variación de ingresos mensuales ≈ ${cv.toFixed(2)}.`,
  };
}

/** Rentabilidad real con mayor peso; crecimiento y diversificación más acotados. */
const WEIGHTS: Record<HealthSubScore["id"], number> = {
  rentabilidad: 0.44,
  crecimiento: 0.12,
  eficiencia: 0.2,
  stock: 0.12,
  diversificacion: 0.07,
  estabilidad: 0.05,
};

function grade(score: number): HealthScore["grade"] {
  if (score >= 80) return "excelente";
  if (score >= 65) return "saludable";
  if (score >= 50) return "estable";
  if (score >= 35) return "atención";
  return "crítico";
}

function sustainedLossFactor(data: AppData): number {
  const series = monthlySeries(data, 6);
  const neg = series.filter((x) => x.netProfit < 0 && x.revenue > 0).length;
  if (neg >= 5) return 0.52;
  if (neg >= 4) return 0.66;
  if (neg >= 3) return 0.8;
  if (neg >= 2) return 0.92;
  return 1;
}

export function buildHealthScore(
  data: AppData,
  current: DateRange,
  reference: DateRange,
): HealthScore {
  const cur = periodMetricsWithProjections(data, current);
  const prev = periodMetricsWithProjections(data, reference);

  const components: HealthSubScore[] = [
    rentabilidad(cur),
    crecimiento(cur, prev, data),
    eficiencia(cur, data, current),
    stock(data),
    diversificacion(data, current),
    estabilidad(data),
  ];

  const totalScore = components.reduce(
    (a, c) => a + c.score * WEIGHTS[c.id],
    0,
  );
  let score = Math.round(totalScore * sustainedLossFactor(data));

  if (cur.revenue > 0 && cur.marginPctProjected < 0) {
    score = Math.min(score, Math.round(48 + Math.max(-18, cur.marginPctProjected) * 1.1));
  }
  if (cur.netProfitProjected < 0 && cur.revenue > 0) {
    const depth = Math.min(1, Math.abs(cur.netProfitProjected) / cur.revenue);
    score = Math.round(score * (1 - 0.38 * depth));
  }

  score = clamp(score, 0, 100);

  const prevApprox =
    rentabilidad(prev).score * (WEIGHTS.rentabilidad + WEIGHTS.eficiencia * 0.5) +
    crecimiento(prev, prev, data).score * (WEIGHTS.crecimiento + WEIGHTS.estabilidad * 0.5);
  const prevScore = Math.round(prevApprox);
  const delta = Math.max(-100, Math.min(100, score - prevScore));

  return {
    score,
    grade: grade(score),
    delta,
    components,
  };
}
