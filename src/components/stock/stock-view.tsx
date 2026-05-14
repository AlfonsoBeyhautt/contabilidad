"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { stockStatus } from "@/lib/data/finance-calcs";
import type { Product } from "@/lib/data/types";
import { formatCurrency } from "@/lib/format";

/** Nivel operativo para cards de inventario (incluye sobre-stock). */
function inventoryLevel(
  p: Product,
): "agotado" | "bajo" | "normal" | "sobre" {
  if (p.stock <= 0) return "agotado";
  if (p.stock <= p.minStock) return "bajo";
  const high = Math.max(p.minStock * 5, p.minStock + 15, 12);
  if (p.stock > high) return "sobre";
  return "normal";
}

function levelLabel(level: ReturnType<typeof inventoryLevel>): string {
  switch (level) {
    case "agotado":
      return "Agotado";
    case "bajo":
      return "Bajo";
    case "sobre":
      return "Sobre stock";
    default:
      return "OK";
  }
}

function levelCardClass(level: ReturnType<typeof inventoryLevel>): string {
  switch (level) {
    case "agotado":
      return "border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-[color-mix(in_oklab,var(--danger-soft)_55%,var(--surface))]";
    case "bajo":
      return "border-[color-mix(in_oklab,var(--warning)_28%,transparent)] bg-[color-mix(in_oklab,var(--warning-soft)_45%,var(--surface))]";
    case "sobre":
      return "border-[color-mix(in_oklab,var(--accent)_22%,transparent)] bg-[color-mix(in_oklab,var(--accent-soft)_35%,var(--surface))]";
    default:
      return "border-[var(--border-subtle)] bg-[var(--surface)]";
  }
}

function levelBadgeClass(level: ReturnType<typeof inventoryLevel>): string {
  switch (level) {
    case "agotado":
      return "bg-[var(--danger-soft)] text-[var(--danger)]";
    case "bajo":
      return "bg-[var(--warning-soft)] text-[var(--warning)]";
    case "sobre":
      return "bg-[var(--accent-soft)] text-[var(--accent)]";
    default:
      return "bg-[var(--success-soft)] text-[var(--success)]";
  }
}

export function StockView() {
  const { data, adjustStock } = useAppData();

  const valuation = useMemo(
    () =>
      data.products.reduce((a, p) => a + p.stock * p.purchaseCost, 0),
    [data.products],
  );

  const low = data.products.filter((p) => stockStatus(p) === "bajo");
  const out = data.products.filter((p) => stockStatus(p) === "agotado");
  const over = useMemo(
    () => data.products.filter((p) => inventoryLevel(p) === "sobre"),
    [data.products],
  );

  const skusOk = data.products.filter((p) => inventoryLevel(p) === "normal")
    .length;

  const sortedProducts = useMemo(() => {
    const rank: Record<string, number> = {
      agotado: 0,
      bajo: 1,
      sobre: 2,
      normal: 3,
    };
    return [...data.products].sort((a, b) => {
      const la = inventoryLevel(a);
      const lb = inventoryLevel(b);
      const d = rank[la] - rank[lb];
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });
  }, [data.products]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Visión general
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)]">
              Inventario valorizado y alertas operativas.
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
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--success)_22%,transparent)] bg-[color-mix(in_oklab,var(--success-soft)_40%,var(--surface))] px-4 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--success)]">
              SKUs en rango
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--foreground-strong)]">
              {skusOk}
            </p>
          </div>
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">
              Stock bajo mínimo
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--warning)]">
              {low.length}
            </p>
          </div>
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--danger-soft)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">
              Agotados
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--danger)]">
              {out.length}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            Ajustes rápidos
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)]">
            Variantes ordenadas por urgencia. Ajustes inmediatos sin tabla.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedProducts.map((p) => {
            const level = inventoryLevel(p);
            const lineValue = p.stock * p.purchaseCost;
            const title = p.name;
            const subtitle = p.category;
            return (
              <div
                key={p.id}
                className={`flex min-h-[148px] flex-col rounded-xl border p-3.5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-md ${levelCardClass(level)}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-snug text-[var(--foreground-strong)]">
                    {title}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-[var(--foreground-muted)]">
                    {subtitle}
                  </p>
                  <p className="mt-3 text-[22px] font-semibold tabular-nums leading-none text-[var(--foreground-strong)]">
                    {p.stock}{" "}
                    <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                      uds
                    </span>
                  </p>
                  <p className="mt-1.5 text-[12px] tabular-nums text-[var(--foreground-muted)]">
                    {formatCurrency(lineValue)}{" "}
                    <span className="font-normal">inventario</span>
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
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            Alertas
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)]">
            Listas compactas para seguimiento diario.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Agotados" />
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                {out.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--danger)]">
                      0 uds
                    </span>
                  </li>
                ))}
                {out.length === 0 ? (
                  <li className="text-[var(--foreground-muted)]">Ninguno.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Bajo el mínimo" />
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                {low.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--warning)]">
                      {p.stock} / min {p.minStock}
                    </span>
                  </li>
                ))}
                {low.length === 0 ? (
                  <li className="text-[var(--foreground-muted)]">Ninguno.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            Inteligencia de inventario
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)]">
            Capital detenido por exceso de unidades (heurística simple).
          </p>
        </div>
        <Card>
          <CardHeader
            title="Posible sobre-stock"
            subtitle="Unidades claramente por encima del mínimo operativo."
          />
          <CardContent>
            {over.length === 0 ? (
              <p className="flex items-center gap-2 text-[13px] text-[var(--foreground-muted)]">
                <Package className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                No hay SKUs marcados como sobre-stock con el criterio actual.
              </p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {over.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 font-medium">{p.name}</span>
                    <span className="tabular-nums text-[var(--foreground-muted)]">
                      {p.stock} uds · mín {p.minStock} ·{" "}
                      {formatCurrency(p.stock * p.purchaseCost)} al costo
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
