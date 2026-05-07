import type { ReactNode } from "react";
import { Card } from "./card";

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: { label: string; positive?: boolean };
  icon?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="truncate text-xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            {value}
          </p>
          {hint ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
          ) : null}
          {trend ? (
            <p
              className={`text-xs font-medium ${
                trend.positive === false
                  ? "text-red-600 dark:text-red-400"
                  : trend.positive === true
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500"
              }`}
            >
              {trend.label}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
