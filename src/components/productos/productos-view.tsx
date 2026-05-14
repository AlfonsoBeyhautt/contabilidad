"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { stockStatus } from "@/lib/data/finance-calcs";
import { productRotation } from "@/lib/intelligence/metrics";
import type { ProductVariantInput } from "@/contexts/data-context";
import type { Product, ProductCategory, ProductFamily } from "@/lib/data/types";
import {
  formatStockBySizeSummary,
  sizeStockRowsFromProduct,
  stockMapFromSizeRows,
} from "@/lib/data/stock-helpers";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

const categories: ProductCategory[] = [
  "Remeras",
  "Pantalones",
  "Abrigos",
  "Accesorios",
  "Calzado",
];

type SizeStockDraft = { size: string; stock: number };

type VariantDraft = {
  model: string;
  sizeRows: SizeStockDraft[];
  purchaseCost: number;
  salePrice: number;
  minStock: number;
};

const emptySizeRow = (): SizeStockDraft => ({ size: "", stock: 0 });

const emptyVariant = (): VariantDraft => ({
  model: "",
  sizeRows: [emptySizeRow()],
  purchaseCost: 0,
  salePrice: 0,
  minStock: 2,
});

function unitGrossMarginPct(p: Product): number | null {
  if (p.salePrice <= 0) return null;
  return (p.salePrice - p.purchaseCost) / p.salePrice;
}

function familyWeightedMarginPct(variants: Product[]): number | null {
  let wSum = 0;
  let acc = 0;
  for (const p of variants) {
    if (p.salePrice <= 0) continue;
    const m = (p.salePrice - p.purchaseCost) / p.salePrice;
    const w = Math.max(0, p.stock);
    acc += m * w;
    wSum += w;
  }
  if (wSum > 0) return acc / wSum;
  const parts = variants.filter((p) => p.salePrice > 0);
  if (parts.length === 0) return null;
  return (
    parts.reduce(
      (a, p) => a + (p.salePrice - p.purchaseCost) / p.salePrice,
      0,
    ) / parts.length
  );
}

function worstStockStatus(
  variants: Product[],
): ReturnType<typeof stockStatus> {
  if (variants.some((v) => stockStatus(v) === "agotado")) return "agotado";
  if (variants.some((v) => stockStatus(v) === "bajo")) return "bajo";
  return "disponible";
}

function statusBadgeClass(st: ReturnType<typeof stockStatus>): string {
  if (st === "agotado") return "bg-[var(--danger-soft)] text-[var(--danger)]";
  if (st === "bajo") return "bg-[var(--warning-soft)] text-[var(--warning)]";
  return "bg-[var(--success-soft)] text-[var(--success)]";
}

function statusLabel(st: ReturnType<typeof stockStatus>): string {
  if (st === "agotado") return "Agotado";
  if (st === "bajo") return "Bajo";
  return "OK";
}

type StockFilter = "all" | "bajo" | "agotado";

export function ProductosView() {
  const {
    data,
    addProductFamilyWithVariants,
    addVariantToFamily,
    updateProductFamily,
    deleteProductFamily,
    updateProduct,
    deleteProduct,
    adjustStock,
  } = useAppData();

  const [filter, setFilter] = useState<StockFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [variantDetailOpen, setVariantDetailOpen] = useState<
    Record<string, boolean>
  >({});

  const [creating, setCreating] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Product | null>(null);
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(
    null,
  );
  const [addingVariantFor, setAddingVariantFor] = useState<string | null>(
    null,
  );
  const [showCostosHint, setShowCostosHint] = useState(false);

  const inventoryIntel = useMemo(() => {
    const pmap = new Map(data.products.map((p) => [p.id, p]));
    const byId = new Map<string, { name: string; gross: number }>();
    for (const s of data.sales) {
      for (const l of s.lines) {
        const rev = Math.max(0, l.quantity * l.unitPrice - l.discount);
        const cogs = (s.costSnapshot[l.productId] ?? 0) * l.quantity;
        const g = rev - cogs;
        const name = pmap.get(l.productId)?.name ?? l.productId;
        const cur = byId.get(l.productId) ?? { name, gross: 0 };
        cur.gross += g;
        byId.set(l.productId, cur);
      }
    }
    let best: { name: string; gross: number } | null = null;
    for (const v of byId.values()) {
      if (!best || v.gross > best.gross) best = { name: v.name, gross: v.gross };
    }
    const rot = productRotation(data, 90);
    const immobile = [...rot]
      .filter(
        (r) =>
          (r.status === "muerto" || r.status === "lento") && r.stock > 0,
      )
      .sort((a, b) => b.capitalLocked - a.capitalLocked)[0];
    const fastest = [...rot]
      .filter((r) => r.unitsSold > 0)
      .sort((a, b) => b.unitsSold - a.unitsSold)[0];
    const worst = [...rot]
      .filter((r) => r.revenue > 0)
      .sort((a, b) => a.marginPct - b.marginPct)[0];
    const alerts = data.products.filter(
      (p) => stockStatus(p) === "bajo" || stockStatus(p) === "agotado",
    ).length;
    return { best, immobile, fastest, worst, alerts };
  }, [data]);

  const grouped = useMemo(() => {
    const rows = data.productFamilies.map((family) => {
      const variants = data.products.filter((p) => p.familyId === family.id);
      const minStock = variants.length
        ? Math.min(...variants.map((v) => v.stock))
        : 0;
      return { family, variants, minStock };
    });
    rows.sort((a, b) => a.minStock - b.minStock);
    return rows
      .map(({ family, variants, minStock }) => {
        const vis = variants.filter((v) => {
          const st = stockStatus(v);
          if (filter === "all") return true;
          if (filter === "bajo") return st === "bajo";
          return st === "agotado";
        });
        return { family, variants: vis, allVariants: variants, minStock };
      })
      .filter((g) => filter === "all" || g.variants.length > 0);
  }, [data.productFamilies, data.products, filter]);

  function isFamilyOpen(familyId: string) {
    return expanded[familyId] === true;
  }

  function toggleFamily(familyId: string) {
    setExpanded((e) => ({
      ...e,
      [familyId]: e[familyId] !== true,
    }));
  }

  function isVariantDetailOpen(productId: string) {
    return variantDetailOpen[productId] === true;
  }

  function toggleVariantDetail(productId: string) {
    setVariantDetailOpen((m) => ({
      ...m,
      [productId]: m[productId] !== true,
    }));
  }

  return (
    <div className="space-y-6">
      {showCostosHint ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_oklab,var(--success)_25%,transparent)] bg-[var(--success-soft)]/90 px-4 py-3 text-sm text-[var(--success)]">
          <p>
            Podés cargar stock de esta prenda en{" "}
            <Link
              href="/costos"
              className="font-semibold underline underline-offset-2"
            >
              Costos → Compras
            </Link>
            .
          </p>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-[var(--success)] underline"
            onClick={() => setShowCostosHint(false)}
          >
            Ocultar
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(
          [
            {
              title: "Mayor margen bruto (hist.)",
              primary: inventoryIntel.best?.name ?? "—",
              secondary: inventoryIntel.best
                ? formatCurrency(inventoryIntel.best.gross)
                : "Sin ventas cargadas",
            },
            {
              title: "Stock inmovilizado",
              primary: inventoryIntel.immobile?.product.name ?? "—",
              secondary: inventoryIntel.immobile
                ? `${formatCurrency(inventoryIntel.immobile.capitalLocked)} · ${inventoryIntel.immobile.stock} uds`
                : "Sin señales",
            },
            {
              title: "Mayor rotación (90 días)",
              primary: inventoryIntel.fastest?.product.name ?? "—",
              secondary: inventoryIntel.fastest
                ? `${inventoryIntel.fastest.unitsSold} uds vendidas`
                : "—",
            },
            {
              title: "Peor margen bruto (90 días)",
              primary: inventoryIntel.worst?.product.name ?? "—",
              secondary: inventoryIntel.worst
                ? formatPercent(inventoryIntel.worst.marginPct)
                : "—",
            },
            {
              title: "Alertas de stock",
              primary:
                inventoryIntel.alerts === 0
                  ? "Sin alertas"
                  : `${inventoryIntel.alerts} SKU`,
              secondary:
                inventoryIntel.alerts === 0
                  ? "Todo sobre mínimos"
                  : "Bajo o agotado",
            },
          ] as const
        ).map((cell) => (
          <div
            key={cell.title}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-sm)]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
              {cell.title}
            </p>
            <p className="mt-2 truncate text-[13px] font-semibold text-[var(--foreground-strong)]">
              {cell.primary}
            </p>
            <p className="mt-1 text-[11.5px] text-[var(--foreground-muted)]">
              {cell.secondary}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto flex flex-wrap gap-2 text-xs">
          <span className="self-center text-[var(--foreground-muted)]">Stock:</span>
          {(
            [
              ["all", "Todos"],
              ["bajo", "Bajo"],
              ["agotado", "Agotado"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 font-medium ${
                filter === key
                  ? "bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingVariant(null);
              setEditingFamily(null);
              setAddingVariantFor(null);
            }}
            className="rounded-lg bg-[var(--surface-inverted)] px-4 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
          >
            Nuevo producto
          </button>
          <p className="max-w-xs text-right text-[11px] leading-snug text-[var(--foreground-muted)]">
            Usar solo para crear un producto por primera vez (familia + variantes).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="Productos y variantes" />
        <CardContent className="overflow-x-auto p-0">
          <div className="space-y-3 p-3 md:hidden">
            {grouped.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--foreground-muted)]">
                {filter === "all" ? "No hay productos cargados." : "Nada coincide con este filtro."}
              </p>
            ) : (
              grouped.map(({ family, variants, allVariants }) => {
                  const famOpen = isFamilyOpen(family.id);
                  const worst = worstStockStatus(allVariants);
                  const sumStock = allVariants.reduce((a, p) => a + p.stock, 0);
                  const famMargin = familyWeightedMarginPct(allVariants);
                  return (
                    <div
                      key={family.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFamily(family.id)}
                          className="mt-0.5 rounded p-1 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                          aria-expanded={famOpen}
                          aria-label={famOpen ? "Contraer variantes" : "Ver variantes"}
                        >
                          {famOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold leading-snug">{family.name}</p>
                              <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)]">
                                {family.category} · Ingreso {formatDate(family.entryDate)}
                              </p>
                            </div>
                            <span
                              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(worst)}`}
                            >
                              {statusLabel(worst)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--foreground-muted)]">
                            <span>
                              {allVariants.length} variante
                              {allVariants.length === 1 ? "" : "s"}
                            </span>
                            <span className="tabular-nums">
                              Stock total <strong className="text-[var(--foreground)]">{sumStock}</strong>
                            </span>
                            <span className="tabular-nums">
                              Margen{" "}
                              <strong className="text-[var(--foreground)]">
                                {famMargin != null ? formatPercent(famMargin) : "—"}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--border-subtle)] pt-3">
                        <button
                          type="button"
                          onClick={() => setEditingFamily(family)}
                          className="rounded-md px-2 py-1 text-[11px] text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                        >
                          Editar prenda
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingVariantFor(family.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                        >
                          <Plus className="h-3 w-3" />
                          Variante
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                "¿Eliminar esta prenda y todas sus variantes?",
                              )
                            ) {
                              deleteProductFamily(family.id);
                            }
                          }}
                          className="rounded-md px-2 py-1 text-[11px] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                        >
                          Eliminar
                        </button>
                      </div>
                      {famOpen ? (
                        <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
                          {variants.map((p) => {
                            const st = stockStatus(p);
                            const um = unitGrossMarginPct(p);
                            return (
                              <div
                                key={p.id}
                                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/25 p-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold leading-snug">
                                      {p.model || "Sin modelo"}
                                    </p>
                                    <p className="mt-0.5 text-[11px] tabular-nums text-[var(--foreground-muted)]">
                                      {p.stock} uds · margen bruto{" "}
                                      {um != null ? formatPercent(um) : "—"}
                                    </p>
                                  </div>
                                  <span
                                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(st)}`}
                                  >
                                    {statusLabel(st)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleVariantDetail(p.id)}
                                  className="mt-2 text-[11px] font-medium text-[var(--foreground-muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
                                >
                                  {isVariantDetailOpen(p.id)
                                    ? "Ocultar detalle"
                                    : "Talles, costos y acciones"}
                                </button>
                                {isVariantDetailOpen(p.id) ? (
                                  <div className="mt-2 space-y-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                                    <p className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">
                                      <span className="font-medium text-[var(--foreground)]">
                                        Stock por talle:{" "}
                                      </span>
                                      {formatStockBySizeSummary(p)}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                      <p>
                                        <span className="text-[var(--foreground-muted)]">Costo</span>{" "}
                                        <span className="font-medium tabular-nums text-[var(--foreground)]">
                                          {formatCurrency(p.purchaseCost)}
                                        </span>
                                      </p>
                                      <p>
                                        <span className="text-[var(--foreground-muted)]">Precio</span>{" "}
                                        <span className="font-medium tabular-nums text-[var(--foreground)]">
                                          {formatCurrency(p.salePrice)}
                                        </span>
                                      </p>
                                      <p>
                                        <span className="text-[var(--foreground-muted)]">Mínimo</span>{" "}
                                        <span className="font-medium tabular-nums text-[var(--foreground)]">
                                          {p.minStock}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-1 border-t border-[var(--border-subtle)] pt-2">
                                      <button
                                        type="button"
                                        onClick={() => adjustStock(p.id, 1)}
                                        className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium tabular-nums hover:bg-[var(--surface-muted)]"
                                      >
                                        +1
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => adjustStock(p.id, -1)}
                                        className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium tabular-nums hover:bg-[var(--surface-muted)]"
                                      >
                                        −1
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingVariant(p)}
                                        className="rounded-md p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                                        aria-label="Editar variante"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              "¿Eliminar esta variante? Las ventas históricas conservan sus datos.",
                                            )
                                          ) {
                                            deleteProduct(p.id);
                                          }
                                        }}
                                        className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                                        aria-label="Eliminar variante"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })
            )}
          </div>
          <table className="hidden w-full min-w-[720px] text-left text-sm md:table">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--foreground-muted)]/50">
              <tr>
                <th className="w-10 px-2 py-3" />
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Margen bruto</th>
                <th className="px-4 py-3 text-right">Gestionar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {grouped.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[var(--foreground-muted)]"
                  >
                    {filter === "all"
                      ? "No hay productos cargados."
                      : "Nada coincide con este filtro."}
                  </td>
                </tr>
              ) : (
                grouped.map(({ family, variants, allVariants }) => {
                  const open = isFamilyOpen(family.id);
                  const worst = worstStockStatus(allVariants);
                  const sumStock = allVariants.reduce((a, p) => a + p.stock, 0);
                  const famMargin = familyWeightedMarginPct(allVariants);
                  return (
                    <Fragment key={family.id}>
                      <tr className="bg-[var(--surface-muted)]/80">
                        <td className="px-2 py-2.5 align-top">
                          <button
                            type="button"
                            onClick={() => toggleFamily(family.id)}
                            className="rounded p-1 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                            aria-expanded={open}
                            aria-label={open ? "Contraer" : "Expandir"}
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <p className="font-semibold leading-snug text-[var(--foreground-strong)]">
                            {family.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)]">
                            {family.category} · Ingreso {formatDate(family.entryDate)}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">
                            {allVariants.length} variante
                            {allVariants.length === 1 ? "" : "s"}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(worst)}`}
                          >
                            {statusLabel(worst)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right align-top tabular-nums font-medium text-[var(--foreground-strong)]">
                          {sumStock}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top tabular-nums text-[var(--foreground-muted)]">
                          {famMargin != null ? formatPercent(famMargin) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top">
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingFamily(family)}
                              className="rounded-md px-2 py-1 text-[11px] text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingVariantFor(family.id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                            >
                              <Plus className="h-3 w-3" />
                              Variante
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    "¿Eliminar esta prenda y todas sus variantes?",
                                  )
                                ) {
                                  deleteProductFamily(family.id);
                                }
                              }}
                              className="rounded-md px-2 py-1 text-[11px] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open
                        ? variants.flatMap((p) => {
                            const st = stockStatus(p);
                            const um = unitGrossMarginPct(p);
                            const rowClass =
                              st === "agotado"
                                ? "bg-[color-mix(in_oklab,var(--danger-soft)_40%,transparent)]"
                                : st === "bajo"
                                  ? "bg-[color-mix(in_oklab,var(--warning-soft)_35%,transparent)]"
                                  : "";
                            const detail = isVariantDetailOpen(p.id);
                            const rows = [
                              <tr
                                key={p.id}
                                className={`transition-colors hover:bg-[var(--surface-muted)]/50 ${rowClass}`}
                              >
                                <td />
                                <td className="px-4 py-2.5">
                                  <span className="text-[var(--foreground-subtle)]">↳ </span>
                                  <span className="font-medium text-[var(--foreground)]">
                                    {p.model || "Sin modelo"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(st)}`}
                                  >
                                    {statusLabel(st)}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                                  {p.stock}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--foreground-muted)]">
                                  {um != null ? formatPercent(um) : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => toggleVariantDetail(p.id)}
                                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                                    aria-expanded={detail}
                                  >
                                    {detail ? (
                                      <>
                                        <ChevronDown className="h-3.5 w-3.5" />
                                        Detalle
                                      </>
                                    ) : (
                                      <>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                        Detalle
                                      </>
                                    )}
                                  </button>
                                </td>
                              </tr>,
                            ];
                            if (detail) {
                              rows.push(
                                <tr key={`${p.id}-detail`} className={rowClass}>
                                  <td />
                                  <td colSpan={5} className="px-4 pb-3 pt-0">
                                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 shadow-inner">
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
                                            Stock por talle
                                          </p>
                                          <p className="mt-1 text-[12px] leading-relaxed text-[var(--foreground-muted)]">
                                            {formatStockBySizeSummary(p)}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] lg:shrink-0">
                                          <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                                              Costo
                                            </p>
                                            <p className="mt-0.5 tabular-nums font-medium">
                                              {formatCurrency(p.purchaseCost)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                                              Precio
                                            </p>
                                            <p className="mt-0.5 tabular-nums font-medium">
                                              {formatCurrency(p.salePrice)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                                              Mínimo
                                            </p>
                                            <p className="mt-0.5 tabular-nums font-medium">
                                              {p.minStock}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 border-t border-[var(--border-subtle)] pt-3 lg:border-0 lg:pt-0">
                                          <button
                                            type="button"
                                            onClick={() => adjustStock(p.id, 1)}
                                            className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold tabular-nums hover:bg-[var(--surface-muted)]"
                                          >
                                            +1
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => adjustStock(p.id, -1)}
                                            className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold tabular-nums hover:bg-[var(--surface-muted)]"
                                          >
                                            −1
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingVariant(p)}
                                            className="rounded-md p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                                            aria-label="Editar variante"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (
                                                confirm(
                                                  "¿Eliminar esta variante? Las ventas históricas conservan sus datos.",
                                                )
                                              ) {
                                                deleteProduct(p.id);
                                              }
                                            }}
                                            className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                                            aria-label="Eliminar variante"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>,
                              );
                            }
                            return rows;
                          })
                        : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {creating ? (
        <CreateFamilyModal
          onClose={() => setCreating(false)}
          onSave={(payload) => {
            addProductFamilyWithVariants(payload);
            setCreating(false);
            setShowCostosHint(true);
          }}
        />
      ) : null}

      {editingVariant ? (
        <EditVariantModal
          product={editingVariant}
          onClose={() => setEditingVariant(null)}
          onSave={(patch) => {
            updateProduct(editingVariant.id, patch);
            setEditingVariant(null);
          }}
        />
      ) : null}

      {editingFamily ? (
        <EditFamilyModal
          family={editingFamily}
          onClose={() => setEditingFamily(null)}
          onSave={(patch) => {
            updateProductFamily(editingFamily.id, patch);
            setEditingFamily(null);
          }}
        />
      ) : null}

      {addingVariantFor ? (
        <AddVariantModal
          onClose={() => setAddingVariantFor(null)}
          onSave={(draft) => {
            addVariantToFamily(addingVariantFor, draft);
            setAddingVariantFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateFamilyModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: {
    name: string;
    category: ProductCategory;
    entryDate: string;
    variants: ProductVariantInput[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Remeras");
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);

  function addRow() {
    setVariants((v) => [...v, emptyVariant()]);
  }

  function removeRow(i: number) {
    setVariants((v) => v.filter((_, j) => j !== i));
  }

  function updateRow(i: number, patch: Partial<VariantDraft>) {
    setVariants((v) =>
      v.map((row, j) => (j === i ? { ...row, ...patch } : row)),
    );
  }

  function addSizeRow(variantIndex: number) {
    setVariants((v) =>
      v.map((row, j) =>
        j === variantIndex
          ? { ...row, sizeRows: [...row.sizeRows, emptySizeRow()] }
          : row,
      ),
    );
  }

  function removeSizeRow(variantIndex: number, rowIndex: number) {
    setVariants((v) =>
      v.map((row, j) => {
        if (j !== variantIndex) return row;
        const next = row.sizeRows.filter((_, k) => k !== rowIndex);
        return {
          ...row,
          sizeRows: next.length ? next : [emptySizeRow()],
        };
      }),
    );
  }

  function updateSizeRow(
    variantIndex: number,
    rowIndex: number,
    patch: Partial<SizeStockDraft>,
  ) {
    setVariants((v) =>
      v.map((row, j) => {
        if (j !== variantIndex) return row;
        return {
          ...row,
          sizeRows: row.sizeRows.map((sr, k) =>
            k === rowIndex ? { ...sr, ...patch } : sr,
          ),
        };
      }),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <CardHeader title="Nueva prenda" subtitle="Nombre del producto y variantes" />
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const ok = variants.filter((r) => r.model.trim());
              if (!name.trim() || ok.length === 0) return;
              onSave({
                name: name.trim(),
                category,
                entryDate,
                variants: ok.map((r) => ({
                  model: r.model.trim(),
                  sizeStocks: r.sizeRows.map((sr) => ({
                    size: sr.size.trim(),
                    stock: Number(sr.stock) || 0,
                  })),
                  purchaseCost: r.purchaseCost,
                  salePrice: r.salePrice,
                  minStock: r.minStock,
                })),
              });
            }}
          >
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Nombre de la prenda
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                placeholder="Ej. Buzo de lana"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">
                Categoría
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ProductCategory)
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium">
                Fecha de ingreso
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                />
              </label>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--foreground)]">
                  Variantes
                </p>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium"
                >
                  <Plus className="h-3 w-3" />
                  Agregar variante
                </button>
              </div>
              <div className="space-y-3">
                {variants.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--border)] p-3"
                  >
                    <div className="mb-2 flex justify-end">
                      {variants.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-xs text-[var(--danger)] hover:underline"
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Field
                        label="Modelo / estampa"
                        value={row.model}
                        onChange={(v) => updateRow(i, { model: v })}
                        className="block"
                      />
                      <div className="rounded-md border border-[var(--border-subtle)] p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                            Talles y stock
                          </span>
                          <button
                            type="button"
                            onClick={() => addSizeRow(i)}
                            className="text-[11px] text-[var(--foreground-muted)] underline"
                          >
                            + Talle
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {row.sizeRows.map((sr, si) => (
                            <div
                              key={si}
                              className="flex flex-wrap items-end gap-2"
                            >
                              <Field
                                label="Talle"
                                value={sr.size}
                                onChange={(v) => updateSizeRow(i, si, { size: v })}
                                className="min-w-[72px] flex-1"
                              />
                              <Field
                                label="Uds"
                                type="number"
                                value={String(sr.stock)}
                                onChange={(v) =>
                                  updateSizeRow(i, si, {
                                    stock: Number(v) || 0,
                                  })
                                }
                                className="w-24"
                              />
                              {row.sizeRows.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeSizeRow(i, si)}
                                  className="mb-0.5 text-[11px] text-[var(--danger)]"
                                >
                                  Quitar
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field
                          label="Costo unitario de producción"
                          type="number"
                          value={String(row.purchaseCost)}
                          onChange={(v) =>
                            updateRow(i, { purchaseCost: Number(v) })
                          }
                        />
                        <Field
                          label="Precio"
                          type="number"
                          value={String(row.salePrice)}
                          onChange={(v) =>
                            updateRow(i, { salePrice: Number(v) })
                          }
                        />
                        <Field
                          label="Stock mínimo (alerta)"
                          type="number"
                          value={String(row.minStock)}
                          onChange={(v) =>
                            updateRow(i, { minStock: Number(v) })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[var(--surface-inverted)] py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
              >
                Guardar
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

function EditVariantModal({
  product,
  onClose,
  onSave,
}: {
  product: Product;
  onClose: () => void;
  onSave: (patch: Partial<Product>) => void;
}) {
  const [form, setForm] = useState({
    model: product.model,
    sizeRows: sizeStockRowsFromProduct(product),
    purchaseCost: product.purchaseCost,
    salePrice: product.salePrice,
    minStock: product.minStock,
    entryDate: product.entryDate.slice(0, 10),
  });

  function addSizeRow() {
    setForm((f) => ({
      ...f,
      sizeRows: [...f.sizeRows, emptySizeRow()],
    }));
  }

  function removeSizeRow(i: number) {
    setForm((f) => {
      const next = f.sizeRows.filter((_, j) => j !== i);
      return { ...f, sizeRows: next.length ? next : [emptySizeRow()] };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md overflow-y-auto">
        <CardHeader title="Editar variante / modelo" />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const stockBySize = stockMapFromSizeRows(
                form.sizeRows.map((sr) => ({
                  size: sr.size.trim(),
                  stock: Number(sr.stock) || 0,
                })),
              );
              onSave({
                model: form.model.trim(),
                stockBySize,
                purchaseCost: Number(form.purchaseCost),
                salePrice: Number(form.salePrice),
                minStock: Number(form.minStock),
                entryDate: form.entryDate,
              });
            }}
          >
            <Field
              label="Modelo / estampa"
              value={form.model}
              onChange={(v) => setForm((f) => ({ ...f, model: v }))}
            />
            <div className="rounded-md border border-[var(--border-subtle)] p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                  Talles y stock
                </span>
                <button
                  type="button"
                  onClick={addSizeRow}
                  className="text-[11px] text-[var(--foreground-muted)] underline"
                >
                  + Talle
                </button>
              </div>
              <div className="space-y-2">
                {form.sizeRows.map((sr, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <Field
                      label="Talle"
                      value={sr.size}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          sizeRows: f.sizeRows.map((r, j) =>
                            j === i ? { ...r, size: v } : r,
                          ),
                        }))
                      }
                      className="min-w-[72px] flex-1"
                    />
                    <Field
                      label="Uds"
                      type="number"
                      value={String(sr.stock)}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          sizeRows: f.sizeRows.map((r, j) =>
                            j === i
                              ? { ...r, stock: Number(v) || 0 }
                              : r,
                          ),
                        }))
                      }
                      className="w-24"
                    />
                    {form.sizeRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSizeRow(i)}
                        className="mb-0.5 text-[11px] text-[var(--danger)]"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Costo unitario de producción"
                type="number"
                value={String(form.purchaseCost)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, purchaseCost: Number(v) }))
                }
              />
              <Field
                label="Precio"
                type="number"
                value={String(form.salePrice)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, salePrice: Number(v) }))
                }
              />
              <Field
                label="Stock mínimo"
                type="number"
                value={String(form.minStock)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, minStock: Number(v) }))
                }
              />
              <Field
                label="Fecha ingreso"
                type="date"
                value={form.entryDate}
                onChange={(v) => setForm((f) => ({ ...f, entryDate: v }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[var(--surface-inverted)] py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
              >
                Guardar
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

function EditFamilyModal({
  family,
  onClose,
  onSave,
}: {
  family: ProductFamily;
  onClose: () => void;
  onSave: (patch: Partial<ProductFamily>) => void;
}) {
  const [name, setName] = useState(family.name);
  const [category, setCategory] = useState(family.category);
  const [entryDate, setEntryDate] = useState(family.entryDate.slice(0, 10));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader title="Editar prenda" />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSave({
                name: name.trim(),
                category,
                entryDate,
              });
            }}
          >
            <Field
              label="Nombre de la prenda"
              value={name}
              onChange={setName}
              required
            />
            <label className="block text-xs font-medium">
              Categoría
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ProductCategory)
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Fecha de ingreso"
              type="date"
              value={entryDate}
              onChange={setEntryDate}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[var(--surface-inverted)] py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
              >
                Guardar
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

function AddVariantModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (v: ProductVariantInput) => void;
}) {
  const [form, setForm] = useState<VariantDraft>(() => emptyVariant());

  function addSizeRow() {
    setForm((f) => ({
      ...f,
      sizeRows: [...f.sizeRows, emptySizeRow()],
    }));
  }

  function removeSizeRow(i: number) {
    setForm((f) => {
      const next = f.sizeRows.filter((_, j) => j !== i);
      return { ...f, sizeRows: next.length ? next : [emptySizeRow()] };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader title="Nueva variante / modelo" />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.model.trim()) return;
              onSave({
                model: form.model.trim(),
                sizeStocks: form.sizeRows.map((sr) => ({
                  size: sr.size.trim(),
                  stock: Number(sr.stock) || 0,
                })),
                purchaseCost: form.purchaseCost,
                salePrice: form.salePrice,
                minStock: form.minStock,
              });
            }}
          >
            <Field
              label="Modelo / estampa"
              value={form.model}
              onChange={(v) => setForm((f) => ({ ...f, model: v }))}
            />
            <div className="rounded-md border border-[var(--border-subtle)] p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                  Talles y stock
                </span>
                <button
                  type="button"
                  onClick={addSizeRow}
                  className="text-[11px] text-[var(--foreground-muted)] underline"
                >
                  + Talle
                </button>
              </div>
              <div className="space-y-2">
                {form.sizeRows.map((sr, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <Field
                      label="Talle"
                      value={sr.size}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          sizeRows: f.sizeRows.map((r, j) =>
                            j === i ? { ...r, size: v } : r,
                          ),
                        }))
                      }
                      className="min-w-[72px] flex-1"
                    />
                    <Field
                      label="Uds"
                      type="number"
                      value={String(sr.stock)}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          sizeRows: f.sizeRows.map((r, j) =>
                            j === i
                              ? { ...r, stock: Number(v) || 0 }
                              : r,
                          ),
                        }))
                      }
                      className="w-24"
                    />
                    {form.sizeRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSizeRow(i)}
                        className="mb-0.5 text-[11px] text-[var(--danger)]"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Costo unitario de producción"
                type="number"
                value={String(form.purchaseCost)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, purchaseCost: Number(v) }))
                }
              />
              <Field
                label="Precio"
                type="number"
                value={String(form.salePrice)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, salePrice: Number(v) }))
                }
              />
              <Field
                label="Stock mínimo"
                type="number"
                value={String(form.minStock)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, minStock: Number(v) }))
                }
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[var(--surface-inverted)] py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
              >
                Guardar
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <label
      className={`text-xs font-medium text-[var(--foreground-muted)] ${className}`}
    >
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
      />
    </label>
  );
}
