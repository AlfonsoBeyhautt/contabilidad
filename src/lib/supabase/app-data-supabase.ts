import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateAppDataShape, normalizeExpenseCategory } from "@/lib/data/app-data-migrate";
import { buildVariantDisplayName } from "@/lib/data/product-display";
import { normalizeProductStockShape } from "@/lib/data/stock-helpers";
import type {
  AppData,
  AppSettings,
  Customer,
  DefectiveEntry,
  DefectiveReason,
  Expense,
  ExpenseKind,
  ExpenseRecurrence,
  InventoryPurchase,
  PaymentMethod,
  Product,
  ProductCategory,
  ProductFamily,
  RecurrenceFrequency,
  Sale,
  SaleLine,
} from "@/lib/data/types";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Filas “cabecera” (venta, compra, etc.): si el id local no es UUID, se genera uno nuevo.
 * Relaciones FK deben usar `requireUuid` para no inventar un producto fantasma.
 */
export function coerceRowId(existing: string | undefined | null): string {
  if (existing && UUID_REGEX.test(existing)) return existing;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  throw new Error("crypto.randomUUID no disponible");
}

export function requireUuid(id: string, fieldLabel: string): string {
  if (!UUID_REGEX.test(id)) {
    throw new Error(
      `Para escribir en Supabase ${fieldLabel} debe ser UUID (recibido: ${id}). Tras migrar datos desde localStorage, asigná UUID reales.`,
    );
  }
  return id;
}

type ProductRow = {
  id: string;
  family_id: string;
  sku: string;
  name: string;
  category: string;
  size: string;
  model?: string;
  color?: string;
  supplier: string;
  purchase_cost: string | number;
  sale_price: string | number;
  stock: number;
  min_stock: number;
  entry_date: string;
  stock_by_size?: Record<string, unknown> | null;
};

type ProductFamilyRow = {
  id: string;
  name: string;
  category: string;
  entry_date: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  registered_at: string;
  notes?: string | null;
};

type SaleItemRow = {
  product_id: string;
  size?: string | null;
  quantity: number;
  unit_price: string | number;
  discount: string | number;
  unit_cost_at_sale: string | number;
};

type SaleRow = {
  id: string;
  sold_at: string;
  customer_id: string | null;
  payment_method: string;
  sale_items: SaleItemRow[] | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: string | number;
  payment_method: string;
  kind: string;
  receipt_note: string | null;
  from_recurrence_id?: string | null;
};

type DefectiveRow = {
  id: string;
  product_id: string;
  unit_cost: string | number;
  quantity: number;
  reason: string;
  recorded_at: string;
};

type RecurrenceRow = {
  id: string;
  description: string;
  amount: string | number;
  category: string;
  payment_method: string;
  kind: string;
  frequency: string;
  start_date: string;
  next_run_at: string;
  end_date: string | null;
  paused: boolean;
};

type PurchaseRow = {
  id: string;
  purchased_at: string;
  supplier: string;
  notes?: string | null;
};

type PurchaseItemRow = {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: string | number;
};

type SettingsRow = {
  id: number;
  shop_name: string;
  currency: string;
  low_stock_alerts: boolean;
};

function num(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

function mapFamilyRow(r: ProductFamilyRow): ProductFamily {
  return {
    id: r.id,
    name: r.name,
    category: r.category as ProductCategory,
    entryDate: r.entry_date,
  };
}

function parseStockBySize(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

function mapProduct(
  r: ProductRow,
  familyById: Map<string, ProductFamily>,
): Product {
  const fam = r.family_id ? familyById.get(r.family_id) : undefined;
  const model = (r.model ?? r.color ?? "").trim();
  const fname =
    fam?.name ?? ((r.name ?? "").split("·")[0]?.trim() || r.name);
  const stockBySize = parseStockBySize(r.stock_by_size);
  const base: Product = {
    id: r.id,
    familyId: r.family_id,
    sku: r.sku,
    name: buildVariantDisplayName(fname, model),
    category: (fam?.category ?? r.category) as ProductCategory,
    size: "",
    model,
    supplier: r.supplier ?? "",
    purchaseCost: num(r.purchase_cost),
    salePrice: num(r.sale_price),
    stock: r.stock,
    minStock: r.min_stock,
    entryDate: r.entry_date,
    stockBySize,
  };
  return normalizeProductStockShape(base);
}

function mapCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    email: r.email ?? "",
    registeredAt: r.registered_at,
    notes: r.notes?.trim() ? r.notes : undefined,
  };
}

function mapExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    date: r.expense_date,
    category: normalizeExpenseCategory(r.category),
    description: r.description,
    amount: num(r.amount),
    paymentMethod: r.payment_method as PaymentMethod,
    receiptNote: r.receipt_note ?? undefined,
    kind: r.kind as ExpenseKind,
    fromRecurrenceId: r.from_recurrence_id ?? undefined,
  };
}

function mapDefectiveRow(r: DefectiveRow): DefectiveEntry {
  return {
    id: r.id,
    productId: r.product_id,
    unitCost: num(r.unit_cost),
    quantity: r.quantity,
    reason: r.reason as DefectiveReason,
    recordedAt: r.recorded_at,
  };
}

function mapRecurrenceRow(r: RecurrenceRow): ExpenseRecurrence {
  return {
    id: r.id,
    description: r.description ?? "",
    amount: num(r.amount),
    category: normalizeExpenseCategory(r.category),
    paymentMethod: r.payment_method as PaymentMethod,
    kind: r.kind as ExpenseKind,
    frequency: r.frequency as RecurrenceFrequency,
    startDate: r.start_date.slice(0, 10),
    nextRunAt: r.next_run_at.slice(0, 10),
    endDate: r.end_date ? r.end_date.slice(0, 10) : undefined,
    paused: r.paused,
  };
}

/** Lee todas las tablas públicas y arma un `AppData` equivalente al estado local actual. */
export async function fetchFullAppDataFromSupabase(
  supabase: SupabaseClient,
): Promise<AppData> {
  const results = await Promise.allSettled([
    supabase.from("product_families").select("*").order("name"),
    supabase.from("products").select("*").order("stock", { ascending: true }),
    supabase.from("customers").select("*").order("name"),
    supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false }),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("sales").select(`
        id,
        sold_at,
        customer_id,
        payment_method,
        sale_items (
          product_id,
          size,
          quantity,
          unit_price,
          discount,
          unit_cost_at_sale
        )
      `).order("sold_at", { ascending: true }),
    supabase.from("purchases").select("*"),
    supabase.from("purchase_items").select("*"),
    supabase
      .from("defective_entries")
      .select("*")
      .order("recorded_at", { ascending: false }),
    supabase.from("expense_recurrences").select("*").order("next_run_at"),
  ]);

  function pickData<T>(
    index: number,
    label: string,
    fallback: T,
    required = false,
  ): T {
    const settled = results[index];
    if (settled.status === "rejected") {
      const reason =
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason);
      if (required) {
        throw new Error(`Supabase query failed (${label}): ${reason}`);
      }
      console.error(`[supabase-load] ${label} failed`, reason);
      return fallback;
    }
    if (settled.value.error) {
      const reason = settled.value.error.message;
      if (required) {
        throw new Error(`Supabase query failed (${label}): ${reason}`);
      }
      console.error(`[supabase-load] ${label} failed`, reason);
      return fallback;
    }
    return (settled.value.data as T) ?? fallback;
  }

  // Tablas base requeridas para evitar estado "vacío local" cuando Supabase sí existe.
  const famRows = pickData<ProductFamilyRow[]>(0, "product_families", []);
  const prodRows = pickData<ProductRow[]>(1, "products", [], true);
  const custRows = pickData<CustomerRow[]>(2, "customers", []);
  const expenseRows = pickData<ExpenseRow[]>(3, "expenses", []);
  const settRow = pickData<SettingsRow | null>(4, "settings", null);
  const salesRows = pickData<SaleRow[]>(5, "sales", []);
  const pchRows = pickData<PurchaseRow[]>(6, "purchases", []);
  const pitemRows = pickData<PurchaseItemRow[]>(7, "purchase_items", []);
  const defRows = pickData<DefectiveRow[]>(8, "defective_entries", []);
  const recRows = pickData<RecurrenceRow[]>(9, "expense_recurrences", []);

  const productFamilies = famRows.map(mapFamilyRow);
  const familyById = new Map(productFamilies.map((f) => [f.id, f]));
  const purchaseById = new Map(
    pchRows.map((p) => [p.id, p]),
  );

  const purchases: InventoryPurchase[] = pitemRows.map(
    (it) => {
      const hdr = purchaseById.get(it.purchase_id);
      return {
        id: it.purchase_id,
        date: hdr?.purchased_at ?? new Date().toISOString(),
        supplier: hdr?.supplier ?? "",
        notes: hdr?.notes?.trim() ? hdr.notes : undefined,
        productId: it.product_id,
        quantity: it.quantity,
        unitCost: num(it.unit_cost),
      };
    },
  );

  const salesMapped: Sale[] = salesRows.map((s) => {
    const items = s.sale_items ?? [];
    const lines: SaleLine[] = items.map((it) => ({
      productId: it.product_id,
      size: (it.size ?? "").trim() || undefined,
      quantity: it.quantity,
      unitPrice: num(it.unit_price),
      discount: num(it.discount),
    }));
    const costSnapshot: Record<string, number> = {};
    for (const it of items) {
      costSnapshot[it.product_id] = num(it.unit_cost_at_sale);
    }
    return {
      id: s.id,
      date: s.sold_at,
      customerId: s.customer_id,
      paymentMethod: s.payment_method as PaymentMethod,
      lines,
      costSnapshot,
    };
  });

  const srow = settRow as SettingsRow | null;
  const settings: AppSettings = srow
    ? {
        shopName: srow.shop_name,
        currency: srow.currency,
        lowStockAlerts: srow.low_stock_alerts,
      }
    : {
        shopName: "",
        currency: "ARS",
        lowStockAlerts: true,
      };

  const products = prodRows.map((r) => mapProduct(r, familyById));

  const defectives = defRows.map(mapDefectiveRow);
  const expenseRecurrences = recRows.map(
    mapRecurrenceRow,
  );

  return migrateAppDataShape({
    productFamilies,
    products,
    customers: custRows.map(mapCustomer),
    expenses: expenseRows.map(mapExpense),
    purchases,
    sales: salesMapped,
    defectives,
    expenseRecurrences,
    settings,
  });
}

/** Actualiza la fila singleton de configuración */
export async function upsertSingletonSettingsToSupabase(
  supabase: SupabaseClient,
  s: AppSettings,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("settings").upsert(
    {
      id: 1,
      shop_name: s.shopName,
      currency: s.currency,
      low_stock_alerts: s.lowStockAlerts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  return { error: error ? new Error(error.message) : null };
}

/** Inserta un producto; no actualiza una fila existente por id. */
export async function insertProductToSupabase(
  supabase: SupabaseClient,
  p: Product,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(p.id)) {
    return { error: new Error(`product id no es UUID: ${p.id}`) };
  }
  const payload = {
    id: p.id,
    family_id: requireUuid(p.familyId, "familyId"),
    sku: p.sku,
    name: p.name,
    category: p.category,
    size: p.size ?? "",
    model: p.model,
    supplier: p.supplier ?? "",
    purchase_cost: p.purchaseCost,
    sale_price: p.salePrice,
    stock: p.stock,
    min_stock: p.minStock,
    entry_date: p.entryDate.slice(0, 10),
    stock_by_size: p.stockBySize ?? {},
  };
  const { error } = await supabase.from("products").insert(payload);
  return { error: error ? new Error(error.message) : null };
}

/** Inserta una venta y sus líneas; el stock lo aplica el cliente y se replica con patch de producto. */
export async function insertSaleWithItemsToSupabase(
  supabase: SupabaseClient,
  sale: Sale,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(sale.id)) {
    return { error: new Error(`sale id no es UUID: ${sale.id}`) };
  }
  for (const l of sale.lines) {
    if (!UUID_REGEX.test(l.productId)) {
      return {
        error: new Error(`productId no es UUID, no se replica la venta: ${l.productId}`),
      };
    }
  }

  const saleId = sale.id;
  const customerId =
    sale.customerId && UUID_REGEX.test(sale.customerId)
      ? sale.customerId
      : null;

  const { error: e1 } = await supabase.from("sales").insert({
    id: saleId,
    sold_at: sale.date,
    customer_id: customerId,
    payment_method: sale.paymentMethod,
  });
  if (e1) return { error: new Error(e1.message) };

  const itemRows = sale.lines.map((l) => ({
    sale_id: saleId,
    product_id: l.productId,
    size: (l.size ?? "").trim(),
    quantity: l.quantity,
    unit_price: l.unitPrice,
    discount: l.discount,
    unit_cost_at_sale: sale.costSnapshot[l.productId] ?? 0,
  }));

  const { error: e2 } = await supabase.from("sale_items").insert(itemRows);
  if (e2) return { error: new Error(e2.message) };
  return { error: null };
}

export async function replaceSaleInSupabase(
  supabase: SupabaseClient,
  sale: Sale,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(sale.id)) {
    return { error: new Error(`sale id no es UUID: ${sale.id}`) };
  }
  for (const l of sale.lines) {
    if (!UUID_REGEX.test(l.productId)) {
      return {
        error: new Error(`productId no es UUID, no se replica la venta: ${l.productId}`),
      };
    }
  }
  const customerId =
    sale.customerId && UUID_REGEX.test(sale.customerId)
      ? sale.customerId
      : null;

  const { error: e0 } = await supabase
    .from("sales")
    .update({
      sold_at: sale.date,
      customer_id: customerId,
      payment_method: sale.paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sale.id);
  if (e0) return { error: new Error(e0.message) };

  const { error: e1 } = await supabase
    .from("sale_items")
    .delete()
    .eq("sale_id", sale.id);
  if (e1) return { error: new Error(e1.message) };

  const itemRows = sale.lines.map((l) => ({
    sale_id: sale.id,
    product_id: l.productId,
    size: (l.size ?? "").trim(),
    quantity: l.quantity,
    unit_price: l.unitPrice,
    discount: l.discount,
    unit_cost_at_sale: sale.costSnapshot[l.productId] ?? 0,
  }));
  const { error: e2 } = await supabase.from("sale_items").insert(itemRows);
  if (e2) return { error: new Error(e2.message) };
  return { error: null };
}

export async function deleteSaleFromSupabase(
  supabase: SupabaseClient,
  saleId: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(saleId)) return { error: null };
  const { error } = await supabase.from("sales").delete().eq("id", saleId);
  return { error: error ? new Error(error.message) : null };
}

/** Una compra con una sola línea (equivale al modelo actual de `InventoryPurchase`). */
export async function insertPurchaseWithOneItemToSupabase(
  supabase: SupabaseClient,
  p: InventoryPurchase,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(p.id)) {
    return { error: new Error(`purchase id no es UUID: ${p.id}`) };
  }
  if (!UUID_REGEX.test(p.productId)) {
    return {
      error: new Error(`productId no es UUID, no se replica la compra: ${p.productId}`),
    };
  }

  const headerId = p.id;
  const productId = p.productId;

  const { error: e1 } = await supabase.from("purchases").insert({
    id: headerId,
    purchased_at: p.date,
    supplier: p.supplier,
    notes: p.notes?.trim() ? p.notes : null,
  });
  if (e1) return { error: new Error(e1.message) };

  const { error: e2 } = await supabase.from("purchase_items").insert({
    purchase_id: headerId,
    product_id: productId,
    quantity: p.quantity,
    unit_cost: p.unitCost,
  });
  if (e2) return { error: new Error(e2.message) };
  return { error: null };
}

export async function insertExpenseToSupabase(
  supabase: SupabaseClient,
  e: Expense,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(e.id)) {
    return { error: new Error(`expense id no es UUID: ${e.id}`) };
  }
  const { error } = await supabase.from("expenses").insert({
    id: e.id,
    expense_date: e.date,
    category: e.category,
    description: e.description,
    amount: e.amount,
    payment_method: e.paymentMethod,
    kind: e.kind,
    receipt_note: e.receiptNote ?? null,
    from_recurrence_id:
      e.fromRecurrenceId && UUID_REGEX.test(e.fromRecurrenceId)
        ? e.fromRecurrenceId
        : null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function patchExpenseInSupabase(
  supabase: SupabaseClient,
  e: Expense,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(e.id)) return { error: null };
  const { error } = await supabase
    .from("expenses")
    .update({
      expense_date: e.date,
      category: e.category,
      description: e.description,
      amount: e.amount,
      payment_method: e.paymentMethod,
      kind: e.kind,
      receipt_note: e.receiptNote ?? null,
      from_recurrence_id:
        e.fromRecurrenceId && UUID_REGEX.test(e.fromRecurrenceId)
          ? e.fromRecurrenceId
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", e.id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteExpenseFromSupabase(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function patchPurchaseInSupabase(
  supabase: SupabaseClient,
  p: InventoryPurchase,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(p.id)) return { error: null };
  if (!UUID_REGEX.test(p.productId)) {
    return {
      error: new Error(`productId no es UUID, no se actualiza la compra: ${p.productId}`),
    };
  }
  const { error: e0 } = await supabase
    .from("purchases")
    .update({
      purchased_at: p.date,
      supplier: p.supplier,
      notes: p.notes?.trim() ? p.notes : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", p.id);
  if (e0) return { error: new Error(e0.message) };
  const { error: e1 } = await supabase
    .from("purchase_items")
    .update({
      product_id: p.productId,
      quantity: p.quantity,
      unit_cost: p.unitCost,
    })
    .eq("purchase_id", p.id);
  return { error: e1 ? new Error(e1.message) : null };
}

export async function deletePurchaseFromSupabase(
  supabase: SupabaseClient,
  purchaseId: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(purchaseId)) return { error: null };
  const { error } = await supabase.from("purchases").delete().eq("id", purchaseId);
  return { error: error ? new Error(error.message) : null };
}

export async function insertDefectiveEntryToSupabase(
  supabase: SupabaseClient,
  row: DefectiveEntry,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(row.id)) {
    return { error: new Error(`defective id no es UUID: ${row.id}`) };
  }
  if (!UUID_REGEX.test(row.productId)) {
    return {
      error: new Error(`productId no es UUID, no se replica defectuoso: ${row.productId}`),
    };
  }
  const { error } = await supabase.from("defective_entries").insert({
    id: row.id,
    product_id: row.productId,
    unit_cost: row.unitCost,
    quantity: row.quantity,
    reason: row.reason,
    recorded_at: row.recordedAt,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function deleteDefectiveEntryFromSupabase(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const { error } = await supabase.from("defective_entries").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function insertExpenseRecurrenceToSupabase(
  supabase: SupabaseClient,
  r: ExpenseRecurrence,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(r.id)) {
    return { error: new Error(`recurrence id no es UUID: ${r.id}`) };
  }
  const { error } = await supabase.from("expense_recurrences").insert({
    id: r.id,
    description: r.description,
    amount: r.amount,
    category: r.category,
    payment_method: r.paymentMethod,
    kind: r.kind,
    frequency: r.frequency,
    start_date: r.startDate.slice(0, 10),
    next_run_at: r.nextRunAt.slice(0, 10),
    end_date: r.endDate?.slice(0, 10) ?? null,
    paused: r.paused,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function patchExpenseRecurrenceInSupabase(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<ExpenseRecurrence>,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const row: Record<string, unknown> = {};
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.paymentMethod !== undefined) {
    row.payment_method = patch.paymentMethod;
  }
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.frequency !== undefined) row.frequency = patch.frequency;
  if (patch.startDate !== undefined) {
    row.start_date = patch.startDate.slice(0, 10);
  }
  if (patch.nextRunAt !== undefined) {
    row.next_run_at = patch.nextRunAt.slice(0, 10);
  }
  if (patch.endDate !== undefined) {
    row.end_date = patch.endDate ? patch.endDate.slice(0, 10) : null;
  }
  if (patch.paused !== undefined) row.paused = patch.paused;
  if (Object.keys(row).length === 0) return { error: null };
  row.updated_at = new Date().toISOString();
  const { error } = await supabase
    .from("expense_recurrences")
    .update(row)
    .eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteExpenseRecurrenceFromSupabase(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const { error } = await supabase
    .from("expense_recurrences")
    .delete()
    .eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function insertCustomerToSupabase(
  supabase: SupabaseClient,
  c: Customer,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(c.id)) {
    return { error: new Error(`customer id no es UUID: ${c.id}`) };
  }
  const { error } = await supabase.from("customers").insert({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    registered_at: c.registeredAt,
    notes: c.notes ?? "",
  });
  return { error: error ? new Error(error.message) : null };
}

export async function patchProductInSupabase(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Product>,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const row: Record<string, unknown> = {};
  if (patch.sku !== undefined) row.sku = patch.sku;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.size !== undefined) row.size = patch.size;
  if (patch.model !== undefined) row.model = patch.model;
  if (patch.familyId !== undefined) {
    row.family_id = requireUuid(patch.familyId, "familyId");
  }
  if (patch.supplier !== undefined) row.supplier = patch.supplier;
  if (patch.purchaseCost !== undefined) row.purchase_cost = patch.purchaseCost;
  if (patch.salePrice !== undefined) row.sale_price = patch.salePrice;
  if (patch.stock !== undefined) row.stock = patch.stock;
  if (patch.minStock !== undefined) row.min_stock = patch.minStock;
  if (patch.entryDate !== undefined) {
    row.entry_date = patch.entryDate.slice(0, 10);
  }
  if (patch.stockBySize !== undefined) {
    row.stock_by_size = patch.stockBySize;
  }
  if (Object.keys(row).length === 0) return { error: null };
  row.updated_at = new Date().toISOString();
  const { error } = await supabase.from("products").update(row).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteProductFromSupabase(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const { error } = await supabase.from("products").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function insertProductFamilyToSupabase(
  supabase: SupabaseClient,
  f: ProductFamily,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(f.id)) {
    return { error: new Error(`family id no es UUID: ${f.id}`) };
  }
  const { error } = await supabase.from("product_families").insert({
    id: f.id,
    name: f.name,
    category: f.category,
    entry_date: f.entryDate.slice(0, 10),
  });
  return { error: error ? new Error(error.message) : null };
}

export async function insertProductFamilyAndProductsToSupabase(
  supabase: SupabaseClient,
  family: ProductFamily,
  variants: Product[],
): Promise<{ error: Error | null }> {
  const e0 = await insertProductFamilyToSupabase(supabase, family);
  if (e0.error) return e0;
  for (const p of variants) {
    const e = await insertProductToSupabase(supabase, p);
    if (e.error) return e;
  }
  return { error: null };
}

export async function patchProductFamilyInSupabase(
  supabase: SupabaseClient,
  familyId: string,
  patch: Partial<Pick<ProductFamily, "name" | "category" | "entryDate">>,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(familyId)) return { error: null };
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.entryDate !== undefined) {
    row.entry_date = patch.entryDate.slice(0, 10);
  }
  if (Object.keys(row).length === 0) return { error: null };
  row.updated_at = new Date().toISOString();
  const { error } = await supabase
    .from("product_families")
    .update(row)
    .eq("id", familyId);
  if (error) return { error: new Error(error.message) };

  if (patch.category !== undefined) {
    const { error: e2 } = await supabase
      .from("products")
      .update({
        category: patch.category,
        updated_at: new Date().toISOString(),
      })
      .eq("family_id", familyId);
    if (e2) return { error: new Error(e2.message) };
  }

  if (patch.name !== undefined) {
    const { data: rows, error: er } = await supabase
      .from("products")
      .select("id, model")
      .eq("family_id", familyId);
    if (er) return { error: new Error(er.message) };
    for (const r of rows ?? []) {
      const pr = r as { id: string; model: string | null };
      const nm = buildVariantDisplayName(patch.name!, pr.model ?? "");
      const { error: eu } = await supabase
        .from("products")
        .update({ name: nm, updated_at: new Date().toISOString() })
        .eq("id", pr.id);
      if (eu) return { error: new Error(eu.message) };
    }
  }

  return { error: null };
}

export async function deleteProductFamilyFromSupabase(
  supabase: SupabaseClient,
  familyId: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(familyId)) return { error: null };
  const { error } = await supabase
    .from("product_families")
    .delete()
    .eq("id", familyId);
  return { error: error ? new Error(error.message) : null };
}

export async function patchCustomerInSupabase(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Customer>,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.registeredAt !== undefined) {
    row.registered_at = patch.registeredAt;
  }
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (Object.keys(row).length === 0) return { error: null };
  row.updated_at = new Date().toISOString();
  const { error } = await supabase.from("customers").update(row).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteCustomerFromSupabase(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(id)) return { error: null };
  const { error } = await supabase.from("customers").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function setProductStockInSupabase(
  supabase: SupabaseClient,
  productId: string,
  stock: number,
): Promise<{ error: Error | null }> {
  if (!UUID_REGEX.test(productId)) return { error: null };
  const { error } = await supabase
    .from("products")
    .update({ stock, updated_at: new Date().toISOString() })
    .eq("id", productId);
  return { error: error ? new Error(error.message) : null };
}

export function isRemoteDatasetEmpty(data: AppData): boolean {
  return (
    data.productFamilies.length === 0 &&
    data.products.length === 0 &&
    data.customers.length === 0 &&
    data.sales.length === 0 &&
    data.purchases.length === 0 &&
    data.expenses.length === 0 &&
    (data.defectives?.length ?? 0) === 0 &&
    (data.expenseRecurrences?.length ?? 0) === 0
  );
}
