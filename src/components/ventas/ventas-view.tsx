"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { usePeriod } from "@/contexts/period-context";
import {
  filterSales,
  saleCogs,
  saleGrossProfit,
  saleTotal,
} from "@/lib/data/finance-calcs";
import { sizeStockRowsFromProduct } from "@/lib/data/stock-helpers";
import type {
  Customer,
  PaymentMethod,
  Product,
  ProductCategory,
  Sale,
  SaleLine,
} from "@/lib/data/types";
import { formatCurrency, formatDateTime } from "@/lib/format";

const payments: PaymentMethod[] = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "otro",
];

const categories: ProductCategory[] = [
  "Remeras",
  "Pantalones",
  "Abrigos",
  "Accesorios",
  "Calzado",
];

function saleLineText(products: Product[], l: SaleLine): string {
  const p = products.find((x) => x.id === l.productId);
  const sz = (l.size ?? "").trim();
  return `${p?.name ?? "?"}${sz ? ` · ${sz}` : ""} ×${l.quantity}`;
}

function sizeOptionsForProduct(p: Product | undefined): { value: string; label: string }[] {
  if (!p) return [{ value: "", label: "—" }];
  const rows = sizeStockRowsFromProduct(p);
  if (rows.length === 0) return [{ value: "", label: "Único" }];
  return rows.map((r) => ({
    value: r.size,
    label: r.size.trim() === "" ? "Único / sin talle" : r.size,
  }));
}

function defaultLineForm(products: Product[]): SaleLine {
  const p = products[0];
  return {
    productId: p?.id ?? "",
    size: "",
    quantity: 1,
    unitPrice: p?.salePrice ?? 0,
    discount: 0,
  };
}

type SaleFormProps = {
  products: Product[];
  customers: Customer[];
  initial: Omit<Sale, "id"> | null;
  submitLabel: string;
  onSubmit: (payload: Omit<Sale, "id">) => void;
  onCancel: () => void;
};

function SaleForm({
  products,
  customers,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: SaleFormProps) {
  const [saleDate, setSaleDate] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [salePayment, setSalePayment] = useState<PaymentMethod>("efectivo");
  const [saleCustomer, setSaleCustomer] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [lineForm, setLineForm] = useState<SaleLine>(() =>
    defaultLineForm(products),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setSaleDate(new Date(initial.date).toISOString().slice(0, 16));
    setSalePayment(initial.paymentMethod);
    setSaleCustomer(initial.customerId ?? "");
    if (initial.lines.length > 1) {
      setLines(initial.lines);
      setLineForm(defaultLineForm(products));
    } else if (initial.lines.length === 1) {
      setLines([]);
      setLineForm({ ...initial.lines[0] });
    } else {
      setLines([]);
      setLineForm(defaultLineForm(products));
    }
  }, [initial, products]);

  useEffect(() => {
    if (products.length === 0) return;
    setLineForm((prev) => {
      if (products.some((p) => p.id === prev.productId)) return prev;
      return defaultLineForm(products);
    });
  }, [products]);

  const pushLine = useCallback(() => {
    const p = products.find((x) => x.id === lineForm.productId);
    setLines((prev) => [
      ...prev,
      {
        ...lineForm,
        unitPrice: p?.salePrice ?? lineForm.unitPrice,
      },
    ]);
  }, [lineForm, products]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const allLines = lines.length ? lines : [lineForm];
    if (!allLines.length || !allLines[0].productId) {
      setSubmitError(
        "Elegí un producto y completá la venta (cantidad y precio).",
      );
      return;
    }
    const costSnapshot: Record<string, number> = {};
    for (const l of allLines) {
      const p = products.find((x) => x.id === l.productId);
      if (p) costSnapshot[l.productId] = p.purchaseCost;
    }
    try {
      onSubmit({
        date: new Date(saleDate).toISOString(),
        customerId: saleCustomer || null,
        paymentMethod: salePayment,
        lines: allLines.map((l) => ({
          ...l,
          discount: Math.max(0, l.discount),
        })),
        costSnapshot,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "No se pudo guardar la venta.",
      );
    }
  }

  const lineProduct = products.find((x) => x.id === lineForm.productId);
  const sizeOpts = sizeOptionsForProduct(lineProduct);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitError ? (
        <p
          role="alert"
          className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
        >
          {submitError}
        </p>
      ) : null}
      {products.length === 0 ? (
        <p className="rounded-lg border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
          No hay productos cargados. Cerrá este formulario y agregá productos
          en la sección Productos.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-[var(--foreground-muted)]">
          Fecha y hora
          <input
            type="datetime-local"
            required
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-[var(--foreground-muted)]">
          Pago
          <select
            value={salePayment}
            onChange={(e) =>
              setSalePayment(e.target.value as PaymentMethod)
            }
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
          >
            {payments.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-xs font-medium text-[var(--foreground-muted)]">
        Cliente (opcional)
        <select
          value={saleCustomer}
          onChange={(e) => setSaleCustomer(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
        >
          <option value="">Sin cliente</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-lg border border-[var(--border)] p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--foreground)]">
          Líneas
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            value={lineForm.productId}
            disabled={products.length === 0}
            onChange={(e) => {
              const id = e.target.value;
              const p = products.find((x) => x.id === id);
              setLineForm((prev) => ({
                ...prev,
                productId: id,
                unitPrice: p?.salePrice ?? prev.unitPrice,
                size: "",
              }));
            }}
            className="min-w-[120px] flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm disabled:opacity-50"
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
          <select
            value={lineForm.size ?? ""}
            disabled={products.length === 0}
            onChange={(e) =>
              setLineForm((prev) => ({ ...prev, size: e.target.value }))
            }
            className="min-w-[100px] rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            {sizeOpts.map((o) => (
              <option key={o.label + o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={lineForm.quantity}
            onChange={(e) =>
              setLineForm((p) => ({
                ...p,
                quantity: Number(e.target.value) || 1,
              }))
            }
            className="w-20 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min={0}
            placeholder="Dto."
            value={lineForm.discount || ""}
            onChange={(e) =>
              setLineForm((p) => ({
                ...p,
                discount: Number(e.target.value) || 0,
              }))
            }
            className="w-24 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={products.length === 0}
            onClick={pushLine}
            className="rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Añadir línea
          </button>
        </div>
        {lines.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-[var(--foreground-muted)]">
            {lines.map((l, i) => (
              <li key={i}>
                {saleLineText(products, l)} —{" "}
                {formatCurrency(l.quantity * l.unitPrice - l.discount)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={products.length === 0}
          className="flex-1 rounded-lg bg-[var(--surface-inverted)] py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function VentasView() {
  const { data, addSale, updateSale, deleteSale } = useAppData();
  const { range } = usePeriod();

  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [customerId, setCustomerId] = useState("");

  const [openNew, setOpenNew] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const filtered = useMemo(
    () =>
      filterSales(
        data.sales,
        {
          range,
          productId: productId || undefined,
          category: category || undefined,
          payment: payment || undefined,
          customerId: customerId || undefined,
        },
        data.products,
      ).sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [data.sales, data.products, range, productId, category, payment, customerId],
  );

  const totals = useMemo(() => {
    let revenue = 0;
    let gross = 0;
    let units = 0;
    for (const s of filtered) {
      revenue += saleTotal(s);
      gross += saleGrossProfit(s);
      units += s.lines.reduce((a, l) => a + l.quantity, 0);
    }
    const ticket = filtered.length ? revenue / filtered.length : 0;
    const margin = revenue > 0 ? (gross / revenue) * 100 : 0;
    return { revenue, gross, units, ticket, margin, count: filtered.length };
  }, [filtered]);

  function handleDeleteSale(s: Sale) {
    if (
      !confirm(
        "¿Eliminar esta venta? Se devolverá el stock y no podrás deshacerlo.",
      )
    ) {
      return;
    }
    deleteSale(s.id);
  }

  const editInitial = useMemo((): Omit<Sale, "id"> | null => {
    if (!editingSale) return null;
    return {
      date: editingSale.date,
      customerId: editingSale.customerId,
      paymentMethod: editingSale.paymentMethod,
      lines: editingSale.lines.map((l) => ({ ...l })),
      costSnapshot: { ...editingSale.costSnapshot },
    };
  }, [editingSale]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Producto"
          value={productId}
          onChange={setProductId}
          options={[
            { value: "", label: "Todos" },
            ...data.products.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.sku})`,
            })),
          ]}
        />
        <FilterSelect
          label="Categoría"
          value={category}
          onChange={(v) => setCategory(v as ProductCategory | "")}
          options={[
            { value: "", label: "Todas" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterSelect
          label="Pago"
          value={payment}
          onChange={(v) => setPayment(v as PaymentMethod | "")}
          options={[
            { value: "", label: "Todos" },
            ...payments.map((p) => ({ value: p, label: p })),
          ]}
        />
        <FilterSelect
          label="Cliente"
          value={customerId}
          onChange={setCustomerId}
          options={[
            { value: "", label: "Todos" },
            ...data.customers.map((c) => ({
              value: c.id,
              label: c.name,
            })),
          ]}
        />
        <button
          type="button"
          disabled={data.products.length === 0}
          title={
            data.products.length === 0
              ? "Cargá al menos un producto en Productos para registrar ventas."
              : undefined
          }
          onClick={() => setOpenNew(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[var(--surface-inverted)] px-4 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Registrar venta
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Summary label="Total vendido" value={formatCurrency(totals.revenue)} />
        <Summary label="Ganancia bruta" value={formatCurrency(totals.gross)} />
        <Summary label="Margen bruto" value={`${totals.margin.toFixed(1)} %`} />
        <Summary label="Unidades" value={String(totals.units)} />
        <Summary label="Ticket promedio" value={formatCurrency(totals.ticket)} />
      </div>

      <Card>
        <CardHeader
          title="Ventas registradas"
          subtitle={`Período global + filtros · ${filtered.length} registros`}
        />
        <CardContent className="overflow-x-auto p-0">
          <div className="space-y-3 p-3 md:hidden">
            {filtered.map((s) => {
              const cust = data.customers.find((c) => c.id === s.customerId);
              const desc = s.lines.map((l) => saleLineText(data.products, l)).join(", ");
              return (
                <div key={s.id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-[var(--foreground-muted)]">{formatDateTime(s.date)}</p>
                    <span className="capitalize text-xs text-[var(--foreground-muted)]">{s.paymentMethod}</span>
                  </div>
                  <p className="mt-2 text-sm">{desc}</p>
                  <p className="mt-1 text-xs text-[var(--foreground-muted)]">Cliente: {cust?.name ?? "—"}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <p><span className="text-[var(--foreground-muted)]">Total:</span> <span className="font-medium tabular-nums">{formatCurrency(saleTotal(s))}</span></p>
                    <p><span className="text-[var(--foreground-muted)]">COGS:</span> <span className="font-medium tabular-nums">{formatCurrency(saleCogs(s))}</span></p>
                    <p><span className="text-[var(--foreground-muted)]">Gan.:</span> <span className="font-medium tabular-nums text-[var(--success)]">{formatCurrency(saleGrossProfit(s))}</span></p>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingSale(s)}
                      className="rounded p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                      aria-label="Editar venta"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSale(s)}
                      className="rounded p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      aria-label="Eliminar venta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <table className="hidden w-full min-w-[920px] text-left text-sm md:table">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--foreground-muted)]/50">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">COGS</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((s) => {
                const cust = data.customers.find((c) => c.id === s.customerId);
                const desc = s.lines
                  .map((l) => saleLineText(data.products, l))
                  .join(", ");
                return (
                  <tr key={s.id} className="hover:bg-[var(--surface-muted)]/80/40">
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--foreground-muted)]">
                      {formatDateTime(s.date)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">{desc}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(saleTotal(s))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground-muted)]">
                      {formatCurrency(saleCogs(s))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--success)]">
                      {formatCurrency(saleGrossProfit(s))}
                    </td>
                    <td className="px-4 py-3 capitalize">{s.paymentMethod}</td>
                    <td className="px-4 py-3">{cust?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingSale(s)}
                          className="rounded p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                          aria-label="Editar venta"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(s)}
                          className="rounded p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                          aria-label="Eliminar venta"
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
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--foreground-muted)]">
              No hay ventas en este criterio.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {openNew ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl">
            <CardHeader
              title="Nueva venta"
              subtitle="Descuenta stock por variante y talle"
            />
            <CardContent>
              <SaleForm
                key="new"
                products={data.products}
                customers={data.customers}
                initial={null}
                submitLabel="Guardar venta"
                onCancel={() => setOpenNew(false)}
                onSubmit={(payload) => {
                  addSale(payload);
                  setOpenNew(false);
                }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {editingSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl">
            <CardHeader title="Editar venta" subtitle="Ajusta stock según los cambios" />
            <CardContent>
              <SaleForm
                key={editingSale.id}
                products={data.products}
                customers={data.customers}
                initial={editInitial}
                submitLabel="Guardar cambios"
                onCancel={() => setEditingSale(null)}
                onSubmit={(payload) => {
                  updateSale(editingSale.id, payload);
                  setEditingSale(null);
                }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-xs font-medium text-[var(--foreground-muted)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
