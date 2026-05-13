"use client";

import { usePeriod } from "@/contexts/period-context";
import type { PeriodPreset } from "@/lib/data/finance-calcs";
import { Input, Select } from "@/components/ui/field";

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
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
        Período
      </span>
      <Select
        value={preset}
        onChange={(e) => setPreset(e.target.value as PeriodPreset)}
        className="min-w-[150px]"
      >
        {(Object.keys(labels) as PeriodPreset[]).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </Select>
      {preset === "personalizado" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="w-[140px]"
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
          <span className="text-[var(--foreground-subtle)]">—</span>
          <Input
            type="date"
            className="w-[140px]"
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
