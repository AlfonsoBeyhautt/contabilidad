import type { AppData } from "@/lib/data/types";
import type { DateRange } from "@/lib/data/finance-calcs";
import { formatCurrency } from "@/lib/format";
import type { Insight } from "../types";
import {
  defectiveCostByCategory,
  productRotation,
  stockHealth,
} from "../metrics";

export function detectOperational(
  data: AppData,
  current: DateRange,
): Insight[] {
  const out: Insight[] = [];

  /* 1. Stock inmovilizado / capital locked. */
  const rotation = productRotation(data, 90);
  const dead = rotation.filter((r) => r.status === "muerto");
  const slow = rotation.filter((r) => r.status === "lento" && r.stock > 0);
  const slowLockedCapital = slow.reduce((a, r) => a + r.capitalLocked, 0);
  const deadLockedCapital = dead.reduce((a, r) => a + r.capitalLocked, 0);
  const totalLocked = slowLockedCapital + deadLockedCapital;
  const totalCapitalInStock = rotation.reduce(
    (a, r) => a + r.capitalLocked,
    0,
  );
  const lockedShare =
    totalCapitalInStock > 0 ? totalLocked / totalCapitalInStock : 0;

  if (totalLocked > 0 && (lockedShare >= 0.2 || deadLockedCapital > 0)) {
    out.push({
      id: "ops/locked-capital",
      category: "operativo",
      severity:
        lockedShare >= 0.35 || deadLockedCapital > slowLockedCapital * 1.5
          ? "warning"
          : "watch",
      impact: Math.min(90, Math.round(lockedShare * 120 + 30)),
      title: "Capital atado en stock con baja rotación",
      summary: `Hay ${formatCurrency(totalLocked)} en productos con rotación lenta o nula (${(lockedShare * 100).toFixed(0)} % del stock total).`,
      detail:
        "Estos productos consumen capital de trabajo, espacio físico y atención operativa, sin generar retorno. Conviene priorizar la salida (promociones, bundle, devoluciones a proveedor) antes de que pierdan más valor.",
      metrics: [
        {
          label: "Productos sin movimiento (≥120d)",
          value: String(dead.length),
          tone: "danger",
        },
        {
          label: "Productos con baja rotación",
          value: String(slow.length),
          tone: "warning",
        },
        {
          label: "Capital atado",
          value: formatCurrency(totalLocked),
          tone: "warning",
        },
      ],
      evidence: dead.slice(0, 4).map((d) => ({
        point: `${d.product.name} — ${d.stock} uds, ${
          d.daysSinceLastSale === -1
            ? "nunca se vendió"
            : `${d.daysSinceLastSale} d sin venta`
        }`,
      })),
      recommendation:
        "Definir una política de liquidación para productos que llevan ≥120 días sin movimiento.",
    });
  }

  /* 2. Stock saludable / alertas. */
  const sh = stockHealth(data.products);
  if (sh.totalProducts > 0 && (sh.out > 0 || sh.low > 0)) {
    const sev = sh.out >= 5 ? "warning" : sh.out >= 1 ? "watch" : "info";
    out.push({
      id: "ops/stock-alerts",
      category: "operativo",
      severity: sev,
      impact: Math.min(85, Math.round((sh.out * 7 + sh.low * 3) + 30)),
      title:
        sh.out > 0
          ? `${sh.out} producto${sh.out === 1 ? "" : "s"} agotado${sh.out === 1 ? "" : "s"}`
          : `${sh.low} producto${sh.low === 1 ? "" : "s"} con stock bajo`,
      summary: `Inventario actual: ${sh.out} agotado${sh.out === 1 ? "" : "s"} y ${sh.low} en stock bajo, sobre ${sh.totalProducts} productos.`,
      detail:
        "Los quiebres de stock generan pérdida de venta directa, mientras que el stock crítico aumenta el riesgo de quedar fuera de inventario antes de la reposición. Conviene priorizar reposición en función de la rotación histórica.",
      metrics: [
        {
          label: "Agotados",
          value: String(sh.out),
          tone: "danger",
        },
        {
          label: "Stock bajo",
          value: String(sh.low),
          tone: "warning",
        },
        {
          label: "Productos saludables",
          value: String(sh.healthy),
          tone: "positive",
        },
      ],
      recommendation:
        "Generar orden de reposición priorizando los productos con mejor rotación reciente.",
    });
  }

  /* 3. Defectuosos concentrados en una categoría. */
  const defByCat = defectiveCostByCategory(data, current);
  const totalDefective = defByCat.reduce((a, x) => a + x.loss, 0);
  const worst = defByCat.sort((a, b) => b.loss - a.loss)[0];
  if (totalDefective > 0 && worst && worst.loss / totalDefective >= 0.6) {
    out.push({
      id: "ops/defective-concentration",
      category: "operativo",
      severity: "watch",
      impact: 55,
      title: `Defectuosos concentrados en ${worst.category}`,
      summary: `La categoría ${worst.category} concentra ${((worst.loss / totalDefective) * 100).toFixed(0)} % de la pérdida por defectuosos del período.`,
      detail:
        "Una concentración tan alta sugiere un problema sistémico con un proveedor, un lote o un proceso específico, en lugar de fallas aleatorias. Es un buen punto para reclamar al proveedor o cambiarlo.",
      metrics: [
        {
          label: "Pérdida en " + worst.category,
          value: formatCurrency(worst.loss),
          tone: "warning",
        },
        {
          label: "Unidades dadas de baja",
          value: String(worst.units),
        },
      ],
      recommendation:
        "Auditar el último lote de la categoría afectada y abrir un reclamo formal con el proveedor.",
    });
  }

  /* 4. Productos estrella (operacional, también puede leerse como oportunidad). */
  const stars = rotation.filter((r) => r.status === "estrella");
  if (stars.length > 0) {
    out.push({
      id: "ops/star-products",
      category: "operativo",
      severity: "positive",
      impact: 60,
      title: `${stars.length} producto${stars.length === 1 ? "" : "s"} con rendimiento destacado`,
      summary: `Se identificaron ${stars.length} productos con rotación alta y margen ≥ 35 % en los últimos 90 días.`,
      detail:
        "Estos productos no sólo se venden bien: lo hacen con margen saludable. Conviene asegurarles disponibilidad continua y considerar ampliar la familia.",
      evidence: stars.slice(0, 4).map((s) => ({
        point: `${s.product.name} — ${s.unitsSold} uds vendidas, margen ${s.marginPct.toFixed(1)} %`,
      })),
      recommendation:
        "Asegurar reposición temprana y evaluar ampliar variantes (talles, colores) de los productos estrella.",
    });
  }

  return out;
}
