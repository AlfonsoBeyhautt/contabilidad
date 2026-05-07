import type { AppData, DefectiveEntry, InventoryPurchase, Sale } from "./types";

/** IDs / filas a sincronizar en Supabase en orden, antes de borrar el producto o la familia. */
export type ProductRemovalMirrorOps = {
  defectiveIds: string[];
  purchaseIds: string[];
  saleDeletes: string[];
  saleReplaces: Sale[];
};

/**
 * Al borrar productos, quita filas relacionadas (defectuosos, compras, líneas de venta)
 * para no dejar datos huérfanos en memoria ni en reportes.
 */
export function cascadeRelationsAfterProductRemoval(
  d: AppData,
  removedProductIds: Set<string>,
): Pick<AppData, "sales" | "purchases" | "defectives"> & {
  mirror: ProductRemovalMirrorOps;
} {
  const defectiveIds: string[] = [];
  const defectives: DefectiveEntry[] = [];
  for (const x of d.defectives ?? []) {
    if (removedProductIds.has(x.productId)) defectiveIds.push(x.id);
    else defectives.push(x);
  }

  const purchaseIds: string[] = [];
  const purchases: InventoryPurchase[] = [];
  for (const p of d.purchases) {
    if (removedProductIds.has(p.productId)) purchaseIds.push(p.id);
    else purchases.push(p);
  }

  const saleDeletes: string[] = [];
  const saleReplaces: Sale[] = [];
  const sales: Sale[] = [];

  for (const sale of d.sales) {
    const keptLines = sale.lines.filter(
      (l) => !removedProductIds.has(l.productId),
    );
    if (keptLines.length === 0) {
      if (sale.lines.length > 0) saleDeletes.push(sale.id);
      continue;
    }
    if (keptLines.length === sale.lines.length) {
      sales.push(sale);
      continue;
    }
    const costSnapshot: Record<string, number> = {};
    for (const l of keptLines) {
      const v = sale.costSnapshot[l.productId];
      if (v !== undefined) costSnapshot[l.productId] = v;
    }
    const nextSale: Sale = {
      ...sale,
      lines: keptLines,
      costSnapshot,
    };
    saleReplaces.push(nextSale);
    sales.push(nextSale);
  }

  return {
    sales,
    purchases,
    defectives,
    mirror: { defectiveIds, purchaseIds, saleDeletes, saleReplaces },
  };
}

/** Referencias a productos que ya no existen en el catálogo (p. ej. datos viejos en caché). */
export function collectMissingProductReferences(d: AppData): Set<string> {
  const catalog = new Set(d.products.map((p) => p.id));
  const missing = new Set<string>();
  for (const x of d.defectives ?? []) {
    if (!catalog.has(x.productId)) missing.add(x.productId);
  }
  for (const p of d.purchases) {
    if (!catalog.has(p.productId)) missing.add(p.productId);
  }
  for (const s of d.sales) {
    for (const l of s.lines) {
      if (!catalog.has(l.productId)) missing.add(l.productId);
    }
  }
  return missing;
}

/** Quita ventas/compras/defectuosos huérfanos sin tocar Supabase (útil tras cargar o migrar). */
export function sanitizeOrphanAppDataRelations(d: AppData): AppData {
  const missing = collectMissingProductReferences(d);
  if (missing.size === 0) return d;
  const { sales, purchases, defectives } =
    cascadeRelationsAfterProductRemoval(d, missing);
  return { ...d, sales, purchases, defectives };
}
