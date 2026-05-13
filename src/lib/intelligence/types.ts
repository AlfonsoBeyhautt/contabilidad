/**
 * Sistema de Análisis Inteligente del Negocio (BIA).
 *
 * Arquitectura híbrida: motores determinísticos (cálculos, detección de patrones
 * y umbrales empresariales) producen un `IntelligenceReport`. Encima de eso,
 * un módulo de narrativa redacta resúmenes ejecutivos. La capa LLM puede,
 * opcionalmente, reemplazar al generador de narrativa sin tocar la lógica.
 */

import type { ProductCategory } from "@/lib/data/types";

export type InsightCategory =
  | "financiero"
  | "operativo"
  | "comercial"
  | "riesgo"
  | "oportunidad";

export type InsightSeverity =
  | "info" /** Solo informativo. */
  | "positive" /** Buena noticia confirmada. */
  | "watch" /** Vigilar. */
  | "warning" /** Atención: tendencia adversa. */
  | "critical" /** Acción inmediata recomendada. */;

export type InsightMetric = {
  /** Etiqueta legible. */
  label: string;
  /** Valor a mostrar (ya formateado, ej. "$ 1.245.000", "23,4 %"). */
  value: string;
  /** Tono cromático opcional. */
  tone?: "neutral" | "positive" | "warning" | "danger" | "info";
};

export type InsightEvidence = {
  /** Bullet con un dato concreto que respalda el insight. */
  point: string;
};

export type Insight = {
  /** Id estable derivado del detector. */
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  /** Titular corto, máximo ~70 caracteres. */
  title: string;
  /** Resumen ejecutivo, 1 oración densa y profesional. */
  summary: string;
  /** Explicación detallada, 1-2 párrafos cortos. Incluye contexto y causa probable. */
  detail: string;
  /** Métricas tabulares opcionales. */
  metrics?: InsightMetric[];
  /** Evidencia adicional (bullets). */
  evidence?: InsightEvidence[];
  /** Acción concreta recomendada (1 oración). */
  recommendation?: string;
  /** Score 0-100 de impacto estimado (orden de relevancia entre insights). */
  impact: number;
};

export type Recommendation = {
  id: string;
  /** Categoría a la que aporta. */
  category: InsightCategory;
  /** Severidad/Prioridad para ordenar. */
  priority: "alta" | "media" | "baja";
  /** Acción concreta. */
  title: string;
  /** Justificación corta (1 oración). */
  rationale: string;
  /** Métricas asociadas opcionales. */
  metrics?: InsightMetric[];
};

export type HealthSubScore = {
  /** Identificador interno. */
  id:
    | "rentabilidad"
    | "crecimiento"
    | "eficiencia"
    | "stock"
    | "diversificacion"
    | "estabilidad";
  /** Etiqueta legible. */
  label: string;
  /** Puntaje 0-100. */
  score: number;
  /** Una oración explicando el valor. */
  rationale: string;
};

export type HealthScore = {
  /** Score global 0-100. */
  score: number;
  /** Etiqueta cualitativa derivada del score. */
  grade: "excelente" | "saludable" | "estable" | "atención" | "crítico";
  /** Cambio vs período anterior (en puntos). */
  delta: number;
  /** Composición. */
  components: HealthSubScore[];
};

export type ExecutiveSummary = {
  /** Párrafos del informe ejecutivo (renderizar como <p> aparte). */
  paragraphs: string[];
  /** Bullets de "lectura rápida" (3-5). */
  highlights: string[];
};

export type ExplorationQuestion = {
  id: string;
  title: string;
  rationale: string;
  category: InsightCategory;
};

export type CategoryMix = {
  category: ProductCategory;
  revenue: number;
  units: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
};

export type IntelligenceContext = {
  /** Fecha de generación (ISO). */
  generatedAt: string;
  /** Período principal evaluado. */
  period: { start: string; end: string; label: string };
  /** Período de comparación. */
  reference: { start: string; end: string; label: string };
  /** Ventana de "largo plazo" para detectar tendencias (típicamente 6 meses). */
  longRange: { start: string; end: string; label: string };
};

export type IntelligenceReport = {
  context: IntelligenceContext;
  health: HealthScore;
  summary: ExecutiveSummary;
  insights: Insight[];
  recommendations: Recommendation[];
  explorationQuestions: ExplorationQuestion[];
  /** Métricas crudas (transparencia) por categoría. */
  categoryMix: CategoryMix[];
  /** Indicadores básicos del período. */
  kpis: {
    revenue: number;
    revenuePrev: number;
    revenueDeltaPct: number;
    grossProfit: number;
    grossMarginPct: number;
    netProfit: number;
    netMarginPct: number;
    expenses: number;
    expensesPrev: number;
    expensesDeltaPct: number;
    cogsSales: number;
    defectiveLoss: number;
    saleCount: number;
    unitsSold: number;
    avgTicket: number;
    avgTicketPrev: number;
  };
};
