import type { Product, SaleLine } from "./types";

/** Clave interna cuando no hay talle explícito (debe coincidir con migración SQL). */
export const STOCK_BUCKET_DEFAULT = "_";

export function normalizeSizeKey(size: string | undefined | null): string {
  const s = (size ?? "").trim();
  return s === "" ? STOCK_BUCKET_DEFAULT : s;
}

export function hasPerSizeStock(p: Product): boolean {
  return Object.keys(p.stockBySize ?? {}).length > 0;
}

export function totalStockFromBySize(stockBySize: Record<string, number>): number {
  return Object.values(stockBySize).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Asegura mapa por talle; si viene vacío, un solo bucket con stock escalar. */
export function normalizeProductStockShape(p: Product): Product {
  let stockBySize = { ...(p.stockBySize ?? {}) };
  if (Object.keys(stockBySize).length === 0) {
    const k = normalizeSizeKey(p.size);
    stockBySize = { [k]: p.stock };
  }
  const stock = totalStockFromBySize(stockBySize);
  return { ...p, stockBySize, stock, size: "" };
}

export function applySaleLineToProduct(p: Product, line: SaleLine): Product {
  const q = line.quantity;
  const k = normalizeSizeKey(line.size);
  const base = normalizeProductStockShape(p);
  const map = { ...base.stockBySize };
  map[k] = Math.max(0, (map[k] ?? 0) - q);
  const stock = totalStockFromBySize(map);
  return { ...base, stockBySize: map, stock };
}

export function revertSaleLineFromProduct(p: Product, line: SaleLine): Product {
  const q = line.quantity;
  const k = normalizeSizeKey(line.size);
  const base = normalizeProductStockShape(p);
  const map = { ...base.stockBySize };
  map[k] = Math.max(0, (map[k] ?? 0) + q);
  const stock = totalStockFromBySize(map);
  return { ...base, stockBySize: map, stock };
}

export function applyPurchaseToProduct(p: Product, qty: number): Product {
  const base = normalizeProductStockShape(p);
  const map = { ...base.stockBySize };
  const k = STOCK_BUCKET_DEFAULT;
  map[k] = (map[k] ?? 0) + qty;
  return { ...base, stockBySize: map, stock: totalStockFromBySize(map) };
}

/** Revierte el ingreso de stock de una compra (mismo bucket que `applyPurchaseToProduct`). */
export function revertPurchaseFromProduct(p: Product, qty: number): Product {
  const base = normalizeProductStockShape(p);
  const map = { ...base.stockBySize };
  const k = STOCK_BUCKET_DEFAULT;
  map[k] = Math.max(0, (map[k] ?? 0) - qty);
  return { ...base, stockBySize: map, stock: totalStockFromBySize(map) };
}

export function adjustStockBySizeKey(
  p: Product,
  sizeKey: string,
  delta: number,
): Product {
  const base = normalizeProductStockShape(p);
  const k = normalizeSizeKey(sizeKey);
  const map = { ...base.stockBySize };
  map[k] = Math.max(0, (map[k] ?? 0) + delta);
  return { ...base, stockBySize: map, stock: totalStockFromBySize(map) };
}

/** Suma por talle a partir de filas de UI (talle vacío → bucket por defecto). */
export function stockMapFromSizeRows(
  rows: Array<{ size: string; stock: number }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = normalizeSizeKey(r.size);
    out[k] = (out[k] ?? 0) + Math.max(0, Number(r.stock) || 0);
  }
  if (Object.keys(out).length === 0) out[STOCK_BUCKET_DEFAULT] = 0;
  return out;
}

export function sizeStockRowsFromProduct(
  p: Product,
): Array<{ size: string; stock: number }> {
  const n = normalizeProductStockShape(p);
  const entries = Object.entries(n.stockBySize);
  if (entries.length === 0) return [{ size: "", stock: n.stock }];
  return entries.map(([k, stock]) => ({
    size: k === STOCK_BUCKET_DEFAULT ? "" : k,
    stock,
  }));
}

export function formatStockBySizeSummary(p: Product): string {
  const n = normalizeProductStockShape(p);
  const parts = Object.entries(n.stockBySize)
    .filter(([, v]) => (Number(v) || 0) > 0)
    .map(([k, v]) => `${k === STOCK_BUCKET_DEFAULT ? "único" : k}: ${v}`);
  return parts.length > 0 ? parts.join(" · ") : `${n.stock} uds`;
}
