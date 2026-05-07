import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyAppData } from "@/lib/data/empty-app-data";
import {
  readAppDataFromLocalStorage,
  removeLegacyAppDataStorageKey,
} from "@/lib/data/local-storage-app-data";
import {
  sanitizeOrphanAppDataRelations,
  type ProductRemovalMirrorOps,
} from "@/lib/data/product-removal-cascade";
import type {
  AppData,
  AppSettings,
  Customer,
  DefectiveEntry,
  Expense,
  ExpenseRecurrence,
  InventoryPurchase,
  Product,
  ProductFamily,
  Sale,
} from "@/lib/data/types";
import {
  deleteCustomerFromSupabase,
  deleteDefectiveEntryFromSupabase,
  deleteExpenseFromSupabase,
  deleteExpenseRecurrenceFromSupabase,
  deletePurchaseFromSupabase,
  deleteProductFamilyFromSupabase,
  deleteProductFromSupabase,
  deleteSaleFromSupabase,
  fetchFullAppDataFromSupabase,
  insertCustomerToSupabase,
  insertDefectiveEntryToSupabase,
  insertExpenseRecurrenceToSupabase,
  insertExpenseToSupabase,
  insertProductFamilyAndProductsToSupabase,
  insertProductToSupabase,
  insertPurchaseWithOneItemToSupabase,
  insertSaleWithItemsToSupabase,
  patchCustomerInSupabase,
  patchExpenseInSupabase,
  patchPurchaseInSupabase,
  patchExpenseRecurrenceInSupabase,
  patchProductFamilyInSupabase,
  patchProductInSupabase,
  replaceSaleInSupabase,
  setProductStockInSupabase,
  upsertSingletonSettingsToSupabase,
} from "@/lib/supabase/app-data-supabase";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Carga inicial: Supabase si hay proyecto configurado (incluso dataset vacío).
 * Fallo de red/RLS → localStorage como respaldo.
 *
 * Mutaciones: cada `mirror*` escribe en Postgres (ventas, productos, stock, etc.).
 * El DataProvider mantiene el estado en React; localStorage con Supabase activo
 * solo guarda copias de respaldo periódicas (ver `DataProvider`).
 */
export async function loadInitialAppData(): Promise<AppData> {
  removeLegacyAppDataStorageKey();

  const fromLs = readAppDataFromLocalStorage();
  const offlineFallback = sanitizeOrphanAppDataRelations(
    fromLs ?? emptyAppData(),
  );

  if (!isSupabaseConfigured()) return offlineFallback;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return offlineFallback;
  try {
    const remote = await fetchFullAppDataFromSupabase(supabase);
    return sanitizeOrphanAppDataRelations(remote);
  } catch {
    /* timeout, RLS, tablas sin crear, etc. */
  }
  return offlineFallback;
}

export const APP_DATA_PERSIST_ERROR_EVENT = "app-data-persist-error";

function emitPersistError(label: string, message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(APP_DATA_PERSIST_ERROR_EVENT, {
      detail: { label, message },
    }),
  );
}

function isBenignMirrorError(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("duplicate key")) return true;
  if (m.includes("unique constraint")) return true;
  if (m.includes("23505")) return true;
  return false;
}

async function runMirror(
  label: string,
  fn: (client: SupabaseClient) => Promise<{ error: Error | null }>,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !isSupabaseConfigured()) return;
  try {
    const { error } = await fn(supabase);
    if (error) {
      console.warn(`[supabase mirror:${label}]`, error.message);
      if (!isBenignMirrorError(error.message)) {
        emitPersistError(label, error.message);
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[supabase mirror:${label}]`, e);
    if (!isBenignMirrorError(message)) {
      emitPersistError(label, message);
    }
  }
}

export function mirrorSaleAsync(sale: Sale): void {
  queueMicrotask(() =>
    void runMirror("sale", (c) => insertSaleWithItemsToSupabase(c, sale)),
  );
}

export function mirrorSaleReplaceAsync(sale: Sale): void {
  queueMicrotask(() =>
    void runMirror("sale_replace", (c) => replaceSaleInSupabase(c, sale)),
  );
}

export function mirrorSaleDeleteAsync(saleId: string): void {
  queueMicrotask(() =>
    void runMirror("sale_delete", (c) => deleteSaleFromSupabase(c, saleId)),
  );
}

export function mirrorProductInsertAsync(product: Product): void {
  queueMicrotask(() =>
    void runMirror("product_insert", (c) => insertProductToSupabase(c, product)),
  );
}

export function mirrorProductFamilyWithVariantsAsync(
  family: ProductFamily,
  variants: Product[],
): void {
  queueMicrotask(() =>
    void runMirror("product_family_insert", (c) =>
      insertProductFamilyAndProductsToSupabase(c, family, variants),
    ),
  );
}

export function mirrorProductFamilyPatchAsync(
  familyId: string,
  patch: Partial<Pick<ProductFamily, "name" | "category" | "entryDate">>,
): void {
  queueMicrotask(() =>
    void runMirror("product_family_patch", (c) =>
      patchProductFamilyInSupabase(c, familyId, patch),
    ),
  );
}

export function mirrorProductFamilyDeleteAsync(familyId: string): void {
  queueMicrotask(() =>
    void runMirror("product_family_delete", (c) =>
      deleteProductFamilyFromSupabase(c, familyId),
    ),
  );
}

export function mirrorProductPatchAsync(
  id: string,
  patch: Partial<Product>,
): void {
  queueMicrotask(() =>
    void runMirror("product_patch", (c) => patchProductInSupabase(c, id, patch)),
  );
}

export function mirrorProductDeleteAsync(id: string): void {
  queueMicrotask(() =>
    void runMirror("product_delete", (c) => deleteProductFromSupabase(c, id)),
  );
}

/**
 * Borra en Postgres defectuosos, compras y ventas afectadas antes del producto/familia,
 * para respetar FK ON DELETE RESTRICT en `defective_entries`, `sale_items` y `purchase_items`.
 */
export function mirrorAfterProductRemovalAsync(
  ops: ProductRemovalMirrorOps,
  final:
    | { kind: "product"; productId: string }
    | { kind: "family"; familyId: string },
): void {
  queueMicrotask(() =>
    void runMirror("product_removal_cascade", async (c) => {
      for (const id of ops.defectiveIds) {
        const { error } = await deleteDefectiveEntryFromSupabase(c, id);
        if (error) return { error };
      }
      for (const id of ops.purchaseIds) {
        const { error } = await deletePurchaseFromSupabase(c, id);
        if (error) return { error };
      }
      for (const id of ops.saleDeletes) {
        const { error } = await deleteSaleFromSupabase(c, id);
        if (error) return { error };
      }
      for (const s of ops.saleReplaces) {
        const { error } = await replaceSaleInSupabase(c, s);
        if (error) return { error };
      }
      if (final.kind === "product") {
        return deleteProductFromSupabase(c, final.productId);
      }
      return deleteProductFamilyFromSupabase(c, final.familyId);
    }),
  );
}

export function mirrorProductStockAsync(
  productId: string,
  stock: number,
): void {
  queueMicrotask(() =>
    void runMirror("product_stock", (c) =>
      setProductStockInSupabase(c, productId, stock),
    ),
  );
}

export function mirrorExpenseAsync(expense: Expense): void {
  queueMicrotask(() =>
    void runMirror("expense", (c) => insertExpenseToSupabase(c, expense)),
  );
}

export function mirrorExpensePatchAsync(expense: Expense): void {
  queueMicrotask(() =>
    void runMirror("expense_patch", (c) => patchExpenseInSupabase(c, expense)),
  );
}

export function mirrorExpenseDeleteAsync(id: string): void {
  queueMicrotask(() =>
    void runMirror("expense_delete", (c) => deleteExpenseFromSupabase(c, id)),
  );
}

export function mirrorDefectiveInsertAsync(row: DefectiveEntry): void {
  queueMicrotask(() =>
    void runMirror("defective_insert", (c) =>
      insertDefectiveEntryToSupabase(c, row),
    ),
  );
}

export function mirrorDefectiveDeleteAsync(id: string): void {
  queueMicrotask(() =>
    void runMirror("defective_delete", (c) =>
      deleteDefectiveEntryFromSupabase(c, id),
    ),
  );
}

export function mirrorExpenseRecurrenceInsertAsync(
  r: ExpenseRecurrence,
): void {
  queueMicrotask(() =>
    void runMirror("recurrence_insert", (c) =>
      insertExpenseRecurrenceToSupabase(c, r),
    ),
  );
}

export function mirrorExpenseRecurrencePatchAsync(
  id: string,
  patch: Partial<ExpenseRecurrence>,
): void {
  queueMicrotask(() =>
    void runMirror("recurrence_patch", (c) =>
      patchExpenseRecurrenceInSupabase(c, id, patch),
    ),
  );
}

export function mirrorExpenseRecurrenceDeleteAsync(id: string): void {
  queueMicrotask(() =>
    void runMirror("recurrence_delete", (c) =>
      deleteExpenseRecurrenceFromSupabase(c, id),
    ),
  );
}

export function mirrorCustomerInsertAsync(customer: Customer): void {
  queueMicrotask(() =>
    void runMirror("customer_insert", (c) =>
      insertCustomerToSupabase(c, customer),
    ),
  );
}

export function mirrorCustomerPatchAsync(
  id: string,
  patch: Partial<Customer>,
): void {
  queueMicrotask(() =>
    void runMirror("customer_patch", (c) =>
      patchCustomerInSupabase(c, id, patch),
    ),
  );
}

export function mirrorCustomerDeleteAsync(id: string): void {
  queueMicrotask(() =>
    void runMirror("customer_delete", (c) =>
      deleteCustomerFromSupabase(c, id),
    ),
  );
}

export function mirrorPurchaseAsync(purchase: InventoryPurchase): void {
  queueMicrotask(() =>
    void runMirror("purchase", (c) =>
      insertPurchaseWithOneItemToSupabase(c, purchase),
    ),
  );
}

export function mirrorPurchasePatchAsync(purchase: InventoryPurchase): void {
  queueMicrotask(() =>
    void runMirror("purchase_patch", (c) =>
      patchPurchaseInSupabase(c, purchase),
    ),
  );
}

export function mirrorPurchaseDeleteAsync(purchaseId: string): void {
  queueMicrotask(() =>
    void runMirror("purchase_delete", (c) =>
      deletePurchaseFromSupabase(c, purchaseId),
    ),
  );
}

export function mirrorSettingsAsync(settings: AppSettings): void {
  queueMicrotask(() =>
    void runMirror("settings", (c) =>
      upsertSingletonSettingsToSupabase(c, settings),
    ),
  );
}
