import type { ReactNode } from "react";
import { Card } from "./card";
import { useCountUp } from "@/hooks/use-count-up";

type Trend = { label: string; positive?: boolean };

type Delta = {
  /** Variación porcentual (positiva o negativa). */
  value: number;
  /** Texto de contexto, ej. "vs mes anterior". */
  label?: string;
  /** Cuando `value` es 0 y `label` corresponde a "estable". */
  neutralOnZero?: boolean;
  /**
   * `percent` muestra % (ingresos, neto, gastos).
   * `percentagePoints` muestra p.p. (margen neto vs otro período).
   */
  display?: "percent" | "percentagePoints";
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
   * Jerarquía visual entre KPIs del mismo tamaño.
   */
  prominence?: "primary" | "secondary";
  /**
   * Acento muy sutil en el ícono / pill. No genera ruido visual.
   */
  accent?: "neutral" | "positive" | "negative" | "info" | "warning";
  /**
   * Énfasis de borde/fondo para estados financieros adversos (controlado).
   */
  financialStress?: "none" | "warning" | "danger";
  /** Valor numérico para animación count-up; requiere `formatCountUp`. */
  countUpAmount?: number;
  formatCountUp?: (n: number) => string;
  /** Serie corta para micrográfico (ej. últimos meses). */
  sparkline?: number[];
  sparklineTone?: "info" | "positive" | "negative" | "warning" | "muted";
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

function stressClasses(stress: NonNullable<StatCardProps["financialStress"]>) {
  switch (stress) {
    case "danger":
      return "ring-1 ring-inset ring-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger-soft)_55%,transparent)]";
    case "warning":
      return "ring-1 ring-inset ring-[color-mix(in_oklab,var(--warning)_32%,transparent)] bg-[color-mix(in_oklab,var(--warning-soft)_45%,transparent)]";
    case "none":
    default:
      return "";
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
  prominence = "primary",
  accent = "neutral",
  financialStress = "none",
  countUpAmount,
  formatCountUp,
  sparkline,
  sparklineTone = "muted",
}: StatCardProps) {
  const isHero = size === "hero";
  const stress = stressClasses(financialStress);
  const useAnimation = countUpAmount !== undefined && formatCountUp != null;
  const animated = useCountUp(useAnimation ? countUpAmount : 0, 900, useAnimation);
  const displayValue = useAnimation ? formatCountUp(animated) : value;
  const valueClass = isHero
    ? prominence === "secondary"
      ? "text-2xl sm:text-[1.85rem]"
      : "text-3xl sm:text-[2.35rem]"
    : "text-[26px] sm:text-[28px]";

  return (
    <Card className={`group overflow-hidden ${stress}`}>
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
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 hover:scale-[1.03] ${accentClasses(
                accent,
              )}`}
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className={`truncate font-semibold tabular-nums tracking-tight text-[var(--foreground-strong)] ${valueClass}`}
            >
              {displayValue}
            </p>
            {hint ? (
              <p className="text-[12px] leading-relaxed text-[var(--foreground-muted)]">
                {hint}
              </p>
            ) : null}
            {delta || trend ? (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
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
          {sparkline && sparkline.length > 1 ? (
            <MiniSparkline values={sparkline} tone={sparklineTone} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function DeltaPill({ delta }: { delta: Delta }) {
  const { value, label, neutralOnZero, display = "percent" } = delta;
  const isNeutral = neutralOnZero && Math.abs(value) < 0.05;
  const positive = isNeutral ? undefined : value >= 0;
  const tone = deltaToneClasses(positive);
  const sign = isNeutral ? "" : value >= 0 ? "+" : "";
  const suffix = display === "percentagePoints" ? " p.p." : "%";
  const rounded = isNeutral
    ? "estable"
    : `${sign}${value.toFixed(1)}${suffix}`;

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

const sparklineToneClass: Record<
  NonNullable<StatCardProps["sparklineTone"]>,
  string
> = {
  info: "text-[var(--accent)]",
  positive: "text-[var(--success)]",
  negative: "text-[var(--danger)]",
  warning: "text-[var(--warning)]",
  muted: "text-[var(--foreground-muted)]",
};

function MiniSparkline({
  values,
  tone,
}: {
  values: number[];
  tone: NonNullable<StatCardProps["sparklineTone"]>;
}) {
  const w = 76;
  const h = 32;
  const padX = 2;
  const padY = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values
    .map((v, i) => {
      const x =
        values.length <= 1
          ? w / 2
          : padX + (i / (values.length - 1)) * (w - 2 * padX);
      const y =
        max === min
          ? h / 2
          : padY + (1 - (v - min) / (max - min)) * (h - 2 * padY);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`shrink-0 ${sparklineToneClass[tone]}`}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
        opacity={0.92}
      />
    </svg>
  );
}
