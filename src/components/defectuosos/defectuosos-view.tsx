"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { usePeriod } from "@/contexts/period-context";
import { filterDefectivesInRange } from "@/lib/data/finance-calcs";
import type {
  DefectiveEntry,
  DefectiveReason,
  Product,
  ProductFamily,
} from "@/lib/data/types";
import { formatCurrency } from "@/lib/format";

const reasons: { value: DefectiveReason; label: string }[] = [
  { value: "agujero", label: "Agujero" },
  { value: "costura_fallada", label: "Costura fallada" },
  { value: "otro", label: "Otro" },
];

type BreakdownMode = "detalle" | "producto" | "prenda" | "modelo" | "categoria";

const breakdownTabs: { id: BreakdownMode; label: string }[] = [
  { id: "detalle", label: "Listado" },
  { id: "producto", label: "Por producto" },
  { id: "prenda", label: "Por prenda (familia)" },
  { id: "modelo", label: "Por modelo" },
  { id: "categoria", label: "Por categoría" },
];

function aggregateDefectives(
  entries: DefectiveEntry[],
  products: Product[],
  families: ProductFamily[],
  mode: BreakdownMode,
): { key: string; label: string; qty: number; loss: number }[] {
  if (mode === "detalle") return [];
  const pmap = new Map(products.map((p) => [p.id, p]));
  const fmap = new Map(families.map((f) => [f.id, f]));
  const map = new Map<string, { label: string; qty: number; loss: number }>();

  for (const d of entries) {
    const p = pmap.get(d.productId);
    const loss = d.quantity * d.unitCost;
    let key: string;
    let label: string;

    if (mode === "producto") {
      key = d.productId;
      label = p?.name ?? "Producto eliminado";
    } else if (mode === "prenda") {
      if (!p) {
        key = `__orphan:${d.productId}`;
        label = "Producto eliminado";
      } else {
        const fid = p.familyId;
        key = fid;
        label = fmap.get(fid)?.name ?? "Sin familia";
      }
    } else if (mode === "modelo") {
      if (!p) {
        key = `__orphan:${d.productId}`;
        label = "Producto eliminado";
      } else {
        const raw = (p.model ?? "").trim();
        key = raw || "__empty__";
        label = raw || "Sin modelo";
      }
    } else {
      if (!p) {
        key = `__orphan:${d.productId}`;
        label = "Producto eliminado";
      } else {
        key = p.category;
        label = p.category;
      }
    }

    const cur = map.get(key) ?? { label, qty: 0, loss: 0 };
    cur.qty += d.quantity;
    cur.loss += loss;
    map.set(key, cur);
  }

  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.loss - a.loss);
}

/** Subsección de Gastos: pérdida por defectuosos (mismo período que el filtro global). */
export function DefectuososSection() {
  const { data, addDefectiveEntry, deleteDefectiveEntry } = useAppData();
  const { range } = usePeriod();
  const [open, setOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownMode>("detalle");

  const inPeriod = useMemo(
    () => filterDefectivesInRange(data.defectives ?? [], range),
    [data.defectives, range],
  );

  const totals = useMemo(() => {
    const qty = inPeriod.reduce((a, d) => a + d.quantity, 0);
    const cost = inPeriod.reduce((a, d) => a + d.quantity * d.unitCost, 0);
    return { qty, cost };
  }, [inPeriod]);

  const sorted = useMemo(
    () =>
      [...inPeriod].sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      ),
    [inPeriod],
  );

  const grouped = useMemo(
    () =>
      aggregateDefectives(
        inPeriod,
        data.products,
        data.productFamilies ?? [],
        breakdown,
      ),
    [inPeriod, data.products, data.productFamilies, breakdown],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Defectuosos — pérdida de producción</p>
        <p className="mt-1 text-xs opacity-90">
          Misma categoría de costo que en el resumen financiero (dashboard,
          costos, reportes). Los totales siguen el período seleccionado arriba.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Unidades defectuosas (período)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {totals.qty}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Costo perdido (período)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatCurrency(totals.cost)}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={data.products.length === 0}
          title={
            data.products.length === 0
              ? "Necesitás al menos un producto cargado."
              : undefined
          }
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          <Plus className="h-4 w-4" />
          Registrar defectuoso
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {breakdownTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setBreakdown(t.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              breakdown === t.id
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {breakdown === "detalle" ? (
        <Card>
          <CardHeader
            title="Registros"
            subtitle="No afectan stock vendible; el costo cuenta como pérdida en el resumen"
          />
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Costo unit.</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sorted.map((d) => {
                  const p = data.products.find((x) => x.id === d.productId);
                  const reasonLabel =
                    reasons.find((r) => r.value === d.reason)?.label ??
                    d.reason;
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-3 font-medium">
                        {p?.name ?? "Producto eliminado"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {d.quantity}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(d.unitCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(d.quantity * d.unitCost)}
                      </td>
                      <td className="px-4 py-3">{reasonLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                "¿Eliminar este registro? Los totales de pérdida se actualizarán.",
                              )
                            ) {
                              deleteDefectiveEntry(d.id);
                            }
                          }}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                No hay registros en este período.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={
              breakdown === "producto"
                ? "Pérdida por producto (variante)"
                : breakdown === "prenda"
                  ? "Pérdida por prenda (familia)"
                  : breakdown === "modelo"
                    ? "Pérdida por modelo"
                    : "Pérdida por categoría de producto"
            }
            subtitle="Mismos datos que el listado, agrupados para análisis"
          />
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">
                    {breakdown === "producto"
                      ? "Producto"
                      : breakdown === "prenda"
                        ? "Prenda (familia)"
                        : breakdown === "modelo"
                          ? "Modelo"
                          : "Categoría"}
                  </th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Pérdida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {grouped.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.qty}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(row.loss)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {grouped.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                No hay datos en este período.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {open ? (
        <DefectiveModal
          products={data.products}
          onClose={() => setOpen(false)}
          onSave={(payload) => {
            addDefectiveEntry(payload);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function DefectiveModal({
  products,
  onClose,
  onSave,
}: {
  products: { id: string; name: string }[];
  onClose: () => void;
  onSave: (input: {
    productId: string;
    unitCost: number;
    quantity: number;
    reason: DefectiveReason;
  }) => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [unitCost, setUnitCost] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<DefectiveReason>("otro");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader title="Registrar defectuoso" />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!productId || quantity < 1 || unitCost < 0) return;
              onSave({
                productId,
                unitCost: Number(unitCost),
                quantity: Number(quantity),
                reason,
              });
            }}
          >
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Producto
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Costo unitario de producción
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={unitCost || ""}
                onChange={(e) => setUnitCost(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Cantidad defectuosa
              <input
                type="number"
                min={1}
                required
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Motivo
              <select
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as DefectiveReason)
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {reasons.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700"
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
