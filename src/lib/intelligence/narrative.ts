/**
 * Generación de la narrativa ejecutiva, recomendaciones priorizadas y preguntas
 * sugeridas, todo basado en datos ya analizados (insights + KPIs + health).
 *
 * Esta capa es 100% determinística pero pensada como reemplazo natural por una
 * capa LLM (mismo input → mismo formato `ExecutiveSummary`).
 */

import { formatCurrency, formatPercent } from "@/lib/format";
import type {
  ExecutiveSummary,
  ExplorationQuestion,
  HealthScore,
  Insight,
  IntelligenceContext,
  IntelligenceReport,
  Recommendation,
} from "./types";

const severityOrder = {
  critical: 0,
  warning: 1,
  watch: 2,
  positive: 3,
  info: 4,
} as const;

function pickTopInsights(insights: Insight[], count: number, severities?: Insight["severity"][]) {
  return insights
    .filter((i) => !severities || severities.includes(i.severity))
    .sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        b.impact - a.impact,
    )
    .slice(0, count);
}

function joinSentences(parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

export function buildExecutiveSummary(
  health: HealthScore,
  insights: Insight[],
  kpis: IntelligenceReport["kpis"],
  context: IntelligenceContext,
): ExecutiveSummary {
  const negatives = insights.filter((i) =>
    ["critical", "warning"].includes(i.severity),
  );
  const positives = insights.filter((i) => i.severity === "positive");
  const watches = insights.filter((i) => i.severity === "watch");

  const grade = health.grade;
  const tone =
    grade === "excelente" || grade === "saludable"
      ? "El negocio muestra una posición sólida."
      : grade === "estable"
        ? "El negocio se mantiene estable, con espacio para optimizar."
        : grade === "atención"
          ? "El negocio requiere atención: hay señales que merecen un plan de acción acotado."
          : "El negocio está en una situación crítica que demanda decisiones inmediatas.";

  /* Párrafo 1: situación general. */
  const p1 = joinSentences([
    `Durante ${context.period.label.toLowerCase()}, los ingresos cerraron en ${formatCurrency(
      kpis.revenue,
    )} con margen neto del ${formatPercent(kpis.netMarginPct)}.`,
    kpis.revenuePrev > 0
      ? `Es una variación de ${kpis.revenueDeltaPct >= 0 ? "+" : ""}${kpis.revenueDeltaPct.toFixed(1)} % respecto del período comparativo.`
      : "",
    `${tone} El score de salud del negocio se ubica en ${health.score} / 100 (${grade}).`,
  ]);

  /* Párrafo 2: lo que tracciona / lo que preocupa. */
  const negTitle =
    negatives.length > 0 ? negatives[0].title.toLowerCase() : "";
  const posTitle =
    positives.length > 0 ? positives[0].title.toLowerCase() : "";
  const watchTitle = watches.length > 0 ? watches[0].title.toLowerCase() : "";

  let p2 = "";
  if (negatives.length > 0) {
    p2 += `El punto que demanda mayor atención es: ${negatives[0].summary} `;
  } else if (watches.length > 0) {
    p2 += `Conviene vigilar lo siguiente: ${watches[0].summary} `;
  }
  if (positives.length > 0) {
    p2 += `Del lado positivo, ${positives[0].summary.charAt(0).toLowerCase()}${positives[0].summary.slice(1)} `;
  }
  if (!p2) {
    p2 = "No se detectaron señales destacadas en el período. El negocio se mantiene dentro de parámetros operativos esperables.";
  }

  /* Párrafo 3: lectura ejecutiva. */
  const p3 = joinSentences([
    "Para los próximos 30-60 días la prioridad es consolidar los focos identificados:",
    negTitle ? `resolver "${negTitle}",` : "",
    watchTitle ? `mantener bajo seguimiento "${watchTitle}",` : "",
    posTitle ? `y capitalizar "${posTitle}".` : ".",
  ]).replace(/,\s*\./, ".");

  /* Highlights bullets. */
  const highlights: string[] = [];
  highlights.push(
    `Ingresos ${formatCurrency(kpis.revenue)}; margen neto ${formatPercent(kpis.netMarginPct)}.`,
  );
  if (kpis.expensesPrev > 0) {
    highlights.push(
      `Gastos del período ${formatCurrency(kpis.expenses)} (${kpis.expensesDeltaPct >= 0 ? "+" : ""}${kpis.expensesDeltaPct.toFixed(1)} % vs comparativo).`,
    );
  }
  if (kpis.avgTicket > 0 && kpis.avgTicketPrev > 0) {
    const tDelta =
      kpis.avgTicketPrev > 0
        ? ((kpis.avgTicket - kpis.avgTicketPrev) / kpis.avgTicketPrev) * 100
        : 0;
    highlights.push(
      `Ticket promedio ${formatCurrency(kpis.avgTicket)} (${tDelta >= 0 ? "+" : ""}${tDelta.toFixed(1)} %).`,
    );
  }
  if (negatives.length > 0) highlights.push(`Atención: ${negatives[0].title}.`);
  if (positives.length > 0) highlights.push(`Fortaleza: ${positives[0].title}.`);

  return {
    paragraphs: [p1, p2, p3].filter(Boolean),
    highlights: highlights.slice(0, 5),
  };
}

export function buildRecommendations(insights: Insight[]): Recommendation[] {
  const priorityForSeverity: Record<Insight["severity"], Recommendation["priority"]> = {
    critical: "alta",
    warning: "alta",
    watch: "media",
    info: "baja",
    positive: "baja",
  };
  const recs: Recommendation[] = [];

  // Priorizar insights con recomendación explícita.
  const sorted = pickTopInsights(insights, 50);
  for (const ins of sorted) {
    if (!ins.recommendation) continue;
    recs.push({
      id: `${ins.id}/rec`,
      category: ins.category,
      priority: priorityForSeverity[ins.severity],
      title: ins.recommendation,
      rationale: ins.summary,
      metrics: ins.metrics?.slice(0, 2),
    });
  }

  // Si nada hay, recomendación blanda.
  if (recs.length === 0) {
    recs.push({
      id: "generic/observation",
      category: "operativo",
      priority: "baja",
      title:
        "Mantener el ritmo: monitorear semanalmente ingresos, margen y rotación de stock.",
      rationale:
        "No se detectaron focos críticos en el período analizado.",
    });
  }

  // Limitar a 8 para evitar saturación.
  return recs.slice(0, 8);
}

export function buildExplorationQuestions(
  insights: Insight[],
): ExplorationQuestion[] {
  const out: ExplorationQuestion[] = [
    {
      id: "q/rotation",
      title: "¿Qué productos están drenando capital sin generar retorno?",
      rationale: "Identificar productos sin movimiento ≥ 120 días para definir una estrategia de liquidación.",
      category: "operativo",
    },
    {
      id: "q/margin",
      title: "¿Dónde se está erosionando el margen?",
      rationale: "Cruzar evolución de COGS, gastos y descuentos para localizar la fuga.",
      category: "financiero",
    },
    {
      id: "q/concentration",
      title: "¿Qué tan expuesto está el negocio si falla su producto top?",
      rationale: "Evaluar concentración por producto y diseñar un segundo escalón.",
      category: "riesgo",
    },
    {
      id: "q/sizes",
      title: "¿La curva de talles refleja la demanda real?",
      rationale: "Ajustar próximas compras a la composición de talles efectiva.",
      category: "comercial",
    },
    {
      id: "q/customers",
      title: "¿Cómo se comporta la base de clientes recurrentes?",
      rationale: "Detectar oportunidades de fidelización antes de perder clientes valiosos.",
      category: "comercial",
    },
    {
      id: "q/cashflow",
      title: "¿Qué tan rígida es la estructura de gastos recurrentes?",
      rationale: "Identificar qué porcentaje del gasto mensual es fijo y dónde hay flexibilidad.",
      category: "financiero",
    },
  ];
  // Devolver siempre las preguntas curadas: el motor ya filtra cuáles son
  // relevantes en función de qué insights aparecen.
  void insights;
  return out;
}
