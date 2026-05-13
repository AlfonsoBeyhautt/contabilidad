import type { AppData, ExpenseCategory, Product, ProductFamily } from "./types";
import { buildVariantDisplayName, generateVariantSku } from "./product-display";
import { normalizeProductStockShape } from "./stock-helpers";

const LEGACY_EXPENSE: Record<string, ExpenseCategory> = {
  producción: "producción",
  produccion: "producción",
  marketing: "marketing",
  "envíos": "envíos",
  envios: "envíos",
  otros: "otros",
  alquiler: "otros",
  sueldos: "producción",
  packaging: "producción",
  impuestos: "otros",
  servicios: "otros",
  proveedores: "producción",
  mantenimiento: "otros",
};

export function normalizeExpenseCategory(c: string): ExpenseCategory {
  return LEGACY_EXPENSE[c] ?? "otros";
}

/** Normaliza datos legacy (localStorage / versiones previas) al contrato actual. */
export function migrateAppDataShape(data: AppData): AppData {
  const expenses = data.expenses.map((e) => ({
    ...e,
    category: normalizeExpenseCategory(String(e.category)),
  }));

  const productsRaw = data.products.map((p) => {
    const legacy = p as Product & { color?: string };
    return {
      ...p,
      model: p.model ?? legacy.color ?? "",
      supplier: p.supplier ?? "",
    };
  });

  if (productsRaw.length === 0) {
    return {
      ...data,
      expenses,
      productFamilies: [...(data.productFamilies ?? [])],
      products: [],
      expenseRecurrences: data.expenseRecurrences ?? [],
      defectives: data.defectives ?? [],
      stockMovements: data.stockMovements ?? [],
      scheduledPayments: data.scheduledPayments ?? [],
    };
  }

  const newFams: ProductFamily[] = [...(data.productFamilies ?? [])];
  const famById = new Map(newFams.map((f) => [f.id, f]));

  if (newFams.length === 0 && productsRaw.some((p) => p.familyId)) {
    const seen = new Set<string>();
    for (const p of productsRaw) {
      const fid = p.familyId;
      if (!fid || seen.has(fid)) continue;
      seen.add(fid);
      const fam: ProductFamily = {
        id: fid,
        name: (p.name ?? "").split("·")[0]?.trim() || "Producto",
        category: p.category,
        entryDate:
          (p.entryDate ?? "").slice(0, 10) ||
          new Date().toISOString().slice(0, 10),
      };
      newFams.push(fam);
      famById.set(fid, fam);
    }
  }

  const outProducts: Product[] = [];

  for (const p of productsRaw) {
    let fid = p.familyId;
    if (!fid || !famById.has(fid)) {
      fid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `fam_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const baseName = (p.name ?? "").split("·")[0]?.trim() || p.name || "Producto";
      const fam: ProductFamily = {
        id: fid,
        name: baseName,
        category: p.category,
        entryDate: (p.entryDate ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      };
      newFams.push(fam);
      famById.set(fid, fam);
    }
    const fam = famById.get(fid)!;
    outProducts.push(
      normalizeProductStockShape({
        ...p,
        familyId: fid,
        category: fam.category,
        sku: p.sku?.trim() ? p.sku : generateVariantSku(),
        name: buildVariantDisplayName(fam.name, p.model),
        stockBySize: p.stockBySize ?? {},
      }),
    );
  }

  const uniqueFams = [...new Map(newFams.map((f) => [f.id, f])).values()];
  const expensesNorm = expenses.map((e) => ({
    ...e,
    fromRecurrenceId: e.fromRecurrenceId ?? undefined,
  }));
  return {
    ...data,
    expenses: expensesNorm,
    productFamilies: uniqueFams,
    products: outProducts,
    expenseRecurrences: data.expenseRecurrences ?? [],
    defectives: data.defectives ?? [],
    stockMovements: data.stockMovements ?? [],
    scheduledPayments: data.scheduledPayments ?? [],
  };
}
