import type { AppData } from "@/lib/data/types";
import {
  periodMetricsWithProjections,
  type DateRange,
} from "@/lib/data/finance-calcs";
import { formatCurrency } from "@/lib/format";
import type { Insight } from "../types";
import { monthlySeries, slope } from "../metrics";

export function detectRisks(
  data: AppData,
  current: DateRange,
  reference: DateRange,
): Insight[] {
  const out: Insight[] = [];

  /* 1. Pérdida sostenida en últimos 3 meses. */
  const series = monthlySeries(data, 3);
  if (series.length === 3) {
    const allLoss = series.every((s) => s.netProfit < 0);
    if (allLoss) {
      const totalLoss = series.reduce((a, s) => a + s.netProfit, 0);
      out.push({
        id: "risk/sustained-loss",
        category: "riesgo",
        severity: "critical",
        impact: 98,
        title: "Resultado neto negativo sostenido (3 meses)",
        summary: `Los últimos 3 meses cerraron con pérdida acumulada de ${formatCurrency(totalLoss)}.`,
        detail:
          "Una racha de tres meses negativos no es una variación coyuntural sino una señal estructural. Si no hay un plan de reversión inmediato, la sostenibilidad del negocio está comprometida.",
        recommendation:
          "Definir un plan de 90 días: bajar gastos discrecionales, renegociar fijos críticos y reactivar ventas de productos rentables.",
      });
    }
  }

  /* 2. Velocidad de caída del margen en 6 meses. */
  const series6 = monthlySeries(data, 6);
  if (series6.length === 6) {
    const margins = series6
      .filter((s) => s.revenue > 0)
      .map((s) => (s.netProfit / s.revenue) * 100);
    if (margins.length >= 4) {
      const m = slope(margins);
      if (m <= -1.5) {
        out.push({
          id: "risk/margin-erosion",
          category: "riesgo",
          severity: "warning",
          impact: 85,
          title: "Erosión sostenida del margen neto",
          summary: `El margen neto cae a un ritmo de ${m.toFixed(1)} pp por mes en los últimos meses.`,
          detail:
            "Una pendiente negativa del margen es un mejor predictor de problemas que un mes malo aislado. Conviene actuar antes de que el margen entre en terreno negativo.",
          recommendation:
            "Diagnosticar si es presión de costos o de gastos: tomar acción específica según el caso.",
        });
      }
    }
  }

  /* 3. Aumento abrupto de gastos. */
  const cur = periodMetricsWithProjections(data, current);
  const prev = periodMetricsWithProjections(data, reference);
  if (
    prev.expensesProjected > 0 &&
    cur.expensesProjected / prev.expensesProjected >= 1.3 &&
    cur.expensesProjected - prev.expensesProjected > 1000
  ) {
    out.push({
      id: "risk/expense-shock",
      category: "riesgo",
      severity: "warning",
      impact: 80,
      title: "Salto abrupto de gastos del período",
      summary: `Los gastos del período crecieron ${((cur.expensesProjected / prev.expensesProjected - 1) * 100).toFixed(0)} % respecto del período comparativo.`,
      detail:
        "Saltos abruptos suelen indicar pagos extraordinarios (impuestos, equipamiento, marketing puntual) o el inicio de una nueva recurrencia significativa. Conviene confirmar si es one-time o estructural.",
      metrics: [
        {
          label: "Gastos actuales",
          value: formatCurrency(cur.expensesProjected),
          tone: "warning",
        },
        {
          label: "Gastos previos",
          value: formatCurrency(prev.expensesProjected),
        },
      ],
      recommendation:
        "Auditar las categorías que más crecieron y separar lo one-time de lo recurrente.",
    });
  }

  /* 4. Riesgo de stock combinado (mucho agotado + tendencia de ingresos negativa). */
  const out_of_stock = data.products.filter((p) => p.stock <= 0).length;
  if (out_of_stock >= 4) {
    const revenueSlope = slope(series6.map((s) => s.revenue));
    const avgRev = series6.reduce((a, s) => a + s.revenue, 0) / Math.max(series6.length, 1);
    if (avgRev > 0 && revenueSlope / avgRev <= -0.04) {
      out.push({
        id: "risk/stockouts-with-declining-sales",
        category: "riesgo",
        severity: "warning",
        impact: 80,
        title: "Quiebres de stock acompañando caída de ventas",
        summary: `Hay ${out_of_stock} productos agotados y los ingresos vienen retrocediendo: parte de la caída podría no ser de demanda sino de disponibilidad.`,
        detail:
          "La situación combinada hace difícil distinguir si la baja de ventas se debe a falta de demanda o a quiebres operativos. Resolver primero la disponibilidad despeja el diagnóstico.",
        recommendation:
          "Reponer urgente los productos con mejor histórico y reevaluar tendencia tras dos semanas.",
      });
    }
  }

  return out;
}
