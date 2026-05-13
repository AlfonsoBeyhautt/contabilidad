"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { usePeriod } from "@/contexts/period-context";
import {
  filterPurchasesInRange,
  periodMetrics,
  saleCogs,
  saleTotal,
  filterSalesInRange,
} from "@/lib/data/finance-calcs";
import type { InventoryPurchase, Product } from "@/lib/data/types";
import { formatCurrency, formatDate } from "@/lib/format";

export function CostosView() {
  const { data, addPurchase, updatePurchase, deletePurchase } = useAppData();
  const { range } = usePeriod();
  const [open, setOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] =
    useState<InventoryPurchase | null>(null);

  const filteredPurchases = useMemo(
    () =>
      filterPurchasesInRange(data.purchases, range).sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [data.purchases, range],
  );

  const salesInRange = useMemo(
    () => filterSalesInRange(data.sales, range),
    [data.sales, range],
  );

  const cogsSales = useMemo(
    () => salesInRange.reduce((a, s) => a + saleCogs(s), 0),
    [salesInRange],
  );

  const revenueInRange = useMemo(
    () => salesInRange.reduce((a, s) => a + saleTotal(s), 0),
    [salesInRange],
  );

  const purchaseSpend = useMemo(
    () =>
      filteredPurchases.reduce(
        (a, p) => a + p.quantity * p.unitCost,
        0,
      ),
    [filteredPurchases],
  );

  const fullMetrics = periodMetrics(data, range);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--success-soft)]/60 p-5">
        <h3 className="text-sm font-semibold text-[var(--success)]">
          Separación contable (período seleccionado)
        </h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <dt className="text-xs text-[var(--foreground-muted)]">Ingresos</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(fullMetrics.revenue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--foreground-muted)]">
              COGS (costo ventas)
            </dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(fullMetrics.cogsSales)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--foreground-muted)]">
              Gastos operativos
            </dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(fullMetrics.expenses)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--foreground-muted)]">
              Pérdida defectuosos
            </dt>
            <dd className="font-semibold tabular-nums text-[var(--warning)]">
              {formatCurrency(fullMetrics.defectiveLoss)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--foreground-muted)]">Ganancia neta</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(fullMetrics.netProfit)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--foreground-muted)]">
            COGS reconocido en ventas
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(cogsSales)}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            Costo de mercadería vendida en el período.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--foreground-muted)]">
            Compras de mercadería registradas
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(purchaseSpend)}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            Reposiciones que aumentan stock (no es COGS hasta que vendés).
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--foreground-muted)]">
            Ganancia bruta del período
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(revenueInRange - cogsSales)}
          </p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Ingresos − COGS.</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          disabled={data.products.length === 0}
          title={
            data.products.length === 0
              ? "Cargá al menos un producto para asociar la compra de stock."
              : undefined
          }
          onClick={() => {
            setEditingPurchase(null);
            setOpen(true);
          }}
          className="rounded-lg bg-[var(--surface-inverted)] px-4 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Registrar compra de mercadería
        </button>
        <p className="max-w-md text-right text-xs text-[var(--foreground-muted)]">
          Usar para ingresar stock de productos ya creados (reposición). El
          historial de compras y el stock se actualizan acá, no desde Productos.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Compras / ingreso de mercadería"
          subtitle="Historial en el período filtrado"
        />
        <CardContent className="overflow-x-auto p-0">
          <div className="space-y-3 p-3 md:hidden">
            {filteredPurchases.map((p) => {
              const prod = data.products.find((x) => x.id === p.productId);
              const total = p.quantity * p.unitCost;
              return (
                <div key={p.id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{prod?.name ?? p.productId}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{formatDate(p.date)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                    Proveedor: {p.supplier || "—"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <p><span className="text-[var(--foreground-muted)]">Cantidad:</span> <span className="font-medium tabular-nums">{p.quantity}</span></p>
                    <p><span className="text-[var(--foreground-muted)]">Costo unit.:</span> <span className="font-medium tabular-nums">{formatCurrency(p.unitCost)}</span></p>
                    <p className="col-span-2"><span className="text-[var(--foreground-muted)]">Total:</span> <span className="font-medium tabular-nums">{formatCurrency(total)}</span></p>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPurchase(p);
                        setOpen(true);
                      }}
                      className="rounded p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                      aria-label="Editar compra"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            "¿Eliminar esta compra? Se descontará del stock y se actualizarán totales.",
                          )
                        ) {
                          deletePurchase(p.id);
                        }
                      }}
                      className="rounded p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      aria-label="Eliminar compra"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <table className="hidden w-full min-w-[880px] text-left text-sm md:table">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--foreground-muted)]/50">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Costo unit.</th>
                <th className="px-4 py-3 text-right">Total compra</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredPurchases.map((p) => {
                const prod = data.products.find((x) => x.id === p.productId);
                const total = p.quantity * p.unitCost;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{formatDate(p.date)}</td>
                    <td className="max-w-[140px] truncate px-4 py-3">{p.supplier || "—"}</td>
                    <td className="px-4 py-3">{prod?.name ?? p.productId}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(p.unitCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPurchase(p);
                            setOpen(true);
                          }}
                          className="rounded p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                          aria-label="Editar compra"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                "¿Eliminar esta compra? Se descontará del stock y se actualizarán totales.",
                              )
                            ) {
                              deletePurchase(p.id);
                            }
                          }}
                          className="rounded p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                          aria-label="Eliminar compra"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {open ? (
        <PurchaseModal
          key={editingPurchase?.id ?? "__create__"}
          products={data.products}
          initial={editingPurchase}
          onClose={() => {
            setOpen(false);
            setEditingPurchase(null);
          }}
          onCreate={(row) => {
            addPurchase(row);
            setOpen(false);
            setEditingPurchase(null);
          }}
          onUpdate={(row) => {
            updatePurchase(row.id, {
              date: row.date,
              supplier: row.supplier,
              notes: row.notes,
              productId: row.productId,
              quantity: row.quantity,
              unitCost: row.unitCost,
            });
            setOpen(false);
            setEditingPurchase(null);
          }}
        />
      ) : null}
    </div>
  );
}

function purchaseFormFromInitial(
  products: Product[],
  initial: InventoryPurchase | null,
) {
  if (!initial) {
    const first = products[0];
    return {
      date: new Date().toISOString().slice(0, 10),
      productId: first?.id ?? "",
      quantity: 10,
      unitCost: 0,
      supplier: first?.supplier ?? "",
      notes: "",
    };
  }
  const d = initial.date.includes("T")
    ? initial.date.slice(0, 10)
    : initial.date.slice(0, 10);
  return {
    date: d,
    productId: initial.productId,
    quantity: initial.quantity,
    unitCost: initial.unitCost,
    supplier: initial.supplier ?? "",
    notes: initial.notes ?? "",
  };
}

function PurchaseModal({
  products,
  initial,
  onClose,
  onCreate,
  onUpdate,
}: {
  products: Product[];
  initial: InventoryPurchase | null;
  onClose: () => void;
  onCreate: (row: Omit<InventoryPurchase, "id">) => void;
  onUpdate: (row: InventoryPurchase) => void;
}) {
  const [form, setForm] = useState(() =>
    purchaseFormFromInitial(products, initial),
  );

  const selected = products.find((p) => p.id === form.productId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader
          title={initial ? "Editar compra" : "Nueva compra de stock"}
          subtitle="Suma o ajusta unidades y el costo de adquisición"
        />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!products.length || !form.productId) return;
              const row = {
                date: new Date(form.date + "T12:00:00").toISOString(),
                supplier: form.supplier.trim(),
                notes: form.notes.trim() || undefined,
                productId: form.productId,
                quantity: Number(form.quantity),
                unitCost: Number(form.unitCost),
              };
              if (initial) {
                onUpdate({ ...row, id: initial.id });
              } else {
                onCreate(row);
              }
            }}
          >
            {products.length === 0 ? (
              <p className="rounded-lg border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
                No hay productos. Agregá productos primero para registrar compras
                de stock.
              </p>
            ) : null}
            <label className="block text-xs font-medium">
              Fecha
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium">
              Producto
              <select
                value={form.productId}
                disabled={products.length === 0}
                onChange={(e) => {
                  const id = e.target.value;
                  const pr = products.find((p) => p.id === id);
                  setForm((f) => ({
                    ...f,
                    productId: id,
                    supplier:
                      !initial && f.supplier.trim() === ""
                        ? (pr?.supplier ?? "")
                        : f.supplier,
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm disabled:opacity-50"
              >
                {products.length === 0 ? (
                  <option value="">Sin productos</option>
                ) : (
                  products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Proveedor
              <input
                type="text"
                value={form.supplier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supplier: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                placeholder="Nombre o referencia"
              />
            </label>
            <label className="block text-xs font-medium">
              Notas (opcional)
              <input
                type="text"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                placeholder="Referencia interna, remito…"
              />
            </label>
            <label className="block text-xs font-medium">
              Cantidad
              <input
                type="number"
                min={1}
                required
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    quantity: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium">
              Costo unitario
              <input
                type="number"
                min={0}
                required
                value={form.unitCost || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    unitCost: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <p className="text-xs text-[var(--foreground-muted)]">
              Total compra:{" "}
              <strong>
                {formatCurrency(Number(form.quantity) * Number(form.unitCost))}
              </strong>
              {selected ? (
                <span className="ml-2 text-[var(--foreground-subtle)]">
                  Modelo: {selected.model || "—"}
                </span>
              ) : null}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={products.length === 0}
                className="flex-1 rounded-lg bg-[var(--surface-inverted)] py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {initial ? "Guardar cambios" : "Guardar y actualizar stock"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
