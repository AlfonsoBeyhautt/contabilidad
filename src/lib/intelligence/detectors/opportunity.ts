import type { AppData } from "@/lib/data/types";
import type { DateRange } from "@/lib/data/finance-calcs";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import {
  categoryMix,
  monthlySeries,
  productRotation,
  slope,
} from "../metrics";

export function detectOpportunities(
  data: AppData,
  current: DateRange,
): Insight[] {
  void current;
  const out: Insight[] = [];

  /* 1. Productos escalables: rotación alta + margen sano + stock no excesivo. */
  const rotation = productRotation(data, 90);
  const scalable = rotation
    .filter(
      (r) =>
        r.unitsSold >= 6 &&
        r.marginPct >= 30 &&
        r.daysOfInventory <= 45 &&
        r.stock > 0,
    )
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  if (scalable.length > 0) {
    out.push({
      id: "opp/scalable-products",
      category: "oportunidad",
      severity: "positive",
      impact: 70,
      title: "Productos con potencial de escala",
      summary: `${scalable.length} productos combinan rotación rápida, margen saludable y stock disponible.`,
      detail:
        "Son candidatos naturales para invertir en stock y promoción: la unidad económica funciona y la demanda existe. Una ampliación cuidadosa puede expandir ingresos sin comprometer margen.",
      evidence: scalable.map((s) => ({
        point: `${s.product.name} — ${s.unitsSold} uds/90d, margen ${formatPercent(s.marginPct)}, ${Math.round(s.daysOfInventory)} días de inventario`,
      })),
      recommendation:
        "Aumentar stock objetivo de estos productos y reservarles slot prioritario en próxima reposición.",
    });
  }

  /* 2. Categoría en aceleración. */
  const months = 6;
  const series6 = monthlySeries(data, months);
  if (series6.length === months) {
    // Sumamos categoryMix por mes — simplificación: usamos slope sobre revenue total.
    // Para categorías individuales necesitaríamos pasar AppData por mes; lo dejamos para futuro.
    const mix = categoryMix(data, {
      start: new Date(`${series6[0].month}-01T00:00:00`),
      end: new Date(),
    });
    const best = [...mix]
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.grossMarginPct - a.grossMarginPct)[0];
    if (best) {
      const revenueSlope = slope(series6.map((s) => s.revenue));
      const avgRev = series6.reduce((a, s) => a + s.revenue, 0) / months;
      const normSlope = avgRev > 0 ? revenueSlope / avgRev : 0;
      if (normSlope >= 0.04) {
        out.push({
          id: "opp/category-momentum",
          category: "oportunidad",
          severity: "positive",
          impact: 60,
          title: `${best.category}: categoría más rentable del semestre`,
          summary: `${best.category} lidera el margen bruto del último semestre con ${formatPercent(best.grossMarginPct)} y facturación de ${formatCurrency(best.revenue)}.`,
          detail:
            "La combinación de mejor margen relativo y momentum positivo de ingresos generales sugiere espacio para ampliar la oferta dentro de esta categoría sin diluir la propuesta.",
          recommendation:
            "Sumar nuevas variantes dentro de la categoría líder y elevarla en la comunicación.",
        });
      }
    }
  }

  /* 3. Stock saludable + ventas creciendo = base para inversión. */
  const totalProducts = data.products.length;
  const stockedOk = data.products.filter((p) => p.stock > p.minStock).length;
  if (totalProducts > 0 && stockedOk / totalProducts >= 0.7) {
    const series = monthlySeries(data, 3);
    if (series.length === 3) {
      const allUp =
        series[1].revenue > series[0].revenue &&
        series[2].revenue > series[1].revenue;
      if (allUp) {
        out.push({
          id: "opp/healthy-base",
          category: "oportunidad",
          severity: "positive",
          impact: 55,
          title: "Base sana con tracción comercial",
          summary:
            "Más del 70 % del catálogo está con stock saludable y los ingresos crecen mes a mes los últimos 3 meses.",
          detail:
            "Es un buen momento para invertir selectivamente: capacidad de venta sostenida y disponibilidad asegurada. Acciones de marketing focalizado tienen alta probabilidad de retorno.",
          recommendation:
            "Reasignar parte del cashflow a marketing focalizado en los productos top de los últimos 90 días.",
        });
      }
    }
  }

  return out;
}
