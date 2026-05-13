/**
 * Helpers para construir la vista del calendario de pagos.
 *
 * Fuentes:
 *  1) `scheduledPayments`            → pagos puntuales (pendientes y pagados)
 *  2) `expenses` con `fromRecurrenceId` → ocurrencias ya emitidas de recurrencias
 *  3) `expenseRecurrences`           → proyección futura de cuotas aún no emitidas
 *
 * Salida: lista de `CalendarItem` con fecha, monto, categoría, fuente y estado.
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type {
  AppData,
  Expense,
  ExpenseCategory,
  ExpenseRecurrence,
  PaymentMethod,
  ScheduledPayment,
} from "./types";

export type CalendarSource = "scheduled" | "recurrence" | "expense";

export interface CalendarItem {
  /** YYYY-MM-DD; siempre normalizado a fecha local (sin hora). */
  date: string;
  /** Identificador único dentro del calendario (item + fecha). */
  key: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  source: CalendarSource;
  status: "pendiente" | "pagado";
  /** Id del origen (scheduled_payments.id, expense_recurrences.id, expenses.id). */
  refId: string;
  /** Id del gasto creado al pagar (sólo si source = scheduled). */
  paidExpenseId?: string | null;
}

function bump(date: Date, freq: ExpenseRecurrence["frequency"]): Date {
  switch (freq) {
    case "semanal":
      return addWeeks(date, 1);
    case "quincenal":
      return addDays(date, 14);
    case "mensual":
      return addMonths(date, 1);
    case "trimestral":
      return addMonths(date, 3);
    case "anual":
      return addYears(date, 1);
  }
}

function unbump(date: Date, freq: ExpenseRecurrence["frequency"]): Date {
  switch (freq) {
    case "semanal":
      return addWeeks(date, -1);
    case "quincenal":
      return addDays(date, -14);
    case "mensual":
      return addMonths(date, -1);
    case "trimestral":
      return addMonths(date, -3);
    case "anual":
      return addYears(date, -1);
  }
}

function recurrenceOccurrencesInMonth(
  r: ExpenseRecurrence,
  monthStart: Date,
  monthEnd: Date,
): Date[] {
  if (r.paused) return [];
  const recEnd = r.endDate
    ? startOfDay(parseISO(`${r.endDate}T12:00:00`))
    : null;
  const next = startOfDay(parseISO(`${r.nextRunAt}T12:00:00`));

  const out = new Set<string>();
  const push = (d: Date) => {
    out.add(format(d, "yyyy-MM-dd"));
  };

  // Caminamos hacia atrás desde nextRunAt
  let cursor = next;
  let guard = 0;
  while (guard < 240 && !isBefore(cursor, monthStart)) {
    guard++;
    if (recEnd && isAfter(cursor, recEnd)) {
      cursor = unbump(cursor, r.frequency);
      continue;
    }
    if (!isBefore(cursor, monthStart) && !isAfter(cursor, monthEnd)) {
      push(cursor);
    }
    cursor = unbump(cursor, r.frequency);
  }

  // Hacia adelante
  cursor = bump(next, r.frequency);
  guard = 0;
  while (guard < 240 && !isAfter(cursor, monthEnd)) {
    guard++;
    if (recEnd && isAfter(cursor, recEnd)) break;
    if (!isBefore(cursor, monthStart) && !isAfter(cursor, monthEnd)) {
      push(cursor);
    }
    cursor = bump(cursor, r.frequency);
  }

  return [...out]
    .sort()
    .map((s) => startOfDay(parseISO(`${s}T12:00:00`)));
}

/**
 * Genera todos los items del calendario para el mes pasado como ancla.
 * Combina las tres fuentes y deduplica recurrencias ya pagadas (el expense
 * "auto" gana sobre la proyección).
 */
export function calendarItemsForMonth(
  data: AppData,
  monthAnchor: Date,
): CalendarItem[] {
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);

  const out: CalendarItem[] = [];

  // 1) Pagos programados puntuales
  for (const sp of data.scheduledPayments ?? []) {
    const due = startOfDay(parseISO(`${sp.dueDate}T12:00:00`));
    if (isBefore(due, monthStart) || isAfter(due, monthEnd)) continue;
    out.push({
      date: format(due, "yyyy-MM-dd"),
      key: `scheduled:${sp.id}`,
      description: sp.description,
      amount: sp.amount,
      category: sp.category,
      paymentMethod: sp.paymentMethod,
      source: "scheduled",
      status: sp.paid ? "pagado" : "pendiente",
      refId: sp.id,
      paidExpenseId: sp.paidExpenseId ?? null,
    });
  }

  // 2) Expenses del mes (todos cuentan como pagados, incl. los manuales y los
  //    generados por recurrencia con `fromRecurrenceId`)
  const expensesInMonth: Expense[] = [];
  for (const e of data.expenses ?? []) {
    const d = parseISO(e.date);
    if (isBefore(d, monthStart) || isAfter(d, monthEnd)) continue;
    expensesInMonth.push(e);
  }
  for (const e of expensesInMonth) {
    out.push({
      date: format(parseISO(e.date), "yyyy-MM-dd"),
      key: `expense:${e.id}`,
      description: e.description,
      amount: e.amount,
      category: e.category,
      paymentMethod: e.paymentMethod,
      source: "expense",
      status: "pagado",
      refId: e.id,
    });
  }

  // 3) Recurrencias proyectadas que aún no se hayan emitido como expense.
  for (const r of data.expenseRecurrences ?? []) {
    const occs = recurrenceOccurrencesInMonth(r, monthStart, monthEnd);
    for (const day of occs) {
      const alreadyPaid = expensesInMonth.some(
        (e) =>
          e.fromRecurrenceId === r.id && isSameDay(parseISO(e.date), day),
      );
      if (alreadyPaid) continue;
      out.push({
        date: format(day, "yyyy-MM-dd"),
        key: `recurrence:${r.id}:${format(day, "yyyy-MM-dd")}`,
        description: r.description,
        amount: r.amount,
        category: r.category,
        paymentMethod: r.paymentMethod,
        source: "recurrence",
        status: "pendiente",
        refId: r.id,
      });
    }
  }

  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.status !== b.status) return a.status === "pendiente" ? -1 : 1;
    return b.amount - a.amount;
  });
}

/** Items próximos en los siguientes N días (para alertas). */
export function upcomingPayments(
  data: AppData,
  daysAhead = 7,
  now = new Date(),
): CalendarItem[] {
  const start = startOfDay(now);
  const end = addDays(start, daysAhead);

  // Para abarcar inicio y fin de mes nos basta con el mes actual + el siguiente
  // si daysAhead pisa el cambio.
  const items = [
    ...calendarItemsForMonth(data, start),
    ...(start.getMonth() !== end.getMonth()
      ? calendarItemsForMonth(data, end)
      : []),
  ];
  // Filtrar al rango exacto y solo pendientes
  return items.filter((it) => {
    if (it.status !== "pendiente") return false;
    const d = startOfDay(parseISO(`${it.date}T12:00:00`));
    return !isBefore(d, start) && !isAfter(d, end);
  });
}

/** Crea un Expense a partir de un ScheduledPayment pagado. */
export function expenseFromScheduledPayment(
  sp: ScheduledPayment,
  now = new Date(),
): Omit<Expense, "id"> {
  return {
    date: new Date(`${sp.dueDate}T12:00:00`).toISOString(),
    category: sp.category,
    description: sp.description,
    amount: sp.amount,
    paymentMethod: sp.paymentMethod,
    kind: sp.kind,
    receiptNote: sp.note?.trim() || `Pago programado liquidado el ${format(now, "yyyy-MM-dd")}`,
  };
}
