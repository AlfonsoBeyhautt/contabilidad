"use client";

import { useChartColors } from "@/contexts/theme-context";
import { formatCurrency } from "@/lib/format";

type FormatterValue = string | number | (string | number)[];

type TooltipPayloadEntry = {
  name?: string | number;
  dataKey?: string | number;
  value?: FormatterValue;
  color?: string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  /** Si true, formatea valores como moneda. */
  currency?: boolean;
  /** Sufijo opcional para el valor (ej. "uds.", "%"). */
  suffix?: string;
};

export function ChartTooltip({
  active,
  payload,
  label,
  currency = true,
  suffix,
}: ChartTooltipProps) {
  const colors = useChartColors();
  if (!active || !payload || payload.length === 0) return null;

  const formatValue = (value: FormatterValue | undefined) => {
    if (value === undefined || value === null) return "—";
    const n = Array.isArray(value) ? Number(value[0]) : Number(value);
    if (!Number.isFinite(n)) return "—";
    if (currency) return formatCurrency(n);
    return suffix ? `${n.toLocaleString("es-AR")} ${suffix}` : n.toLocaleString("es-AR");
  };

  return (
    <div
      style={{
        background: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        color: colors.tooltipColor,
        boxShadow: colors.tooltipShadow,
      }}
      className="min-w-[160px] rounded-xl border px-3 py-2.5 text-[12px]"
    >
      {label !== undefined && label !== null ? (
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] opacity-70">
          {String(label)}
        </p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li
            key={`${String(entry.dataKey ?? i)}-${i}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: entry.color ?? colors.linePrimary }}
              />
              <span className="text-[12px]" style={{ opacity: 0.85 }}>
                {entry.name ?? entry.dataKey}
              </span>
            </span>
            <span className="text-[12.5px] font-semibold tabular-nums">
              {formatValue(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
