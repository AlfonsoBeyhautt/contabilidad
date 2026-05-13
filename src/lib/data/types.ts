/** Domain model — preparado para mapear a tablas Postgres/Supabase */

export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "otro";

export type ExpenseCategory =
  | "producción"
  | "marketing"
  | "envíos"
  | "otros";

export type ExpenseKind = "fijo" | "variable";

export type ProductCategory =
  | "Remeras"
  | "Pantalones"
  | "Abrigos"
  | "Accesorios"
  | "Calzado";

/** Nombre de prenda (ej. buzo de lana); las variantes viven en `Product`. */
export interface ProductFamily {
  id: string;
  name: string;
  category: ProductCategory;
  entryDate: string; // ISO date
}

/** Variante = modelo/estampa; stock por talle en `stockBySize` (clave "_" = sin talle). */
export interface Product {
  id: string;
  familyId: string;
  sku: string;
  /** Listados y ventas: prenda · modelo (sin talle; el talle va en líneas de venta). */
  name: string;
  category: ProductCategory;
  /** Legacy / vacío cuando se usa solo stockBySize. */
  size: string;
  model: string;
  supplier: string;
  purchaseCost: number;
  salePrice: number;
  /** Total unidades (= suma de stockBySize cuando hay mapa). */
  stock: number;
  minStock: number;
  entryDate: string; // ISO date
  stockBySize: Record<string, number>;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  registeredAt: string; // ISO date
  notes?: string;
}

export interface SaleLine {
  productId: string;
  /** Talle vendido; vacío = bucket "_" en stock_by_size. */
  size?: string;
  quantity: number;
  unitPrice: number;
  discount: number; // monto descontado en la línea
}

export interface Sale {
  id: string;
  date: string; // ISO datetime
  customerId: string | null;
  paymentMethod: PaymentMethod;
  lines: SaleLine[];
  /** Costo unitario capturado por producto al momento de la venta (snapshot) */
  costSnapshot: Record<string, number>;
}

export interface InventoryPurchase {
  id: string;
  date: string;
  supplier: string;
  /** Notas internas (cabecera en Supabase). */
  notes?: string;
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  receiptNote?: string;
  kind: ExpenseKind;
  /** Si el gasto fue generado por una recurrencia. */
  fromRecurrenceId?: string | null;
}

export type RecurrenceFrequency =
  | "semanal"
  | "quincenal"
  | "mensual"
  | "trimestral"
  | "anual";

export interface ExpenseRecurrence {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  kind: ExpenseKind;
  frequency: RecurrenceFrequency;
  /** YYYY-MM-DD */
  startDate: string;
  /** Próxima fecha en que debe emitirse un gasto (YYYY-MM-DD). */
  nextRunAt: string;
  /** Fin opcional (YYYY-MM-DD). */
  endDate?: string;
  paused: boolean;
}

export type DefectiveReason = "agujero" | "costura_fallada" | "otro";

/** Unidades no vendibles; costo como pérdida (no afecta stock). */
export interface DefectiveEntry {
  id: string;
  productId: string;
  unitCost: number;
  quantity: number;
  reason: DefectiveReason;
  /** ISO datetime (interno, para reportes por período). */
  recordedAt: string;
}

export interface AppSettings {
  shopName: string;
  currency: string;
  lowStockAlerts: boolean;
}

/** Tipos de movimiento de stock para el ledger / historial. */
export type StockMovementKind =
  | "compra"
  | "compra_revert"
  | "venta"
  | "venta_revert"
  | "defectuoso"
  | "ajuste_manual"
  | "alta_producto"
  | "cascade_borrado";

/** Origen referencial del movimiento (apuntador a la entidad que lo causó). */
export type StockMovementRefKind =
  | "sale"
  | "purchase"
  | "defective"
  | "manual"
  | "system";

/**
 * Ledger inmutable de movimientos de stock por (producto, talle).
 * `delta` puede ser 0 para eventos informativos. `stockAfter` refleja el stock
 * total del producto después del movimiento (suma de todos los talles).
 */
export interface StockMovement {
  id: string;
  productId: string;
  /** Clave del talle (igual a `stockBySize`). "_" = sin talle. */
  sizeKey: string;
  kind: StockMovementKind;
  /** Variación neta de unidades (+ ingresa, − sale). */
  delta: number;
  /** Stock total del producto después de aplicar el movimiento. */
  stockAfter: number;
  refKind?: StockMovementRefKind;
  refId?: string;
  /** Texto libre para anotar contexto (ej. "edición", "recuento físico"). */
  note?: string;
  /** ISO datetime; ordenamiento cronológico del ledger. */
  createdAt: string;
}

export interface AppData {
  productFamilies: ProductFamily[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  purchases: InventoryPurchase[];
  expenses: Expense[];
  expenseRecurrences: ExpenseRecurrence[];
  defectives: DefectiveEntry[];
  stockMovements: StockMovement[];
  settings: AppSettings;
}

/** Contrato futuro para repositorio Supabase */
export interface DataRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}
