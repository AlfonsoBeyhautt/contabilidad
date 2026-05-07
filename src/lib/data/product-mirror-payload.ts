import type { Product } from "./types";

/** Campos a persistir en Supabase tras mutar un producto en cliente. */
export function productFullPatch(p: Product): Partial<Product> {
  return {
    name: p.name,
    sku: p.sku,
    category: p.category,
    size: p.size,
    model: p.model,
    supplier: p.supplier,
    purchaseCost: p.purchaseCost,
    salePrice: p.salePrice,
    stock: p.stock,
    minStock: p.minStock,
    entryDate: p.entryDate,
    stockBySize: p.stockBySize,
  };
}
