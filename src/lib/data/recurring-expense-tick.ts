import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  isSameDay,
} from "date-fns";
import type { AppData, Expense, ExpenseRecurrence } from "./types";

function randomHex(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

function newExpenseId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  /** UUID v4 compatible con validación Supabase cuando no hay `crypto.randomUUID`. */
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
}

function bumpDate(from: Date, freq: ExpenseRecurrence["frequency"]): Date {
  switch (freq) {
    case "semanal":
      return addWeeks(from, 1);
    case "quincenal":
      return addDays(from, 14);
    case "mensual":
      return addMonths(from, 1);
    case "trimestral":
      return addMonths(from, 3);
    case "anual":
      return addYears(from, 1);
    default:
      return addMonths(from, 1);
  }
}

/**
 * Emite gastos vencidos según `nextRunAt` y avanza fechas.
 * Idempotente: no duplica si ya existe un gasto con mismo `fromRecurrenceId` y día.
 */
export function applyRecurringExpenseTick(d: AppData): {
  data: AppData;
  newExpenses: Expense[];
  updatedRecurrences: ExpenseRecurrence[];
} {
  const today = startOfDay(new Date());
  const recurrences = (d.expenseRecurrences ?? []).map((r) => ({ ...r }));
  let expenses = [...d.expenses];
  const newExpenses: Expense[] = [];
  const updatedRecurrences: ExpenseRecurrence[] = [];

  for (let i = 0; i < recurrences.length; i++) {
    const orig = recurrences[i];
    if (orig.paused) continue;

    let nextRunDay = startOfDay(parseISO(`${orig.nextRunAt}T12:00:00`));
    const end = orig.endDate
      ? endOfDay(parseISO(`${orig.endDate}T12:00:00`))
      : null;

    let changed = false;
    let guard = 0;
    while (
      (isBefore(nextRunDay, today) || isSameDay(nextRunDay, today)) &&
      guard < 240
    ) {
      guard++;
      if (end && isAfter(nextRunDay, end)) break;

      const dup = expenses.some(
        (e) =>
          e.fromRecurrenceId === orig.id &&
          isSameDay(parseISO(e.date), nextRunDay),
      );

      if (!dup) {
        const exp: Expense = {
          id: newExpenseId(),
          date: nextRunDay.toISOString(),
          category: orig.category,
          description: orig.description,
          amount: orig.amount,
          paymentMethod: orig.paymentMethod,
          kind: orig.kind,
          fromRecurrenceId: orig.id,
        };
        expenses = [...expenses, exp];
        newExpenses.push(exp);
      }

      const bumped = startOfDay(bumpDate(nextRunDay, orig.frequency));
      recurrences[i] = {
        ...recurrences[i],
        nextRunAt: format(bumped, "yyyy-MM-dd"),
      };
      nextRunDay = bumped;
      changed = true;
    }

    if (changed) {
      updatedRecurrences.push(recurrences[i]);
    }
  }

  return {
    data: { ...d, expenses, expenseRecurrences: recurrences },
    newExpenses,
    updatedRecurrences,
  };
}
