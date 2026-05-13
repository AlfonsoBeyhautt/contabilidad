"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import {
  calendarItemsForMonth,
  type CalendarItem,
} from "@/lib/data/calendar-helpers";
import type {
  ExpenseCategory,
  ExpenseKind,
  PaymentMethod,
  ScheduledPayment,
} from "@/lib/data/types";
import { formatCurrency } from "@/lib/format";

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

const categoryDot: Record<ExpenseCategory, string> = {
  producción: "bg-[var(--surface-muted)]0",
  marketing: "bg-blue-500",
  "envíos": "bg-[var(--warning-soft)]0",
  otros: "bg-stone-400",
};

const payments: PaymentMethod[] = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "otro",
];

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function sourceBadge(source: CalendarItem["source"]) {
  if (source === "recurrence") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[9px] font-medium uppercase text-[var(--foreground)]">
        <RotateCcw className="h-2.5 w-2.5" aria-hidden /> Recurrente
      </span>
    );
  }
  if (source === "expense") {
    return (
      <span className="rounded bg-[var(--success-soft)] px-1 py-0.5 text-[9px] font-medium uppercase text-[var(--success)]">
        Manual
      </span>
    );
  }
  return (
    <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-medium uppercase text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
      Programado
    </span>
  );
}

export function CalendarioView() {
  const {
    data,
    addScheduledPayment,
    updateScheduledPayment,
    deleteScheduledPayment,
    markScheduledPaymentAsPaid,
    markScheduledPaymentAsPending,
  } = useAppData();
  const currency = data.settings.currency || "ARS";

  const [anchor, setAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ScheduledPayment | null>(null);

  const monthItems = useMemo(
    () => calendarItemsForMonth(data, anchor),
    [data, anchor],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of monthItems) {
      const list = m.get(it.date) ?? [];
      list.push(it);
      m.set(it.date, list);
    }
    return m;
  }, [monthItems]);

  const pending = monthItems.filter((i) => i.status === "pendiente");
  const paid = monthItems.filter((i) => i.status === "pagado");
  const pendingTotal = pending.reduce((a, i) => a + i.amount, 0);
  const paidTotal = paid.reduce((a, i) => a + i.amount, 0);
  const projectedTotal = pendingTotal + paidTotal;

  const today = startOfDay(new Date());
  const upcomingItems = useMemo(() => {
    const horizon = addDays(today, 7);
    const itemsThisMonth = monthItems;
    const itemsNextMonth =
      today.getMonth() !== horizon.getMonth()
        ? calendarItemsForMonth(data, horizon)
        : [];
    return [...itemsThisMonth, ...itemsNextMonth]
      .filter((it) => {
        if (it.status !== "pendiente") return false;
        const d = parseISO(`${it.date}T12:00:00`);
        return d >= today && d <= horizon;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [data, monthItems, today]);

  const grid = useMemo(() => {
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    const dayOfWeek = (start.getDay() + 6) % 7;
    const totalCells = Math.ceil((dayOfWeek + end.getDate()) / 7) * 7;
    const cells: { date: Date | null; key: string }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - dayOfWeek + 1;
      if (dayNum >= 1 && dayNum <= end.getDate()) {
        const d = new Date(start.getFullYear(), start.getMonth(), dayNum);
        cells.push({ date: d, key: format(d, "yyyy-MM-dd") });
      } else {
        cells.push({ date: null, key: `blank-${i}` });
      }
    }
    return cells;
  }, [anchor]);

  const selectedKey = selectedDay
    ? format(selectedDay, "yyyy-MM-dd")
    : null;
  const selectedItems = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  function handleMark(it: CalendarItem) {
    if (it.source === "scheduled") {
      if (it.status === "pendiente") {
        markScheduledPaymentAsPaid(it.refId);
      } else {
        if (
          confirm(
            "¿Marcar este pago como pendiente otra vez? Se eliminará el gasto creado.",
          )
        ) {
          markScheduledPaymentAsPending(it.refId);
        }
      }
    } else if (it.source === "recurrence") {
      alert(
        "Las cuotas de recurrencia se marcan automáticamente cuando se cumple la fecha. Si querés adelantar la liquidación, usá la sección Gastos.",
      );
    }
  }

  function handleDelete(it: CalendarItem) {
    if (it.source !== "scheduled") return;
    if (
      !confirm(
        "¿Eliminar este pago programado? Si ya estaba pagado, el gasto vinculado se conserva.",
      )
    )
      return;
    deleteScheduledPayment(it.refId);
  }

  function openEdit(it: CalendarItem) {
    if (it.source !== "scheduled") return;
    const sp = data.scheduledPayments.find((s) => s.id === it.refId);
    if (sp) {
      setEditing(sp);
      setShowCreate(true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAnchor((d) => subMonths(d, 1))}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <h2 className="text-lg font-semibold tracking-tight">
            {MONTHS_ES[anchor.getMonth()]} {anchor.getFullYear()}
          </h2>
          <button
            type="button"
            onClick={() => setAnchor((d) => addMonths(d, 1))}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setAnchor(startOfMonth(new Date()));
              setSelectedDay(startOfDay(new Date()));
            }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Hoy
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowCreate(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-inverted)] px-3 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Programar pago
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--foreground-muted)]">
            Total previsto del mes
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatCurrency(projectedTotal, currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            {pending.length + paid.length} pagos planificados
          </p>
        </div>
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--warning)]">
            Pendientes
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--warning)]">
            {formatCurrency(pendingTotal, currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--warning)]/80">
            {pending.length} pagos sin liquidar
          </p>
        </div>
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--success)_25%,transparent)] bg-[var(--success-soft)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--success)]">
            Pagados
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--success)]">
            {formatCurrency(paidTotal, currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--success)]/80">
            {paid.length} pagos liquidados
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Calendario mensual"
            subtitle="Cada día muestra pagos planificados, recurrencias proyectadas y gastos liquidados"
          />
          <CardContent>
            <div className="mb-2 grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase text-[var(--foreground-muted)]">
              {WEEKDAYS.map((w) => (
                <div key={w} className="px-1 text-center">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((cell) => {
                if (!cell.date) {
                  return (
                    <div
                      key={cell.key}
                      className="aspect-square rounded-lg bg-transparent"
                    />
                  );
                }
                const isCurrent = isToday(cell.date);
                const items = byDay.get(cell.key) ?? [];
                const selected =
                  selectedDay && isSameDay(selectedDay, cell.date);
                const pendingCount = items.filter(
                  (i) => i.status === "pendiente",
                ).length;
                const paidCount = items.filter(
                  (i) => i.status === "pagado",
                ).length;
                const dayTotal = items.reduce((a, i) => a + i.amount, 0);
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDay(cell.date)}
                    className={`flex aspect-square min-h-[64px] flex-col rounded-lg border p-1.5 text-left transition-colors ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : isCurrent
                          ? "border-[var(--border-strong)] bg-[var(--surface)]"
                          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-[11px] font-semibold ${
                          isCurrent
                            ? "rounded-full bg-[var(--surface-inverted)] px-1.5 text-[var(--foreground-on-inverted)]"
                            : "text-[var(--foreground)]"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {items.length > 0 ? (
                        <span className="text-[9px] tabular-nums text-[var(--foreground-muted)]">
                          {items.length}
                        </span>
                      ) : null}
                    </div>
                    {items.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {items.slice(0, 4).map((it) => (
                          <span
                            key={it.key}
                            className={`h-1.5 w-1.5 rounded-full ${
                              it.status === "pendiente"
                                ? "bg-[var(--warning-soft)]0"
                                : "bg-[var(--success-soft)]0"
                            }`}
                            title={`${it.description} — ${formatCurrency(it.amount, currency)}`}
                          />
                        ))}
                      </div>
                    ) : null}
                    {items.length > 0 ? (
                      <div className="mt-auto">
                        <p className="text-[9px] tabular-nums text-[var(--foreground-muted)]">
                          {pendingCount > 0
                            ? `${pendingCount} pend.`
                            : `${paidCount} pag.`}
                        </p>
                        <p className="text-[10px] font-medium tabular-nums text-[var(--foreground)]">
                          {formatCurrency(dayTotal, currency)}
                        </p>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                selectedDay
                  ? `Pagos del ${format(selectedDay, "dd/MM/yyyy")}`
                  : "Detalle del día"
              }
              subtitle={
                selectedDay
                  ? selectedItems.length === 0
                    ? "Sin pagos planificados"
                    : `${selectedItems.length} pago${selectedItems.length === 1 ? "" : "s"}`
                  : "Tocá un día del calendario para ver el detalle"
              }
            />
            <CardContent className="space-y-2 text-sm">
              {!selectedDay ? (
                <p className="text-xs text-[var(--foreground-muted)]">
                  Tocá un día del calendario para ver los pagos programados,
                  pendientes o ya pagados.
                </p>
              ) : selectedItems.length === 0 ? (
                <p className="text-xs text-[var(--foreground-muted)]">
                  No hay pagos en este día.
                </p>
              ) : (
                selectedItems.map((it) => (
                  <PaymentRow
                    key={it.key}
                    item={it}
                    currency={currency}
                    onToggle={() => handleMark(it)}
                    onEdit={() => openEdit(it)}
                    onDelete={() => handleDelete(it)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Próximos 7 días"
              subtitle={
                upcomingItems.length === 0
                  ? "Sin pagos pendientes en la próxima semana"
                  : "Pagos pendientes ordenados por fecha"
              }
              action={
                <AlertTriangle
                  className="h-4 w-4 text-amber-500"
                  aria-hidden
                />
              }
            />
            <CardContent className="space-y-2 text-sm">
              {upcomingItems.length === 0 ? (
                <p className="text-xs text-[var(--foreground-muted)]">
                  No hay pagos planificados para los próximos 7 días.
                </p>
              ) : (
                upcomingItems.map((it) => (
                  <div
                    key={it.key}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">{it.description}</p>
                      <p className="text-[10px] text-[var(--foreground-muted)]">
                        {format(parseISO(`${it.date}T12:00:00`), "dd/MM")} ·{" "}
                        {expenseCatLabel[it.category]}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">
                      {formatCurrency(it.amount, currency)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showCreate ? (
        <ScheduledPaymentModal
          initial={editing}
          defaultDate={
            selectedDay
              ? format(selectedDay, "yyyy-MM-dd")
              : format(new Date(), "yyyy-MM-dd")
          }
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onCreate={(row) => {
            addScheduledPayment(row);
            setShowCreate(false);
          }}
          onUpdate={(id, patch) => {
            updateScheduledPayment(id, patch);
            setShowCreate(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentRow({
  item,
  currency,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: CalendarItem;
  currency: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        item.status === "pendiente"
          ? "border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)]/40"
          : "border-[color-mix(in_oklab,var(--success)_25%,transparent)] bg-[var(--success-soft)]/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${categoryDot[item.category]}`}
              aria-hidden
            />
            <p className="truncate font-medium">{item.description}</p>
            {sourceBadge(item.source)}
          </div>
          <p className="mt-0.5 text-[10px] uppercase text-[var(--foreground-muted)]">
            {expenseCatLabel[item.category]} · {item.paymentMethod}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">
          {formatCurrency(item.amount, currency)}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
            item.status === "pendiente"
              ? "bg-[var(--warning-soft)] text-[var(--warning)]"
              : "bg-[var(--success-soft)] text-[var(--success)]"
          }`}
        >
          {item.status === "pendiente" ? (
            <>
              <CircleDashed className="h-3 w-3" aria-hidden /> Pendiente
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Pagado
            </>
          )}
        </span>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {item.source === "scheduled" ? (
            <>
              <button
                type="button"
                onClick={onToggle}
                className="font-medium text-[var(--foreground)] underline"
              >
                {item.status === "pendiente"
                  ? "Marcar como pagado"
                  : "Marcar pendiente"}
              </button>
              {item.status === "pendiente" ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-[var(--foreground-muted)] underline"
                >
                  Editar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-0.5 text-[var(--danger)] underline"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Eliminar
              </button>
            </>
          ) : item.source === "recurrence" ? (
            <button
              type="button"
              onClick={onToggle}
              className="text-[var(--foreground-muted)] underline"
            >
              Liquidar en Gastos
            </button>
          ) : (
            <span className="text-[var(--foreground-muted)]">Ya registrado en Gastos</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduledPaymentModal({
  initial,
  defaultDate,
  onClose,
  onCreate,
  onUpdate,
}: {
  initial: ScheduledPayment | null;
  defaultDate: string;
  onClose: () => void;
  onCreate: (row: Omit<ScheduledPayment, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<ScheduledPayment, "id">>) => void;
}) {
  const [form, setForm] = useState(() => ({
    description: initial?.description ?? "",
    amount: initial?.amount ?? 0,
    category: initial?.category ?? ("producción" as ExpenseCategory),
    paymentMethod:
      initial?.paymentMethod ?? ("transferencia" as PaymentMethod),
    kind: initial?.kind ?? ("variable" as ExpenseKind),
    dueDate: initial?.dueDate ?? defaultDate,
    note: initial?.note ?? "",
  }));
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-md overflow-y-auto">
        <CardHeader
          title={initial ? "Editar pago programado" : "Nuevo pago programado"}
          subtitle={
            initial
              ? "Cambios menores; para alternar pagado / pendiente usá el botón en el calendario."
              : "Sueldo, marketing, producción, envíos, etc."
          }
        />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const desc = form.description.trim();
              const amt = Number(form.amount);
              if (!desc) {
                setError("La descripción es obligatoria.");
                return;
              }
              if (!Number.isFinite(amt) || amt <= 0) {
                setError("El monto debe ser mayor a cero.");
                return;
              }
              if (!form.dueDate) {
                setError("Elegí una fecha de vencimiento.");
                return;
              }
              const base = {
                description: desc,
                amount: amt,
                category: form.category,
                paymentMethod: form.paymentMethod,
                kind: form.kind,
                dueDate: form.dueDate,
                note: form.note.trim() || undefined,
              };
              if (initial) {
                onUpdate(initial.id, base);
              } else {
                onCreate({
                  ...base,
                  paid: false,
                });
              }
            }}
          >
            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            ) : null}
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Descripción
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Ej: Sueldo Juan · Mayo"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
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
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Fecha
                <input
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                />
              </label>
            </div>
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
            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Nota (opcional)
              <input
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="Ej: a Banco Galicia, alias proveedor.x"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[var(--surface-inverted)] py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
              >
                {initial ? "Guardar cambios" : "Programar pago"}
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
