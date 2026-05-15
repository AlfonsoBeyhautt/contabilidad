"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { stockStatus } from "@/lib/data/finance-calcs";
import type { Product } from "@/lib/data/types";
import { formatCurrency } from "@/lib/format";

/** Estados visibles: agotado, bajo, en stock (sin sobrestock). */
function stockDisplayLevel(p: Product): "agotado" | "bajo" | "ok" {
  const s = stockStatus(p);
  if (s === "agotado") return "agotado";
  if (s === "bajo") return "bajo";
  return "ok";
}

function levelLabel(level: ReturnType<typeof stockDisplayLevel>): string {
  switch (level) {
    case "agotado":
      return "Agotado";
    case "bajo":
      return "Bajo";
    default:
      return "En stock";
  }
}

function levelCardClass(level: ReturnType<typeof stockDisplayLevel>): string {
  switch (level) {
    case "agotado":
      return "border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-[color-mix(in_oklab,var(--danger-soft)_55%,var(--surface))]";
    case "bajo":
      return "border-[color-mix(in_oklab,var(--warning)_28%,transparent)] bg-[color-mix(in_oklab,var(--warning-soft)_45%,var(--surface))]";
    default:
      return "border-[var(--border-subtle)] bg-[var(--surface)]";
  }
}

function levelBadgeClass(level: ReturnType<typeof stockDisplayLevel>): string {
  switch (level) {
    case "agotado":
      return "bg-[var(--danger-soft)] text-[var(--danger)]";
    case "bajo":
      return "bg-[var(--warning-soft)] text-[var(--warning)]";
    default:
      return "bg-[var(--success-soft)] text-[var(--success)]";
  }
}

function sortProductsByFamilyThenModel(
  products: Product[],
  families: { id: string; name: string }[],
): Product[] {
  const famMap = new Map(families.map((f) => [f.id, f]));
  return [...products].sort((a, b) => {
    const fa = famMap.get(a.familyId)?.name ?? "";
    const fb = famMap.get(b.familyId)?.name ?? "";
    const c1 = fa.localeCompare(fb, "es", { sensitivity: "base" });
    if (c1 !== 0) return c1;
    const c2 = a.model.localeCompare(b.model, "es", { sensitivity: "base" });
    if (c2 !== 0) return c2;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

export function StockView() {
  const { data, adjustStock } = useAppData();

  const valuation = useMemo(
    () => data.products.reduce((a, p) => a + p.stock * p.purchaseCost, 0),
    [data.products],
  );

  const totalUnits = useMemo(
    () => data.products.reduce((a, p) => a + p.stock, 0),
    [data.products],
  );

  const variantCount = data.products.length;

  const low = data.products.filter((p) => stockStatus(p) === "bajo");
  const out = data.products.filter((p) => stockStatus(p) === "agotado");

  const sortedProducts = useMemo(
    () => sortProductsByFamilyThenModel(data.products, data.productFamilies),
    [data.products, data.productFamilies],
  );

  const groupedByFamily = useMemo(() => {
    const famMap = new Map(data.productFamilies.map((f) => [f.id, f]));
    const groups: {
      familyId: string;
      familyName: string;
      products: Product[];
    }[] = [];
    for (const p of sortedProducts) {
      const familyName = famMap.get(p.familyId)?.name ?? "Sin familia";
      const last = groups[groups.length - 1];
      if (last && last.familyId === p.familyId) {
        last.products.push(p);
      } else {
        groups.push({
          familyId: p.familyId,
          familyName,
          products: [p],
        });
      }
    }
    return groups;
  }, [sortedProducts, data.productFamilies]);

  const sortedLow = useMemo(
    () => sortProductsByFamilyThenModel(low, data.productFamilies),
    [low, data.productFamilies],
  );

  const sortedOut = useMemo(
    () => sortProductsByFamilyThenModel(out, data.productFamilies),
    [out, data.productFamilies],
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Visión general
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)]">
              Inventario por familia de producto y estado de reposición.
            </p>
          </div>
          <Link
            href="/productos"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            Catálogo y variantes
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
              Valor inventario (al costo)
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--foreground-strong)]">
              {formatCurrency(valuation)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
              Unidades totales en stock
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--foreground-strong)]">
              {totalUnits}
            </p>
            <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
              {variantCount} variantes en catálogo
            </p>
          </div>
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">
              Bajo el mínimo
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--warning)]">
              {low.length}
            </p>
            <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
              SKU por debajo del stock mínimo
            </p>
          </div>
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--danger-soft)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">
              Agotados
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--danger)]">
              {out.length}
            </p>
            <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
              Sin unidades disponibles
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            Inventario por familia
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)]">
            Orden alfabético por tipo de prenda, modelo y variante. Los badges
            indican solo si hay que reponer.
          </p>
        </div>
        {groupedByFamily.map((group) => (
          <div key={group.familyId} className="space-y-3">
            <h3 className="border-b border-[var(--border-subtle)] pb-2 text-[13px] font-semibold tracking-tight text-[var(--foreground-strong)]">
              {group.familyName}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.products.map((p) => {
                const level = stockDisplayLevel(p);
                const lineValue = p.stock * p.purchaseCost;
                const secondary = [p.category, p.model].filter(Boolean).join(" · ");
                return (
                  <div
                    key={p.id}
                    className={`flex min-h-[156px] flex-col rounded-xl border p-3.5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-md ${levelCardClass(level)}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug text-[var(--foreground-strong)]">
                        {p.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-[var(--foreground-muted)]">
                        {secondary || "—"}
                      </p>
                      <p className="mt-3 text-[22px] font-semibold tabular-nums leading-none text-[var(--foreground-strong)]">
                        {p.stock}{" "}
                        <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                          uds
                        </span>
                      </p>
                      <p className="mt-1.5 text-[12px] tabular-nums text-[var(--foreground-muted)]">
                        {formatCurrency(lineValue)}{" "}
                        <span className="font-normal">al costo</span>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${levelBadgeClass(level)}`}
                      >
                        {levelLabel(level)}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => adjustStock(p.id, 1)}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold tabular-nums hover:bg-[var(--surface-muted)]"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustStock(p.id, 5)}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold tabular-nums hover:bg-[var(--surface-muted)]"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustStock(p.id, -1)}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold tabular-nums hover:bg-[var(--surface-muted)]"
                        >
                          −1
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            Alertas
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)]">
            Listas de seguimiento (mismo orden por familia que arriba).
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Agotados" />
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                {sortedOut.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--danger)]">
                      0 uds
                    </span>
                  </li>
                ))}
                {sortedOut.length === 0 ? (
                  <li className="text-[var(--foreground-muted)]">Ninguno.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Bajo el mínimo" />
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                {sortedLow.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--warning)]">
                      {p.stock} / min {p.minStock}
                    </span>
                  </li>
                ))}
                {sortedLow.length === 0 ? (
                  <li className="text-[var(--foreground-muted)]">Ninguno.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
