"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { STOCK_BUCKET_DEFAULT } from "@/lib/data/stock-helpers";
import type {
  StockMovement,
  StockMovementKind,
} from "@/lib/data/types";
import { downloadCsv } from "@/lib/export";
import { formatDateTime } from "@/lib/format";

const KIND_META: Record<
  StockMovementKind,
  { label: string; tone: string; affectsStock: boolean }
> = {
  compra: {
    label: "Compra",
    tone: "bg-[var(--success-soft)] text-[var(--success)]",
    affectsStock: true,
  },
  compra_revert: {
    label: "Compra revertida",
    tone: "bg-[var(--success-soft)]/60 text-[var(--success)]",
    affectsStock: true,
  },
  venta: {
    label: "Venta",
    tone: "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    affectsStock: true,
  },
  venta_revert: {
    label: "Venta revertida",
    tone: "bg-blue-100/60 text-blue-900 dark:bg-blue-950/30 dark:text-blue-300",
    affectsStock: true,
  },
  defectuoso: {
    label: "Defectuoso",
    tone: "bg-[var(--warning-soft)] text-[var(--warning)]",
    affectsStock: false,
  },
  ajuste_manual: {
    label: "Ajuste manual",
    tone: "bg-[var(--surface-muted)] text-[var(--foreground)]",
    affectsStock: true,
  },
  alta_producto: {
    label: "Alta producto",
    tone: "bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200",
    affectsStock: true,
  },
  cascade_borrado: {
    label: "Borrado en cascada",
    tone: "bg-[var(--danger-soft)] text-[var(--danger)]",
    affectsStock: true,
  },
};

const KIND_OPTIONS: { value: "todos" | StockMovementKind; label: string }[] = [
  { value: "todos", label: "Todos los tipos" },
  { value: "compra", label: "Compra" },
  { value: "compra_revert", label: "Compra revertida" },
  { value: "venta", label: "Venta" },
  { value: "venta_revert", label: "Venta revertida" },
  { value: "defectuoso", label: "Defectuoso" },
  { value: "ajuste_manual", label: "Ajuste manual" },
  { value: "alta_producto", label: "Alta producto" },
  { value: "cascade_borrado", label: "Borrado en cascada" },
];

function sizeLabel(sizeKey: string): string {
  return sizeKey === STOCK_BUCKET_DEFAULT || !sizeKey ? "Único" : sizeKey;
}

export function HistorialView() {
  const { data } = useAppData();

  const productById = useMemo(
    () => new Map(data.products.map((p) => [p.id, p])),
    [data.products],
  );
  const familyById = useMemo(
    () => new Map(data.productFamilies.map((f) => [f.id, f])),
    [data.productFamilies],
  );

  const [familyId, setFamilyId] = useState<"todas" | string>("todas");
  const [productId, setProductId] = useState<"todos" | string>("todos");
  const [sizeKey, setSizeKey] = useState<"todos" | string>("todos");
  const [kind, setKind] = useState<"todos" | StockMovementKind>("todos");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const productOptions = useMemo(() => {
    return data.products
      .filter((p) => familyId === "todas" || p.familyId === familyId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.products, familyId]);

  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of data.stockMovements ?? []) {
      if (productId !== "todos" && m.productId !== productId) continue;
      if (familyId !== "todas") {
        const p = productById.get(m.productId);
        if (!p || p.familyId !== familyId) continue;
      }
      set.add(m.sizeKey || STOCK_BUCKET_DEFAULT);
    }
    return Array.from(set).sort((a, b) => {
      if (a === STOCK_BUCKET_DEFAULT) return -1;
      if (b === STOCK_BUCKET_DEFAULT) return 1;
      return a.localeCompare(b);
    });
  }, [data.stockMovements, productId, familyId, productById]);

  const filtered = useMemo(() => {
    const movements = data.stockMovements ?? [];
    const fromMs = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = to ? new Date(`${to}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const q = query.trim().toLowerCase();
    return movements
      .filter((m) => {
        if (kind !== "todos" && m.kind !== kind) return false;
        if (productId !== "todos" && m.productId !== productId) return false;
        if (sizeKey !== "todos" && (m.sizeKey || STOCK_BUCKET_DEFAULT) !== sizeKey) {
          return false;
        }
        if (familyId !== "todas") {
          const p = productById.get(m.productId);
          if (!p || p.familyId !== familyId) return false;
        }
        const t = new Date(m.createdAt).getTime();
        if (Number.isFinite(t)) {
          if (t < fromMs || t > toMs) return false;
        }
        if (q) {
          const p = productById.get(m.productId);
          const hay = [
            p?.name ?? "",
            p?.model ?? "",
            m.note ?? "",
            m.refId ?? "",
            KIND_META[m.kind]?.label ?? m.kind,
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [
    data.stockMovements,
    kind,
    productId,
    sizeKey,
    familyId,
    productById,
    from,
    to,
    query,
  ]);

  const summary = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    let defectivos = 0;
    for (const m of filtered) {
      if (m.kind === "defectuoso") {
        defectivos += Math.abs(m.delta);
        continue;
      }
      if (m.delta > 0) ingresos += m.delta;
      else egresos += -m.delta;
    }
    return { ingresos, egresos, defectivos, total: filtered.length };
  }, [filtered]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    const rows = filtered.map((m) => {
      const p = productById.get(m.productId);
      const fam = p ? familyById.get(p.familyId) : null;
      return {
        fecha: formatDateTime(m.createdAt),
        familia: fam?.name ?? "",
        producto: p?.name ?? "(producto eliminado)",
        modelo: p?.model ?? "",
        talle: sizeLabel(m.sizeKey),
        tipo: KIND_META[m.kind]?.label ?? m.kind,
        delta: m.delta,
        stock_despues: m.stockAfter,
        afecta_stock: KIND_META[m.kind]?.affectsStock ? "sí" : "no",
        ref_tipo: m.refKind ?? "",
        ref_id: m.refId ?? "",
        nota: m.note ?? "",
      };
    });
    downloadCsv(
      `historial_stock_${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
  };

  const resetFilters = () => {
    setFamilyId("todas");
    setProductId("todos");
    setSizeKey("todos");
    setKind("todos");
    setFrom("");
    setTo("");
    setQuery("");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Movimientos filtrados
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.total}
          </p>
        </div>
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--success)_25%,transparent)] bg-[var(--success-soft)] px-5 py-4">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--success)]">
            <ArrowDownToLine className="h-3 w-3" aria-hidden />
            Ingresos
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--success)]">
            +{summary.ingresos}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/40">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
            <ArrowUpToLine className="h-3 w-3" aria-hidden />
            Egresos
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-blue-950 dark:text-blue-100">
            −{summary.egresos}
          </p>
        </div>
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
            Defectuosos (informativo)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--warning)]">
            {summary.defectivos}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Filtros"
          subtitle="Acotá el ledger por familia, producto, talle, tipo o fecha"
          action={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-inverted)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-on-inverted)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Exportar CSV
              </button>
            </div>
          }
        />
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--foreground-muted)]">
                Familia
              </span>
              <select
                value={familyId}
                onChange={(e) => {
                  setFamilyId(e.target.value);
                  setProductId("todos");
                  setSizeKey("todos");
                }}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                <option value="todas">Todas las familias</option>
                {data.productFamilies
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--foreground-muted)]">
                Producto / modelo
              </span>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setSizeKey("todos");
                }}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                <option value="todos">Todos los productos</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--foreground-muted)]">
                Talle
              </span>
              <select
                value={sizeKey}
                onChange={(e) => setSizeKey(e.target.value)}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                <option value="todos">Todos los talles</option>
                {sizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {sizeLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--foreground-muted)]">
                Tipo de movimiento
              </span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--foreground-muted)]">
                Desde
              </span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--foreground-muted)]">
                Hasta
              </span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="font-medium text-[var(--foreground-muted)]">
                Buscar (producto, nota, referencia)
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej: Remera Negra, edición, agujero…"
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Ledger de movimientos"
          subtitle={
            filtered.length === 0
              ? "Sin movimientos para los filtros actuales."
              : `${filtered.length} movimientos (más recientes primero)`
          }
        />
        <CardContent className="overflow-x-auto p-0">
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--foreground-muted)]">
              Probá ajustar los filtros, ampliar el rango de fechas, o registrar
              ventas, compras y ajustes para poblar el historial.
            </p>
          ) : (
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--foreground-muted)]/50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Talle</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Delta</th>
                  <th className="px-4 py-3 text-right">Stock después</th>
                  <th className="px-4 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((m) => (
                  <MovementRow
                    key={m.id}
                    movement={m}
                    productName={
                      productById.get(m.productId)?.name ??
                      "(producto eliminado)"
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MovementRow({
  movement,
  productName,
}: {
  movement: StockMovement;
  productName: string;
}) {
  const meta = KIND_META[movement.kind] ?? {
    label: movement.kind,
    tone: "bg-[var(--surface-muted)] text-[var(--foreground)]",
    affectsStock: true,
  };
  const deltaClass =
    movement.delta > 0
      ? "text-[var(--success)]"
      : movement.delta < 0
        ? "text-[var(--danger)]"
        : "text-[var(--foreground-muted)]";
  const sign = movement.delta > 0 ? "+" : "";
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-[var(--foreground-muted)]">
        {formatDateTime(movement.createdAt)}
      </td>
      <td className="px-4 py-3 font-medium">{productName}</td>
      <td className="px-4 py-3 text-[var(--foreground-muted)]">
        {sizeLabel(movement.sizeKey)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}
        >
          {meta.label}
          {!meta.affectsStock ? (
            <span
              className="text-[10px] font-normal opacity-70"
              title="No afecta el stock visible (modelo actual: defectivos solo registran pérdida de costo)"
            >
              · informativo
            </span>
          ) : null}
        </span>
      </td>
      <td
        className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums ${deltaClass}`}
      >
        {sign}
        {movement.delta}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--foreground)]">
        {movement.stockAfter}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">
        {movement.note ? (
          <span className="block max-w-[220px] truncate" title={movement.note}>
            {movement.note}
          </span>
        ) : null}
        {movement.refKind && movement.refId ? (
          <span className="block font-mono text-[10px] text-[var(--foreground-subtle)]">
            {movement.refKind}: {movement.refId.slice(0, 8)}…
          </span>
        ) : null}
      </td>
    </tr>
  );
}
