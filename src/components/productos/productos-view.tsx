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
import type { ProductVariantInput } from "@/contexts/data-context";
import type { Product, ProductCategory, ProductFamily } from "@/lib/data/types";
import {
  formatStockBySizeSummary,
  sizeStockRowsFromProduct,
  stockMapFromSizeRows,
} from "@/lib/data/stock-helpers";
import { formatCurrency, formatDate } from "@/lib/format";

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

  const [creating, setCreating] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Product | null>(null);
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(
    null,
  );
  const [addingVariantFor, setAddingVariantFor] = useState<string | null>(
    null,
  );
  const [showCostosHint, setShowCostosHint] = useState(false);

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

  function isOpen(familyId: string) {
    return expanded[familyId] !== false;
  }

  function toggle(familyId: string) {
    setExpanded((e) => ({
      ...e,
      [familyId]: e[familyId] === false,
    }));
  }

  return (
    <div className="space-y-6">
      {showCostosHint ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
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
            className="shrink-0 text-xs font-medium text-emerald-800 underline dark:text-emerald-200"
            onClick={() => setShowCostosHint(false)}
          >
            Ocultar
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto flex flex-wrap gap-2 text-xs">
          <span className="self-center text-zinc-500">Stock:</span>
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
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950"
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
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Nuevo producto
          </button>
          <p className="max-w-xs text-right text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            Usar solo para crear un producto por primera vez (familia + variantes).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="Productos y variantes" />
        <CardContent className="overflow-x-auto p-0">
          <div className="space-y-3 p-3 md:hidden">
            {grouped.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
                {filter === "all" ? "No hay productos cargados." : "Nada coincide con este filtro."}
              </p>
            ) : (
              grouped.map(({ family, variants, allVariants }) => (
                <div key={family.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{family.name}</p>
                      <p className="text-xs text-zinc-500">{family.category} · Ingreso {formatDate(family.entryDate)}</p>
                    </div>
                    <p className="text-xs text-zinc-500">{allVariants.length} variante{allVariants.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingFamily(family)}
                      className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Editar prenda
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingVariantFor(family.id)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {variants.map((p) => {
                      const st = stockStatus(p);
                      return (
                        <div key={p.id} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{p.model || "Sin modelo"}</p>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              st === "agotado"
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : st === "bajo"
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                  : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                            }`}>
                              {st === "agotado" ? "Agotado" : st === "bajo" ? "Bajo" : "OK"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{formatStockBySizeSummary(p)}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <p><span className="text-zinc-500">Costo:</span> <span className="font-medium tabular-nums">{formatCurrency(p.purchaseCost)}</span></p>
                            <p><span className="text-zinc-500">Precio:</span> <span className="font-medium tabular-nums">{formatCurrency(p.salePrice)}</span></p>
                            <p><span className="text-zinc-500">Stock:</span> <span className="font-medium tabular-nums">{p.stock}</span></p>
                            <p><span className="text-zinc-500">Mín.:</span> <span className="font-medium tabular-nums">{p.minStock}</span></p>
                          </div>
                          <div className="mt-2 flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => adjustStock(p.id, 1)}
                              className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustStock(p.id, -1)}
                              className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            >
                              −1
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingVariant(p)}
                              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
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
                              className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                              aria-label="Eliminar variante"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <table className="hidden w-full min-w-[880px] text-left text-sm md:table">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="w-10 px-2 py-3" />
                <th className="px-4 py-3">Prenda</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Stock por talle</th>
                <th className="px-4 py-3 text-right">Costo unit. prod.</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Stock disp.</th>
                <th className="px-4 py-3 text-right">Mín.</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {grouped.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    {filter === "all"
                      ? "No hay productos cargados."
                      : "Nada coincide con este filtro."}
                  </td>
                </tr>
              ) : (
                grouped.map(({ family, variants, allVariants }) => {
                  const open = isOpen(family.id);
                  return (
                    <Fragment key={family.id}>
                      <tr className="bg-zinc-100/90 dark:bg-zinc-900/80">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggle(family.id)}
                            className="rounded p-1 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
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
                        <td className="px-4 py-2 font-semibold" colSpan={2}>
                          {family.name}
                          <span className="ml-2 font-normal text-zinc-500">
                            · {family.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-500" colSpan={3}>
                          Ingreso {formatDate(family.entryDate)}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-zinc-500" colSpan={2}>
                          {allVariants.length} variante
                          {allVariants.length === 1 ? "" : "s"}
                        </td>
                        <td className="px-4 py-2" colSpan={2}>
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingFamily(family)}
                              className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            >
                              Editar prenda
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingVariantFor(family.id)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
                              className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open
                        ? variants.map((p) => {
                            const st = stockStatus(p);
                            const rowClass =
                              st === "agotado"
                                ? "bg-red-50/50 dark:bg-red-950/20"
                                : st === "bajo"
                                  ? "bg-amber-50/40 dark:bg-amber-950/15"
                                  : "";
                            return (
                              <tr
                                key={p.id}
                                className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 ${rowClass}`}
                              >
                                <td />
                                <td className="px-4 py-2.5 text-zinc-400">—</td>
                                <td className="px-4 py-2.5">{p.model || "—"}</td>
                                <td className="max-w-[220px] px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                                  {formatStockBySizeSummary(p)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {formatCurrency(p.purchaseCost)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {formatCurrency(p.salePrice)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                                  {p.stock}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                                  {p.minStock}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      st === "agotado"
                                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                        : st === "bajo"
                                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                                    }`}
                                  >
                                    {st === "agotado"
                                      ? "Agotado"
                                      : st === "bajo"
                                        ? "Bajo"
                                        : "OK"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-wrap items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => adjustStock(p.id, 1)}
                                      className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                    >
                                      +1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => adjustStock(p.id, -1)}
                                      className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                    >
                                      −1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingVariant(p)}
                                      className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
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
                                      className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                                      aria-label="Eliminar variante"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
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
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nombre de la prenda
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>

            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Variantes
                </p>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-700"
                >
                  <Plus className="h-3 w-3" />
                  Agregar variante
                </button>
              </div>
              <div className="space-y-3">
                {variants.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="mb-2 flex justify-end">
                      {variants.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-xs text-red-600 hover:underline"
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
                      <div className="rounded-md border border-zinc-100 p-2 dark:border-zinc-800">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                            Talles y stock
                          </span>
                          <button
                            type="button"
                            onClick={() => addSizeRow(i)}
                            className="text-[11px] text-zinc-600 underline dark:text-zinc-400"
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
                                  className="mb-0.5 text-[11px] text-red-600"
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
            <div className="rounded-md border border-zinc-100 p-2 dark:border-zinc-800">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Talles y stock
                </span>
                <button
                  type="button"
                  onClick={addSizeRow}
                  className="text-[11px] text-zinc-600 underline dark:text-zinc-400"
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
                        className="mb-0.5 text-[11px] text-red-600"
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
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
            <div className="rounded-md border border-zinc-100 p-2 dark:border-zinc-800">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Talles y stock
                </span>
                <button
                  type="button"
                  onClick={addSizeRow}
                  className="text-[11px] text-zinc-600 underline dark:text-zinc-400"
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
                        className="mb-0.5 text-[11px] text-red-600"
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
      className={`text-xs font-medium text-zinc-600 dark:text-zinc-400 ${className}`}
    >
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
