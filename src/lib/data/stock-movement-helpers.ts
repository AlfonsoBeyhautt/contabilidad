/**
 * Helpers para emitir y reconstruir el ledger de movimientos de stock.
 *
 * Convenciones:
 *  - `sizeKey` = clave usada en `Product.stockBySize` (ver `stock-helpers.ts`).
 *  - `stockAfter` = stock total del producto luego del movimiento (suma de talles).
 *  - Los `defectuoso` se registran como informativos: en este modelo de negocio
 *    NO descuentan stock visible, por lo que `delta = -quantity` pero `stockAfter`
 *    queda igual al estado previo (la UI distingue estos eventos).
 */
import {
  STOCK_BUCKET_DEFAULT,
  normalizeProductStockShape,
  normalizeSizeKey,
  totalStockFromBySize,
} from "./stock-helpers";
import type {
  AppData,
  DefectiveEntry,
  InventoryPurchase,
  Product,
  Sale,
  StockMovement,
  StockMovementKind,
  StockMovementRefKind,
} from "./types";

function newMovementId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mov_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export type MovementBuildInput = {
  productId: string;
  sizeKey: string;
  kind: StockMovementKind;
  delta: number;
  stockAfter: number;
  refKind?: StockMovementRefKind;
  refId?: string;
  note?: string;
  createdAt?: string;
};

export function buildMovement(input: MovementBuildInput): StockMovement {
  return {
    id: newMovementId(),
    productId: input.productId,
    sizeKey: normalizeSizeKey(input.sizeKey),
    kind: input.kind,
    delta: input.delta,
    stockAfter: input.stockAfter,
    refKind: input.refKind,
    refId: input.refId,
    note: input.note,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

/** Crea movimientos para una venta aplicada (una fila por línea). */
export function buildMovementsForSaleApplied(
  sale: Sale,
  productsAfter: Product[],
  note?: string,
): StockMovement[] {
  const byId = new Map(productsAfter.map((p) => [p.id, p]));
  const out: StockMovement[] = [];
  for (const line of sale.lines) {
    const p = byId.get(line.productId);
    if (!p) continue;
    out.push(
      buildMovement({
        productId: line.productId,
        sizeKey: line.size ?? STOCK_BUCKET_DEFAULT,
        kind: "venta",
        delta: -Math.abs(line.quantity),
        stockAfter: p.stock,
        refKind: "sale",
        refId: sale.id,
        note,
        createdAt: sale.date,
      }),
    );
  }
  return out;
}

/** Crea movimientos para revertir una venta (edición o eliminación). */
export function buildMovementsForSaleReverted(
  sale: Sale,
  productsAfter: Product[],
  note: string,
): StockMovement[] {
  const byId = new Map(productsAfter.map((p) => [p.id, p]));
  const out: StockMovement[] = [];
  for (const line of sale.lines) {
    const p = byId.get(line.productId);
    if (!p) continue;
    out.push(
      buildMovement({
        productId: line.productId,
        sizeKey: line.size ?? STOCK_BUCKET_DEFAULT,
        kind: "venta_revert",
        delta: Math.abs(line.quantity),
        stockAfter: p.stock,
        refKind: "sale",
        refId: sale.id,
        note,
      }),
    );
  }
  return out;
}

export function buildMovementForPurchaseApplied(
  purchase: InventoryPurchase,
  productAfter: Product | undefined,
  note?: string,
): StockMovement | null {
  if (!productAfter) return null;
  return buildMovement({
    productId: purchase.productId,
    sizeKey: STOCK_BUCKET_DEFAULT,
    kind: "compra",
    delta: Math.abs(purchase.quantity),
    stockAfter: productAfter.stock,
    refKind: "purchase",
    refId: purchase.id,
    note,
    createdAt: purchase.date,
  });
}

export function buildMovementForPurchaseReverted(
  purchase: InventoryPurchase,
  productAfter: Product | undefined,
  note: string,
): StockMovement | null {
  if (!productAfter) return null;
  return buildMovement({
    productId: purchase.productId,
    sizeKey: STOCK_BUCKET_DEFAULT,
    kind: "compra_revert",
    delta: -Math.abs(purchase.quantity),
    stockAfter: productAfter.stock,
    refKind: "purchase",
    refId: purchase.id,
    note,
  });
}

export function buildMovementForAdjustment(
  productId: string,
  sizeKey: string,
  delta: number,
  stockAfter: number,
  note?: string,
): StockMovement {
  return buildMovement({
    productId,
    sizeKey,
    kind: "ajuste_manual",
    delta,
    stockAfter,
    refKind: "manual",
    note,
  });
}

/**
 * Defectivo informativo: en este modelo no descuenta stock,
 * por eso `stockAfter` se pasa igual al stock actual.
 */
export function buildMovementForDefective(
  d: DefectiveEntry,
  stockUnchanged: number,
  sizeKey: string = STOCK_BUCKET_DEFAULT,
): StockMovement {
  return buildMovement({
    productId: d.productId,
    sizeKey,
    kind: "defectuoso",
    delta: -Math.abs(d.quantity),
    stockAfter: stockUnchanged,
    refKind: "defective",
    refId: d.id,
    note: d.reason,
    createdAt: d.recordedAt,
  });
}

export function buildMovementsForInitialStock(
  product: Product,
  note?: string,
): StockMovement[] {
  const normalized = normalizeProductStockShape(product);
  const out: StockMovement[] = [];
  for (const [sizeKey, qty] of Object.entries(normalized.stockBySize)) {
    if (!qty || qty <= 0) continue;
    out.push(
      buildMovement({
        productId: normalized.id,
        sizeKey,
        kind: "alta_producto",
        delta: qty,
        stockAfter: normalized.stock,
        refKind: "system",
        note: note ?? "Stock inicial al alta del producto",
        createdAt: normalized.entryDate,
      }),
    );
  }
  return out;
}

/**
 * Backfill: reconstruye el ledger histórico para un AppData cuyas tablas
 * de movimientos están vacías, a partir de ventas, compras y defectivos.
 *
 * Estrategia:
 *  1. Para cada producto, calcula el stock “inicial” (anterior a todos los eventos)
 *     restando compras y sumando ventas a los stocks actuales por talle.
 *  2. Recorre los eventos en orden cronológico aplicando deltas a un estado
 *     simulado, emitiendo un movimiento con `stockAfter` correcto en cada paso.
 *  3. Defectivos no modifican el estado simulado (consistente con el modelo).
 *
 * Si un producto referenciado no existe, el evento se omite.
 */
export function backfillStockMovements(data: AppData): StockMovement[] {
  const byProductId = new Map(data.products.map((p) => [p.id, p]));

  // Estado simulado: stockBySize por producto, partiendo del actual.
  type SimState = { stockBySize: Record<string, number>; total: number };
  const sim = new Map<string, SimState>();
  for (const p of data.products) {
    const stockBySize = { ...(p.stockBySize ?? {}) };
    sim.set(p.id, {
      stockBySize,
      total: totalStockFromBySize(stockBySize),
    });
  }

  type Event =
    | { at: number; kind: "sale"; sale: Sale }
    | { at: number; kind: "purchase"; purchase: InventoryPurchase }
    | { at: number; kind: "defective"; defective: DefectiveEntry };

  const events: Event[] = [];
  for (const s of data.sales) {
    events.push({ at: new Date(s.date).getTime(), kind: "sale", sale: s });
  }
  for (const pch of data.purchases) {
    events.push({
      at: new Date(pch.date).getTime(),
      kind: "purchase",
      purchase: pch,
    });
  }
  for (const d of data.defectives ?? []) {
    events.push({
      at: new Date(d.recordedAt).getTime(),
      kind: "defective",
      defective: d,
    });
  }

  // Paso 1: retroceder al estado “inicial” aplicando eventos al revés.
  // sale resta stock al aplicar → al revertir suma; purchase suma → revertir resta.
  for (const ev of events) {
    if (ev.kind === "sale") {
      for (const line of ev.sale.lines) {
        const s = sim.get(line.productId);
        if (!s) continue;
        const k = normalizeSizeKey(line.size);
        s.stockBySize[k] = (s.stockBySize[k] ?? 0) + line.quantity;
        s.total = totalStockFromBySize(s.stockBySize);
      }
    } else if (ev.kind === "purchase") {
      const s = sim.get(ev.purchase.productId);
      if (!s) continue;
      const k = STOCK_BUCKET_DEFAULT;
      s.stockBySize[k] = Math.max(
        0,
        (s.stockBySize[k] ?? 0) - ev.purchase.quantity,
      );
      s.total = totalStockFromBySize(s.stockBySize);
    }
    // defective no modifica el estado simulado en este modelo
  }

  // Stock al instante "antes de cualquier evento". Emitimos un alta_producto
  // con el remanente positivo por talle como base del ledger.
  const out: StockMovement[] = [];
  for (const p of data.products) {
    const s = sim.get(p.id);
    if (!s) continue;
    for (const [sizeKey, qty] of Object.entries(s.stockBySize)) {
      if (!qty || qty <= 0) continue;
      out.push(
        buildMovement({
          productId: p.id,
          sizeKey,
          kind: "alta_producto",
          delta: qty,
          stockAfter: s.total,
          refKind: "system",
          note: "Backfill: stock inicial reconstruido",
          createdAt: p.entryDate,
        }),
      );
    }
  }

  // Paso 2: replay cronológico aplicando deltas y emitiendo movimientos.
  events.sort((a, b) => a.at - b.at);

  for (const ev of events) {
    if (ev.kind === "sale") {
      for (const line of ev.sale.lines) {
        const s = sim.get(line.productId);
        if (!s) continue;
        const k = normalizeSizeKey(line.size);
        s.stockBySize[k] = Math.max(0, (s.stockBySize[k] ?? 0) - line.quantity);
        s.total = totalStockFromBySize(s.stockBySize);
        out.push(
          buildMovement({
            productId: line.productId,
            sizeKey: k,
            kind: "venta",
            delta: -Math.abs(line.quantity),
            stockAfter: s.total,
            refKind: "sale",
            refId: ev.sale.id,
            createdAt: ev.sale.date,
          }),
        );
      }
    } else if (ev.kind === "purchase") {
      const s = sim.get(ev.purchase.productId);
      if (!s) continue;
      const k = STOCK_BUCKET_DEFAULT;
      s.stockBySize[k] = (s.stockBySize[k] ?? 0) + ev.purchase.quantity;
      s.total = totalStockFromBySize(s.stockBySize);
      out.push(
        buildMovement({
          productId: ev.purchase.productId,
          sizeKey: k,
          kind: "compra",
          delta: Math.abs(ev.purchase.quantity),
          stockAfter: s.total,
          refKind: "purchase",
          refId: ev.purchase.id,
          createdAt: ev.purchase.date,
        }),
      );
    } else {
      // defective: informativo (no toca estado simulado)
      const s = sim.get(ev.defective.productId);
      if (!s) continue;
      out.push(
        buildMovement({
          productId: ev.defective.productId,
          sizeKey: STOCK_BUCKET_DEFAULT,
          kind: "defectuoso",
          delta: -Math.abs(ev.defective.quantity),
          stockAfter: s.total,
          refKind: "defective",
          refId: ev.defective.id,
          note: ev.defective.reason,
          createdAt: ev.defective.recordedAt,
        }),
      );
    }
  }

  // Si el backfill descubre productos sin eventos previos, ya emitimos
  // el alta_producto inicial arriba; no hace falta más para que el ledger
  // muestre el origen del stock actual.
  void byProductId;
  return out;
}
