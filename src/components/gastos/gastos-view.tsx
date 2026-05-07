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
  periodMetrics,
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

  const prevMetrics = useMemo(() => {
    const len =
      (range.end.getTime() - range.start.getTime()) / 86400000 + 1;
    const prevEnd = new Date(range.start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (len - 1) * 86400000);
    return periodMetrics(data, { start: prevStart, end: prevEnd });
  }, [data, range]);

  const currentTotal = filtered.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab("gastos")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "gastos"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            Gastos registrados
          </button>
          <button
            type="button"
            onClick={() => setSubTab("recurrentes")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "recurrentes"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            Gastos recurrentes
          </button>
          <button
            type="button"
            onClick={() => setSubTab("defectuosos")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "defectuosos"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
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
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Registrar gasto
        </button>
      </div>

      {tab === "gastos" ? (
        <>
          <div className="flex flex-wrap justify-between gap-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Total gastos registrados (período)
              </p>
              <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatCurrency(currentTotal)}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                La gráfica incluye una barra aparte por defectuosos (no se suma
                aquí). vs período anterior simétrico:{" "}
                <span
                  className={
                    currentTotal <= prevMetrics.expenses
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {formatCurrency(prevMetrics.expenses)}
                </span>
              </p>
            </div>
          </div>

          <Card>
            <CardHeader
              title="Gastos por categoría"
              subtitle="Período seleccionado: suma gastos registrados (incl. automáticos) más cuotas recurrentes aún no emitidas en el período; barra aparte por defectuosos"
            />
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
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
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
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
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        {expenseCatLabel[e.category] ?? e.category}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3">
                        {e.description}
                        {e.fromRecurrenceId ? (
                          <span className="ml-1 text-[10px] text-zinc-400">
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
                            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
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
                            className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
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
            <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              Los gastos generados cuentan igual que un gasto manual en reportes
              y dashboard.
            </p>
            <button
              type="button"
              onClick={() => setOpenRec(true)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
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
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Frecuencia</th>
                    <th className="px-4 py-3">Próxima fecha</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
                          <span className="text-amber-700 dark:text-amber-400">
                            Pausado
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">
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
                          className="mr-2 text-xs text-zinc-600 underline dark:text-zinc-400"
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
                          className="text-xs text-red-600 underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recurrences.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">
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
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
              >
                {submitError}
              </p>
            ) : null}
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Fecha
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Categoría
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as ExpenseCategory,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {expenseCats.map((c) => (
                  <option key={c} value={c}>
                    {expenseCatLabel[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Descripción
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Monto
              <input
                type="number"
                required
                min={0}
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Pago
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: e.target.value as PaymentMethod,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {payments.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Fijo / variable
                <select
                  value={form.kind}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      kind: e.target.value as ExpenseKind,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="fijo">fijo</option>
                  <option value="variable">variable</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nota comprobante (opcional)
              <input
                value={form.receiptNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, receiptNote: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
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
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Descripción
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Monto
              <input
                type="number"
                min={0}
                required
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Frecuencia
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    frequency: e.target.value as RecurrenceFrequency,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {(Object.keys(freqLabel) as RecurrenceFrequency[]).map((k) => (
                  <option key={k} value={k}>
                    {freqLabel[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Fecha inicio
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Próxima emisión
                <input
                  type="date"
                  required
                  value={form.nextRunAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nextRunAt: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Fin opcional (dejar vacío = sin fin)
              <input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Categoría
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as ExpenseCategory,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {expenseCats.map((c) => (
                  <option key={c} value={c}>
                    {expenseCatLabel[c]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Pago
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: e.target.value as PaymentMethod,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {payments.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Tipo
                <select
                  value={form.kind}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      kind: e.target.value as ExpenseKind,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="fijo">fijo</option>
                  <option value="variable">variable</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
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
