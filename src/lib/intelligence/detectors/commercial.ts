import type { AppData } from "@/lib/data/types";
import {
  filterSalesInRange,
  periodMetrics,
  productByIdMap,
  saleLineRevenue,
  saleTotal,
  type DateRange,
} from "@/lib/data/finance-calcs";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import {
  averageTicket,
  categoryMix,
  concentrationStats,
  customerRevenueWeights,
  pctChange,
  sizeMix,
} from "../metrics";

export function detectCommercial(
  data: AppData,
  current: DateRange,
  reference: DateRange,
): Insight[] {
  const out: Insight[] = [];

  const curSales = filterSalesInRange(data.sales, current);
  const prevSales = filterSalesInRange(data.sales, reference);
  const cur = periodMetrics(data, current);
  const prev = periodMetrics(data, reference);

  /* 1. Concentración por producto. */
  const productWeights = (() => {
    const rev = new Map<string, number>();
    const pmap = productByIdMap(data.products);
    for (const s of curSales) {
      for (const l of s.lines) {
        rev.set(l.productId, (rev.get(l.productId) ?? 0) + saleLineRevenue(l));
      }
    }
    return [...rev.entries()].map(([id, w]) => ({
      id,
      label: pmap.get(id)?.name ?? id,
      weight: w,
    }));
  })();

  const productConc = concentrationStats(productWeights, 3);

  if (cur.revenue > 0 && productConc.topItems.length > 0) {
    const topShare = productConc.topNShare;
    if (topShare >= 0.6) {
      out.push({
        id: "com/product-concentration",
        category: "comercial",
        severity: topShare >= 0.75 ? "warning" : "watch",
        impact: Math.min(90, Math.round(topShare * 100)),
        title: "Ingresos concentrados en pocos productos",
        summary: `Los 3 productos más vendidos generan ${(topShare * 100).toFixed(0)} % de los ingresos del período.`,
        detail:
          "Una concentración alta es positiva en eficiencia, pero peligrosa frente a quiebres de stock o caída de demanda de esos productos. Conviene fortalecer un segundo escalón de productos que puedan absorber la rotación si algo falla.",
        metrics: [
          {
            label: "Share top 3",
            value: `${(topShare * 100).toFixed(0)} %`,
            tone: "warning",
          },
          ...productConc.topItems.map((it, i) => ({
            label: `${i + 1}. ${it.label}`,
            value: `${(it.share * 100).toFixed(0)} % · ${formatCurrency(it.value)}`,
            tone: "info" as const,
          })),
        ],
        recommendation:
          "Diversificar la oferta promoviendo productos del segundo escalón con buen margen.",
      });
    }
  }

  /* 2. Ticket promedio. */
  const ticketCur = averageTicket(curSales);
  const ticketPrev = averageTicket(prevSales);
  if (ticketCur > 0 && ticketPrev > 0) {
    const tDelta = pctChange(ticketCur, ticketPrev);
    if (Math.abs(tDelta) >= 8) {
      out.push({
        id: "com/avg-ticket",
        category: "comercial",
        severity: tDelta < 0 ? "watch" : "positive",
        impact: 55,
        title:
          tDelta < 0
            ? "Ticket promedio en caída"
            : "Ticket promedio en aumento",
        summary: `El ticket promedio pasó de ${formatCurrency(ticketPrev)} a ${formatCurrency(ticketCur)} (${tDelta >= 0 ? "+" : ""}${tDelta.toFixed(1)} %).`,
        detail:
          tDelta < 0
            ? "Aunque haya más operaciones, cada venta aporta menos. Esto puede deberse a descuentos más agresivos, productos de menor precio dominando el mix o una caída en unidades por venta."
            : "Cada venta aporta más. Puede provenir de productos premium ganando share, bundles efectivos o mejoras en la conversión a productos de mayor precio.",
        metrics: [
          {
            label: "Ticket actual",
            value: formatCurrency(ticketCur),
            tone: tDelta < 0 ? "warning" : "positive",
          },
          {
            label: "Variación",
            value: `${tDelta >= 0 ? "+" : ""}${tDelta.toFixed(1)} %`,
            tone: tDelta < 0 ? "warning" : "positive",
          },
        ],
        recommendation:
          tDelta < 0
            ? "Revisar política de descuentos y trabajar bundles o cross-selling para subir el ticket."
            : "Capitalizar el momentum del ticket: cuidar disponibilidad de productos premium.",
      });
    }
  }

  /* 3. Volumen vs. ticket (interpretación combinada). */
  if (cur.revenue > 0 && prev.revenue > 0) {
    const revDelta = pctChange(cur.revenue, prev.revenue);
    const unitsDelta = pctChange(cur.unitsSold, prev.unitsSold);
    if (revDelta > 5 && unitsDelta < -5) {
      out.push({
        id: "com/revenue-up-units-down",
        category: "comercial",
        severity: "watch",
        impact: 65,
        title: "Crecimiento de ingresos con menos unidades",
        summary: `Los ingresos crecieron ${revDelta.toFixed(1)} % pero las unidades cayeron ${unitsDelta.toFixed(1)} %.`,
        detail:
          "El crecimiento se está apoyando en precios o mix, no en volumen. Si la elasticidad de demanda es baja puede sostenerse, pero conviene monitorear el funnel para no perder clientes.",
        recommendation:
          "Revisar la elasticidad por categoría: subas con poca pérdida de unidades son señal de pricing power.",
      });
    } else if (revDelta < -5 && unitsDelta > 5) {
      out.push({
        id: "com/units-up-revenue-down",
        category: "comercial",
        severity: "watch",
        impact: 65,
        title: "Más unidades pero menos ingresos",
        summary: `Se vendieron ${unitsDelta.toFixed(1)} % más unidades pero la facturación bajó ${revDelta.toFixed(1)} %.`,
        detail:
          "Más operaciones a precios menores. Si fue producto de promociones puntuales puede ser sano para liquidar inventario, pero como tendencia indica deterioro del valor capturado por unidad.",
        recommendation:
          "Acotar descuentos generalizados, sostener volumen con productos clave a precio pleno.",
      });
    }
  }

  /* 4. Mix por categoría. */
  const mix = categoryMix(data, current);
  const totalRev = mix.reduce((a, c) => a + c.revenue, 0);
  if (totalRev > 0) {
    const sortedByMargin = mix
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.grossMarginPct - a.grossMarginPct);
    const best = sortedByMargin[0];
    const worst = sortedByMargin[sortedByMargin.length - 1];
    if (best && worst && best !== worst && best.grossMarginPct - worst.grossMarginPct >= 15) {
      out.push({
        id: "com/category-margin-gap",
        category: "comercial",
        severity: "info",
        impact: 50,
        title: "Brecha de margen entre categorías",
        summary: `La categoría ${best.category} aporta margen bruto del ${formatPercent(best.grossMarginPct)} mientras ${worst.category} apenas alcanza ${formatPercent(worst.grossMarginPct)}.`,
        detail:
          "Es una pista clara de dónde está la rentabilidad real. Cuando una categoría tiene margen claramente superior, conviene reforzar su presencia comercial sin sacrificar el catálogo total.",
        metrics: [
          {
            label: `${best.category}`,
            value: `${formatPercent(best.grossMarginPct)} · ${formatCurrency(best.revenue)}`,
            tone: "positive",
          },
          {
            label: `${worst.category}`,
            value: `${formatPercent(worst.grossMarginPct)} · ${formatCurrency(worst.revenue)}`,
            tone: "warning",
          },
        ],
        recommendation:
          "Empujar comercialmente la categoría con mejor margen y revisar pricing de las de menor margen.",
      });
    }
  }

  /* 5. Mix de talles. */
  const szMix = sizeMix(data, current);
  if (szMix.length >= 3) {
    const top = szMix[0];
    if (top.share >= 0.45) {
      out.push({
        id: "com/size-skew",
        category: "comercial",
        severity: "info",
        impact: 40,
        title: `Demanda concentrada en talle ${top.size}`,
        summary: `El talle ${top.size} concentra ${(top.share * 100).toFixed(0)} % de las unidades vendidas.`,
        detail:
          "Útil para ajustar la curva de talles en próximas compras. Una concentración alta evita sobrestock de talles con baja demanda y reduce capital atado.",
        recommendation:
          "Ajustar la curva de compra inclinándola hacia los talles que efectivamente rotan.",
      });
    }
  }

  /* 6. Concentración por cliente. */
  const customerWeights = customerRevenueWeights(data, current);
  if (customerWeights.length >= 2) {
    const conc = concentrationStats(customerWeights, 3);
    if (conc.topNShare >= 0.6) {
      out.push({
        id: "com/customer-concentration",
        category: "comercial",
        severity: conc.topNShare >= 0.75 ? "warning" : "watch",
        impact: Math.min(85, Math.round(conc.topNShare * 90)),
        title: "Dependencia comercial de pocos clientes",
        summary: `Los 3 mejores clientes aportan ${(conc.topNShare * 100).toFixed(0)} % de la facturación del período.`,
        detail:
          "Una concentración alta hace al negocio frágil ante la pérdida de cualquiera de estos clientes. Diversificar la base es una protección estructural.",
        metrics: conc.topItems.map((it, i) => ({
          label: `${i + 1}. ${it.label}`,
          value: `${(it.share * 100).toFixed(0)} % · ${formatCurrency(it.value)}`,
          tone: "info" as const,
        })),
        recommendation:
          "Diseñar acciones específicas de captación para sumar 3-5 clientes nuevos relevantes.",
      });
    }
  }

  return out;
}
