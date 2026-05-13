import type { AppData } from "@/lib/data/types";
import {
  periodMetrics,
  periodMetricsWithProjections,
  type DateRange,
} from "@/lib/data/finance-calcs";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import {
  monthlySeries,
  pctChange,
  recurrencesShareOfExpenses,
  slope,
} from "../metrics";

/**
 * Heurística empresarial: aceptable que los gastos crezcan más que las ventas
 * sólo si la diferencia es chica. >12 pp de "gap" empieza a comprometer margen.
 */
const EXPENSE_GAP_WARN = 12;
const MARGIN_DECLINE_WATCH = 2.5; // pp
const MARGIN_DECLINE_WARN = 5; // pp
const NET_PROFIT_CRITICAL = -0.000001;
const RECURRENCE_HIGH_SHARE = 0.55;
const COGS_RATIO_WARN = 70;
const COGS_RATIO_CRIT = 80;

export function detectFinancial(
  data: AppData,
  current: DateRange,
  reference: DateRange,
  longRange: DateRange,
): Insight[] {
  void longRange;
  const out: Insight[] = [];

  const cur = periodMetricsWithProjections(data, current);
  const prev = periodMetricsWithProjections(data, reference);

  const revDelta = pctChange(cur.revenue, prev.revenue);
  const expDelta = pctChange(cur.expensesProjected, prev.expensesProjected);
  const gap = expDelta - revDelta;

  /* 1. Gastos creciendo más rápido que ingresos. */
  if (
    cur.revenue > 0 &&
    prev.expensesProjected > 0 &&
    gap > EXPENSE_GAP_WARN
  ) {
    const sev = gap > 20 ? "warning" : "watch";
    out.push({
      id: "fin/expense-outpacing-revenue",
      category: "financiero",
      severity: sev,
      impact: Math.min(95, Math.round(gap * 4 + 35)),
      title: "Los gastos crecen más rápido que las ventas",
      summary: `Los gastos operativos (incluyendo recurrencias proyectadas) aumentaron ${expDelta.toFixed(1)} % mientras que los ingresos lo hicieron ${revDelta.toFixed(1)} %.`,
      detail:
        "Esta divergencia presiona el margen y, sostenida en el tiempo, reduce la rentabilidad operativa aun cuando la facturación crezca. Conviene revisar la estructura de gastos recurrentes y la eficiencia de cada partida.",
      metrics: [
        {
          label: "Ingresos",
          value: formatCurrency(cur.revenue),
          tone: "neutral",
        },
        {
          label: "Gastos del período",
          value: formatCurrency(cur.expensesProjected),
          tone: "warning",
        },
        {
          label: "Δ Ingresos",
          value: `${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(1)} %`,
        },
        {
          label: "Δ Gastos",
          value: `${expDelta >= 0 ? "+" : ""}${expDelta.toFixed(1)} %`,
          tone: "warning",
        },
      ],
      recommendation:
        "Auditar categorías con mayor crecimiento, validar contratos de servicios y priorizar gastos con retorno medible.",
    });
  }

  /* 2. Margen neto retrocede. */
  if (cur.revenue > 0 && prev.revenue > 0) {
    const ppDelta = cur.marginPctProjected - prev.marginPctProjected;
    if (ppDelta <= -MARGIN_DECLINE_WATCH) {
      const sev =
        ppDelta <= -MARGIN_DECLINE_WARN
          ? "warning"
          : "watch";
      out.push({
        id: "fin/margin-declining",
        category: "financiero",
        severity: sev,
        impact: Math.min(95, Math.round(Math.abs(ppDelta) * 6 + 40)),
        title: "Margen neto en retroceso",
        summary: `El margen neto pasó de ${prev.marginPctProjected.toFixed(1)} % a ${cur.marginPctProjected.toFixed(1)} % (${ppDelta.toFixed(1)} pp).`,
        detail:
          "La pérdida de eficiencia no se explica solamente por un mes débil: hay que cruzar contra el comportamiento de los costos, el mix de productos vendidos y la presión de los gastos recurrentes en la estructura del período.",
        metrics: [
          {
            label: "Margen actual",
            value: formatPercent(cur.marginPctProjected),
            tone: "warning",
          },
          {
            label: "Margen anterior",
            value: formatPercent(prev.marginPctProjected),
          },
          {
            label: "Variación",
            value: `${ppDelta >= 0 ? "+" : ""}${ppDelta.toFixed(1)} pp`,
            tone: "warning",
          },
        ],
        recommendation:
          "Identificar productos con menor margen y revisar la política de descuentos del período.",
      });
    } else if (ppDelta >= MARGIN_DECLINE_WATCH) {
      out.push({
        id: "fin/margin-expanding",
        category: "financiero",
        severity: "positive",
        impact: Math.min(85, Math.round(Math.abs(ppDelta) * 5 + 30)),
        title: "Mejora sostenida del margen neto",
        summary: `El margen neto creció ${ppDelta.toFixed(1)} pp respecto del período anterior.`,
        detail:
          "La eficiencia operativa mejoró: o bajaron costos relativos, o aumentaron precios sin perder volumen, o el mix se desplazó hacia productos más rentables.",
        metrics: [
          {
            label: "Margen actual",
            value: formatPercent(cur.marginPctProjected),
            tone: "positive",
          },
          {
            label: "Variación",
            value: `+${ppDelta.toFixed(1)} pp`,
            tone: "positive",
          },
        ],
        recommendation:
          "Consolidar el catálogo que está expandiendo el margen y replicar la política de pricing exitosa.",
      });
    }
  }

  /* 3. Negocio en pérdida. */
  if (cur.revenue > 0 && cur.netProfitProjected < NET_PROFIT_CRITICAL) {
    out.push({
      id: "fin/operating-loss",
      category: "financiero",
      severity: "critical",
      impact: 95,
      title: "Resultado operativo en pérdida",
      summary: `El período cerró con resultado neto negativo de ${formatCurrency(cur.netProfitProjected)}.`,
      detail:
        "La rentabilidad estructural está comprometida en el período. Esto puede deberse a una caída puntual de ventas, presión de gastos fijos o un mix poco rentable. Es imprescindible identificar la causa antes de que se sostenga en el tiempo.",
      metrics: [
        {
          label: "Resultado",
          value: formatCurrency(cur.netProfitProjected),
          tone: "danger",
        },
        {
          label: "Ingresos",
          value: formatCurrency(cur.revenue),
        },
        {
          label: "Gastos del período",
          value: formatCurrency(cur.expensesProjected),
          tone: "warning",
        },
      ],
      recommendation:
        "Diagnosticar si la causa es coyuntural o estructural. Reducir gastos discrecionales hasta normalizar el resultado.",
    });
  }

  /* 4. COGS relativo a ingresos. */
  if (cur.revenue > 0) {
    const cogsPct = (cur.cogsSales / cur.revenue) * 100;
    if (cogsPct >= COGS_RATIO_CRIT) {
      out.push({
        id: "fin/cogs-too-high",
        category: "financiero",
        severity: "warning",
        impact: 85,
        title: "Costo de mercadería excesivamente alto",
        summary: `El COGS representa el ${cogsPct.toFixed(1)} % de los ingresos, dejando un margen bruto comprimido.`,
        detail:
          "Con esa estructura, el margen bruto queda en el orden del " +
          formatPercent(cur.grossMarginPct) +
          ". Sin recortar el costo unitario o subir el precio relativo, el margen neto no tiene espacio para absorber gastos operativos.",
        metrics: [
          { label: "COGS / Ingresos", value: `${cogsPct.toFixed(1)} %`, tone: "danger" },
          { label: "Margen bruto", value: formatPercent(cur.grossMarginPct), tone: "warning" },
        ],
        recommendation:
          "Renegociar costos con proveedores o ajustar la lista de precios donde el mercado lo permita.",
      });
    } else if (cogsPct >= COGS_RATIO_WARN) {
      out.push({
        id: "fin/cogs-elevated",
        category: "financiero",
        severity: "watch",
        impact: 60,
        title: "Costo de mercadería elevado",
        summary: `El COGS pesa ${cogsPct.toFixed(1)} % de los ingresos del período.`,
        detail:
          "Aún es manejable, pero deja poco espacio para gastos extraordinarios. Conviene proyectar márgenes con políticas de descuento conservadoras.",
        metrics: [
          { label: "COGS / Ingresos", value: `${cogsPct.toFixed(1)} %`, tone: "warning" },
          { label: "Margen bruto", value: formatPercent(cur.grossMarginPct) },
        ],
      });
    }
  }

  /* 5. Recurrencias dominando la estructura de gastos. */
  const recShare = recurrencesShareOfExpenses(data, current);
  if (recShare >= RECURRENCE_HIGH_SHARE) {
    out.push({
      id: "fin/recurrent-dominance",
      category: "financiero",
      severity: "watch",
      impact: 55,
      title: "Alta dependencia de gastos recurrentes",
      summary: `Los gastos recurrentes representan ${(recShare * 100).toFixed(0)} % de los gastos del período.`,
      detail:
        "Una base recurrente elevada da previsibilidad, pero también rigidez frente a caídas de ingresos. Conviene monitorear que cada recurrencia siga aportando valor proporcional a su costo.",
      metrics: [
        {
          label: "% recurrencias",
          value: `${(recShare * 100).toFixed(0)} %`,
          tone: "warning",
        },
      ],
      recommendation:
        "Revisar servicios y suscripciones recurrentes: pausar los no esenciales y renegociar los críticos.",
    });
  }

  /* 6. Tendencia 6 meses (slope sobre ingresos / netProfit). */
  const series = monthlySeries(data, 6);
  if (series.length >= 4) {
    const revSlope = slope(series.map((s) => s.revenue));
    const netSlope = slope(series.map((s) => s.netProfit));
    const avgRevenue =
      series.reduce((a, s) => a + s.revenue, 0) / series.length;
    if (avgRevenue > 0) {
      const normSlope = revSlope / avgRevenue;
      if (normSlope <= -0.06) {
        out.push({
          id: "fin/revenue-trend-negative",
          category: "financiero",
          severity: normSlope <= -0.12 ? "warning" : "watch",
          impact: Math.min(85, Math.round(Math.abs(normSlope) * 250 + 40)),
          title: "Tendencia descendente sostenida de ingresos",
          summary: `Los ingresos muestran una pendiente negativa en los últimos ${series.length} meses.`,
          detail:
            "No es una caída puntual de un mes: la dirección está marcada. Antes de tomar decisiones agresivas, conviene cruzar contra estacionalidad histórica, cambios de catálogo o de canales de venta.",
          metrics: [
            {
              label: "Mes a mes (prom.)",
              value: `${revSlope >= 0 ? "+" : ""}${formatCurrency(revSlope)}`,
              tone: "warning",
            },
          ],
          recommendation:
            "Investigar la baja: variar canales, revisar precios y reactivar clientes inactivos.",
        });
      } else if (normSlope >= 0.06 && netSlope >= 0) {
        out.push({
          id: "fin/revenue-trend-positive",
          category: "financiero",
          severity: "positive",
          impact: Math.min(80, Math.round(normSlope * 250 + 30)),
          title: "Tendencia de crecimiento consistente",
          summary: `Los ingresos muestran crecimiento sostenido (+${formatCurrency(revSlope)} promedio mensual).`,
          detail:
            "El negocio está expandiéndose con margen acompañando. Es buen momento para invertir selectivamente en capacidad y stock de los productos que están traccionando.",
          recommendation:
            "Asegurar reposición temprana del catálogo que tracciona; capitalizar el momentum sin saturar costos fijos.",
        });
      }
    }
  }

  /* 7. Defectuosos comparados con ingresos. */
  if (cur.revenue > 0) {
    const defPct = (cur.defectiveLoss / cur.revenue) * 100;
    if (defPct >= 4) {
      out.push({
        id: "fin/defective-pressure",
        category: "financiero",
        severity: defPct >= 8 ? "warning" : "watch",
        impact: Math.min(80, Math.round(defPct * 6 + 30)),
        title: "Pérdida por defectuosos relevante",
        summary: `Los defectuosos representan ${defPct.toFixed(1)} % de los ingresos del período.`,
        detail:
          "Cuando los defectuosos superan ~3-4 % de las ventas, se vuelven una sangría sostenida del margen. Suele indicar problemas con un proveedor o un lote específico.",
        metrics: [
          {
            label: "Pérdida defectuosos",
            value: formatCurrency(cur.defectiveLoss),
            tone: "warning",
          },
          { label: "% ingresos", value: `${defPct.toFixed(1)} %`, tone: "warning" },
        ],
        recommendation:
          "Identificar familias con mayor incidencia de defectuosos y reclamar al proveedor.",
      });
    }
  }

  return out;
}
