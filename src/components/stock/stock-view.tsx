"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { stockStatus } from "@/lib/data/finance-calcs";
import { formatCurrency } from "@/lib/format";

export function StockView() {
  const { data, adjustStock } = useAppData();

  const valuation = useMemo(
    () =>
      data.products.reduce(
        (a, p) => a + p.stock * p.purchaseCost,
        0,
      ),
    [data.products],
  );

  const low = data.products.filter((p) => stockStatus(p) === "bajo");
  const out = data.products.filter((p) => stockStatus(p) === "agotado");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Valor inventario (al costo)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(valuation)}
          </p>
        </div>
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
            Alertas stock bajo
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--warning)]">
            {low.length}
          </p>
        </div>
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--danger-soft)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--danger)]">
            Agotados
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--danger)]">
            {out.length}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="Ajustes rápidos de stock" />
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--foreground-muted)]/50">
              <tr>
                <th className="px-4 py-3">Variante</th>
                <th className="px-4 py-3 text-right">Stock disp.</th>
                <th className="px-4 py-3 text-right">Valor línea</th>
                <th className="px-4 py-3">Ajuste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.stock}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground-muted)]">
                    {formatCurrency(p.stock * p.purchaseCost)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => adjustStock(p.id, 1)}
                        className="rounded bg-[var(--surface-muted)] px-2 py-1 text-xs"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustStock(p.id, 5)}
                        className="rounded bg-[var(--surface-muted)] px-2 py-1 text-xs"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustStock(p.id, -1)}
                        className="rounded bg-[var(--surface-muted)] px-2 py-1 text-xs"
                      >
                        −1
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Productos agotados" />
          <CardContent>
            <ul className="space-y-2 text-sm">
              {out.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-[var(--danger)]">0 uds</span>
                </li>
              ))}
              {out.length === 0 ? (
                <li className="text-[var(--foreground-muted)]">Ninguno.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Stock bajo el mínimo" />
          <CardContent>
            <ul className="space-y-2 text-sm">
              {low.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-[var(--warning)]">
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
    </div>
  );
}
