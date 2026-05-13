import type { ReactNode } from "react";
import { Card } from "./card";

type Trend = { label: string; positive?: boolean };

type Delta = {
  /** Variación porcentual (positiva o negativa). */
  value: number;
  /** Texto de contexto, ej. "vs mes anterior". */
  label?: string;
  /** Cuando `value` es 0 y `label` corresponde a "estable". */
  neutralOnZero?: boolean;
};

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: Trend;
  delta?: Delta;
  icon?: ReactNode;
  /**
   * `hero` agranda el value y agrega más respiración (para el KPI principal).
   */
  size?: "default" | "hero";
  /**
   * Acento muy sutil en el ícono / pill. No genera ruido visual.
   */
  accent?: "neutral" | "positive" | "negative" | "info" | "warning";
};

function deltaToneClasses(positive?: boolean) {
  if (positive === undefined)
    return "bg-[var(--surface-muted)] text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]";
  if (positive)
    return "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--success)_25%,transparent)]";
  return "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--danger)_25%,transparent)]";
}

function accentClasses(accent: NonNullable<StatCardProps["accent"]>) {
  switch (accent) {
    case "positive":
      return "bg-[var(--success-soft)] text-[var(--success)]";
    case "negative":
      return "bg-[var(--danger-soft)] text-[var(--danger)]";
    case "warning":
      return "bg-[var(--warning-soft)] text-[var(--warning)]";
    case "info":
      return "bg-[var(--accent-soft)] text-[var(--accent)]";
    case "neutral":
    default:
      return "bg-[var(--surface-muted)] text-[var(--foreground-muted)]";
  }
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  delta,
  icon,
  size = "default",
  accent = "neutral",
}: StatCardProps) {
  const isHero = size === "hero";
  return (
    <Card className="overflow-hidden">
      <div
        className={`flex flex-col gap-4 px-5 ${
          isHero ? "py-6 sm:px-7 sm:py-8" : "py-5 sm:px-6 sm:py-5"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
            {label}
          </p>
          {icon ? (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentClasses(
                accent,
              )}`}
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <p
            className={`truncate font-semibold tabular-nums tracking-tight text-[var(--foreground-strong)] ${
              isHero ? "text-3xl sm:text-4xl" : "text-[26px] sm:text-[28px]"
            }`}
          >
            {value}
          </p>
          {hint ? (
            <p className="text-[12px] leading-relaxed text-[var(--foreground-muted)]">
              {hint}
            </p>
          ) : null}
        </div>

        {delta || trend ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {delta ? (
              <DeltaPill delta={delta} />
            ) : null}
            {trend ? (
              <span className="text-[11.5px] text-[var(--foreground-muted)]">
                {trend.label}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function DeltaPill({ delta }: { delta: Delta }) {
  const { value, label, neutralOnZero } = delta;
  const isNeutral = neutralOnZero && Math.abs(value) < 0.05;
  const positive = isNeutral ? undefined : value >= 0;
  const tone = deltaToneClasses(positive);
  const sign = isNeutral ? "" : value >= 0 ? "+" : "";
  const rounded = isNeutral ? "estable" : `${sign}${value.toFixed(1)}%`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${tone}`}
    >
      {!isNeutral ? (
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          className={positive ? "" : "rotate-180"}
        >
          <path
            d="M5 2.2 8 6.2H6.3v2.1H3.7V6.2H2L5 2.2Z"
            fill="currentColor"
          />
        </svg>
      ) : null}
      <span>{rounded}</span>
      {label ? (
        <span className="font-normal opacity-70">· {label}</span>
      ) : null}
    </span>
  );
}
