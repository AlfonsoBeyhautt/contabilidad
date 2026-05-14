"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { useChartColors } from "@/contexts/theme-context";
import { usePeriod } from "@/contexts/period-context";
import {
  expensesByCategory,
  filterDefectivesInRange,
  filterExpensesInRange,
  missingRecurrenceAccrualByCategory,
} from "@/lib/data/finance-calcs";
import type {
  Expense,
  ExpenseCategory,
  ExpenseKind,
  ExpenseRecurrence,
  PaymentMethod,
  RecurrenceFrequency,
} from "@/lib/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { DefectuososSection } from "@/components/defectuosos/defectuosos-view";

const expenseCats: ExpenseCategory[] = [
  "producción",
  "marketing",
  "envíos",
  "otros",
];

const expenseCatLabel: Record<ExpenseCategory, string> = {
  producción: "Producción",
  marketing: "Marketing",
  "envíos": "Envíos",
  otros: "Otros",
};

const payments: PaymentMethod[] = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "otro",
];

const freqLabel: Record<RecurrenceFrequency, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  anual: "Anual",
};

type GastosSubTab = "gastos" | "recurrentes" | "defectuosos";

export function GastosView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpenseRecurrence,
    updateExpenseRecurrence,
    deleteExpenseRecurrence,
  } = useAppData();
  const { range } = usePeriod();
  const chart = useChartColors();
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [openRec, setOpenRec] = useState(false);

  const subRaw = searchParams.get("sub");
  const tab: GastosSubTab =
    subRaw === "recurrentes" || subRaw === "defectuosos" ? subRaw : "gastos";

  function setSubTab(next: GastosSubTab) {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "gastos") p.delete("sub");
    else p.set("sub", next);
    const q = p.toString();
    router.replace(q ? `/gastos?${q}` : "/gastos", { scroll: false });
  }

  const recurrences = data.expenseRecurrences ?? [];

  const filtered = useMemo(
    () =>
      filterExpensesInRange(data.expenses, range).sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [data.expenses, range],
  );

  const byCat = expensesByCategory(filtered);
  const recurrenceGap = useMemo(
    () => missingRecurrenceAccrualByCategory(data, range),
    [data, range],
  );
  const defectiveLoss = useMemo(() => {
    const list = filterDefectivesInRange(data.defectives ?? [], range);
    return list.reduce((a, d) => a + d.quantity * d.unitCost, 0);
  }, [data.defectives, range]);

  const chartData = useMemo(
    () => [
      ...expenseCats.map((c) => ({
        categoria: expenseCatLabel[c],
        monto: (byCat[c] ?? 0) + (recurrenceGap[c] ?? 0),
      })),
      { categoria: "Defectuosos", monto: defectiveLoss },
    ],
    [byCat, recurrenceGap, defectiveLoss],
  );

  const totalEgresosPeriodo = useMemo(
    () => chartData.reduce((a, r) => a + r.monto, 0),
    [chartData],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab("gastos")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "gastos"
                ? "bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)]"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Gastos registrados
          </button>
          <button
            type="button"
            onClick={() => setSubTab("recurrentes")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "recurrentes"
                ? "bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)]"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Gastos recurrentes
          </button>
          <button
            type="button"
            onClick={() => setSubTab("defectuosos")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "defectuosos"
                ? "bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)]"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Defectuosos
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubTab("gastos");
            setEditingExpense(null);
            setOpen(true);
          }}
          className="shrink-0 rounded-lg bg-[var(--surface-inverted)] px-4 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
        >
          Registrar gasto
        </button>
      </div>

      {tab === "gastos" ? (
        <>
          <div className="flex flex-wrap justify-between gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4">
              <p className="text-xs font-medium text-[var(--foreground-muted)]">
                Total egresos del período (gastos + recurrentes proyectados +
                defectuosos)
              </p>
              <p className="text-xl font-semibold tabular-nums text-[var(--foreground-strong)]">
                {formatCurrency(totalEgresosPeriodo)}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader
              title="Gastos por categoría"
              subtitle="Gastos emitidos y proyección de recurrentes en el período seleccionado."
            />
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v ?? 0))}
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${chart.tooltipBorder}`,
                      background: chart.tooltipBg,
                      color: chart.tooltipColor,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="monto" fill={chart.barAlt} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Gastos registrados" />
            <CardContent className="overflow-x-auto p-0">
              <div className="space-y-3 p-3 md:hidden">
                {filtered.map((e) => (
                  <div key={e.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[var(--foreground-muted)]">{formatDate(e.date)}</p>
                      <span className="capitalize text-xs text-[var(--foreground-muted)]">{e.paymentMethod}</span>
                    </div>
                    <p className="mt-2 font-medium">
                      {e.description}
                      {e.fromRecurrenceId ? (
                        <span className="ml-1 text-[10px] text-[var(--foreground-subtle)]">(auto)</span>
                      ) : null}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p><span className="text-[var(--foreground-muted)]">Categoría:</span> <span className="font-medium">{expenseCatLabel[e.category] ?? e.category}</span></p>
                      <p><span className="text-[var(--foreground-muted)]">Tipo:</span> <span className="font-medium">{e.kind}</span></p>
                      <p className="col-span-2"><span className="text-[var(--foreground-muted)]">Monto:</span> <span className="font-medium tabular-nums">{formatCurrency(e.amount)}</span></p>
                    </div>
                    <div className="mt-3 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpense(e);
                          setOpen(true);
                        }}
                        className="rounded p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                        aria-label="Editar gasto"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              "¿Eliminar este gasto? Se actualizarán reportes y totales.",
                            )
                          ) {
                            deleteExpense(e.id);
                          }
                        }}
                        className="rounded p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                        aria-label="Eliminar gasto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <table className="hidden w-full min-w-[800px] text-left text-sm md:table">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--foreground-muted)]/50">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        {expenseCatLabel[e.category] ?? e.category}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3">
                        {e.description}
                        {e.fromRecurrenceId ? (
                          <span className="ml-1 text-[10px] text-[var(--foreground-subtle)]">
                            (auto)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(e.amount)}
                      </td>
                      <td className="px-4 py-3 capitalize">{e.paymentMethod}</td>
                      <td className="px-4 py-3">{e.kind}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(e);
                              setOpen(true);
                            }}
                            className="rounded p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
                            aria-label="Editar gasto"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  "¿Eliminar este gasto? Se actualizarán reportes y totales.",
                                )
                              ) {
                                deleteExpense(e.id);
                              }
                            }}
                            className="rounded p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                            aria-label="Eliminar gasto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {tab === "recurrentes" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-[var(--foreground-muted)]">
              Los gastos generados cuentan igual que un gasto manual en reportes
              y dashboard.
            </p>
            <button
              type="button"
              onClick={() => setOpenRec(true)}
              className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
            >
              Nueva recurrencia
            </button>
          </div>
          <Card>
            <CardHeader
              title="Gastos recurrentes"
              subtitle="Generan un gasto automático cuando llega la próxima fecha"
            />
            <CardContent className="overflow-x-auto p-0">
              <div className="space-y-3 p-3 md:hidden">
                {recurrences.map((r) => (
                  <div key={r.id} className="rounded-lg border border-[var(--border)] p-3">
                    <p className="font-medium">{r.description}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p><span className="text-[var(--foreground-muted)]">Monto:</span> <span className="font-medium tabular-nums">{formatCurrency(r.amount)}</span></p>
                      <p><span className="text-[var(--foreground-muted)]">Frecuencia:</span> <span className="font-medium">{freqLabel[r.frequency]}</span></p>
                      <p><span className="text-[var(--foreground-muted)]">Próxima:</span> <span className="font-medium tabular-nums">{r.nextRunAt}</span></p>
                      <p>
                        <span className="text-[var(--foreground-muted)]">Estado:</span>{" "}
                        <span className={r.paused ? "text-[var(--warning)]" : "text-[var(--success)]"}>
                          {r.paused ? "Pausado" : "Activo"}
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 flex justify-end gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          updateExpenseRecurrence(r.id, { paused: !r.paused })
                        }
                        className="text-[var(--foreground-muted)] underline"
                      >
                        {r.paused ? "Reactivar" : "Pausar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              "¿Eliminar esta recurrencia? No borra gastos ya generados.",
                            )
                          ) {
                            deleteExpenseRecurrence(r.id);
                          }
                        }}
                        className="text-[var(--danger)] underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <table className="hidden w-full min-w-[800px] text-left text-sm md:table">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--foreground-muted)]/50">
                  <tr>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Frecuencia</th>
                    <th className="px-4 py-3">Próxima fecha</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {recurrences.map((r) => (
                    <tr key={r.id}>
                      <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                        {r.description}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-4 py-3">{freqLabel[r.frequency]}</td>
                      <td className="px-4 py-3 tabular-nums">{r.nextRunAt}</td>
                      <td className="px-4 py-3">
                        {r.paused ? (
                          <span className="text-[var(--warning)]">
                            Pausado
                          </span>
                        ) : (
                          <span className="text-[var(--success)]">
                            Activo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            updateExpenseRecurrence(r.id, { paused: !r.paused })
                          }
                          className="mr-2 text-xs text-[var(--foreground-muted)] underline"
                        >
                          {r.paused ? "Reactivar" : "Pausar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                "¿Eliminar esta recurrencia? No borra gastos ya generados.",
                              )
                            ) {
                              deleteExpenseRecurrence(r.id);
                            }
                          }}
                          className="text-xs text-[var(--danger)] underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recurrences.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--foreground-muted)]">
                  No hay recurrencias. Creá una con &quot;Nueva recurrencia&quot;.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {tab === "defectuosos" ? <DefectuososSection /> : null}

      {open ? (
        <ExpenseModal
          key={editingExpense?.id ?? "__create__"}
          initial={editingExpense}
          onClose={() => {
            setOpen(false);
            setEditingExpense(null);
          }}
          onCreate={(row) => {
            addExpense(row);
            setOpen(false);
            setEditingExpense(null);
          }}
          onUpdate={(row) => {
            updateExpense(row);
            setOpen(false);
            setEditingExpense(null);
          }}
        />
      ) : null}

      {openRec ? (
        <RecurrenceModal
          onClose={() => setOpenRec(false)}
          onSubmit={(row) => {
            addExpenseRecurrence(row);
            setOpenRec(false);
          }}
        />
      ) : null}
    </div>
  );
}

function expenseFormFromInitial(initial: Expense | null) {
  if (!initial) {
    return {
      date: new Date().toISOString().slice(0, 10),
      category: "producción" as ExpenseCategory,
      description: "",
      amount: 0,
      paymentMethod: "transferencia" as PaymentMethod,
      kind: "variable" as ExpenseKind,
      receiptNote: "",
    };
  }
  const d = initial.date.includes("T")
    ? initial.date.slice(0, 10)
    : initial.date.slice(0, 10);
  return {
    date: d,
    category: initial.category,
    description: initial.description,
    amount: initial.amount,
    paymentMethod: initial.paymentMethod,
    kind: initial.kind,
    receiptNote: initial.receiptNote ?? "",
  };
}

function ExpenseModal({
  onClose,
  onCreate,
  onUpdate,
  initial,
}: {
  onClose: () => void;
  onCreate: (row: Omit<Expense, "id">) => void;
  onUpdate: (row: Expense) => void;
  initial: Expense | null;
}) {
  const [form, setForm] = useState(() => expenseFormFromInitial(initial));
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader title={initial ? "Editar gasto" : "Nuevo gasto"} />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitError(null);
              const desc = form.description.trim();
              const amt = Number(form.amount);
              if (!desc) {
                setSubmitError("La descripción es obligatoria.");
                return;
              }
              if (!Number.isFinite(amt) || amt <= 0) {
                setSubmitError("El monto debe ser mayor a cero.");
                return;
              }
              const base = {
                date: new Date(form.date + "T12:00:00").toISOString(),
                category: form.category,
                description: desc,
                amount: amt,
                paymentMethod: form.paymentMethod,
                kind: form.kind,
                receiptNote: form.receiptNote || undefined,
              };
              try {
                if (initial) {
                  onUpdate({
                    ...base,
                    id: initial.id,
                    fromRecurrenceId: initial.fromRecurrenceId ?? null,
                  });
                } else {
                  onCreate(base);
                }
              } catch (err) {
                setSubmitError(
                  err instanceof Error
                    ? err.message
                    : "No se pudo guardar el gasto.",
                );
              }
            }}
          >
            {submitError ? (
              <p
                role="alert"
                className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
              >
                {submitError}
              </p>
            ) : null}
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
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
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Categoría
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as ExpenseCategory,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              >
                {expenseCats.map((c) => (
                  <option key={c} value={c}>
                    {expenseCatLabel[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Descripción
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Monto
              <input
                type="number"
                required
                min={0}
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Pago
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: e.target.value as PaymentMethod,
                    }))
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
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Fijo / variable
                <select
                  value={form.kind}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      kind: e.target.value as ExpenseKind,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                >
                  <option value="fijo">fijo</option>
                  <option value="variable">variable</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Nota comprobante (opcional)
              <input
                value={form.receiptNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, receiptNote: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
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

function RecurrenceModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (row: Omit<ExpenseRecurrence, "id">) => void;
}) {
  const [form, setForm] = useState({
    description: "",
    amount: 0,
    category: "producción" as ExpenseCategory,
    paymentMethod: "transferencia" as PaymentMethod,
    kind: "fijo" as ExpenseKind,
    frequency: "mensual" as RecurrenceFrequency,
    startDate: new Date().toISOString().slice(0, 10),
    nextRunAt: new Date().toISOString().slice(0, 10),
    endDate: "",
    paused: false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-md overflow-y-auto">
        <CardHeader
          title="Nueva recurrencia"
          subtitle="Se creará un gasto automático cada vez que se cumpla la fecha"
        />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit({
                description: form.description.trim(),
                amount: Number(form.amount),
                category: form.category,
                paymentMethod: form.paymentMethod,
                kind: form.kind,
                frequency: form.frequency,
                startDate: form.startDate,
                nextRunAt: form.nextRunAt,
                endDate: form.endDate.trim() || undefined,
                paused: form.paused,
              });
            }}
          >
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Descripción
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Monto
              <input
                type="number"
                min={0}
                required
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Frecuencia
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    frequency: e.target.value as RecurrenceFrequency,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              >
                {(Object.keys(freqLabel) as RecurrenceFrequency[]).map((k) => (
                  <option key={k} value={k}>
                    {freqLabel[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Fecha inicio
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Próxima emisión
                <input
                  type="date"
                  required
                  value={form.nextRunAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nextRunAt: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Fin opcional (dejar vacío = sin fin)
              <input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Categoría
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as ExpenseCategory,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              >
                {expenseCats.map((c) => (
                  <option key={c} value={c}>
                    {expenseCatLabel[c]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Pago
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: e.target.value as PaymentMethod,
                    }))
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
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Tipo
                <select
                  value={form.kind}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      kind: e.target.value as ExpenseKind,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                >
                  <option value="fijo">fijo</option>
                  <option value="variable">variable</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
              <input
                type="checkbox"
                checked={form.paused}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paused: e.target.checked }))
                }
              />
              Crear pausado
            </label>
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
