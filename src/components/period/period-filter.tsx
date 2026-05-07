"use client";

import { usePeriod } from "@/contexts/period-context";
import type { PeriodPreset } from "@/lib/data/finance-calcs";

const labels: Record<PeriodPreset, string> = {
  hoy: "Hoy",
  esta_semana: "Esta semana",
  este_mes: "Este mes",
  este_año: "Este año",
  año_anterior: "Año anterior",
  personalizado: "Personalizado",
};

export function PeriodFilter() {
  const { preset, setPreset, customStart, customEnd, setCustomRange } =
    usePeriod();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Período
      </span>
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value as PeriodPreset)}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {(Object.keys(labels) as PeriodPreset[]).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
      {preset === "personalizado" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            defaultValue={
              customStart
                ? customStart.toISOString().slice(0, 10)
                : undefined
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const start = new Date(v + "T12:00:00");
              const end = customEnd ?? start;
              setCustomRange(start, end);
            }}
          />
          <span className="text-zinc-400">—</span>
          <input
            type="date"
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            defaultValue={
              customEnd ? customEnd.toISOString().slice(0, 10) : undefined
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v || !customStart) return;
              const end = new Date(v + "T12:00:00");
              setCustomRange(customStart, end);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
