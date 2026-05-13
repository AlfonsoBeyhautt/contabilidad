import type { ReactNode } from "react";

type BadgeTone =
  | "neutral"
  | "info"
  | "positive"
  | "warning"
  | "danger"
  | "muted";

const toneClasses: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--surface-muted)] text-[var(--foreground)] ring-1 ring-inset ring-[var(--border)]",
  info: "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--accent)_22%,transparent)]",
  positive:
    "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--success)_25%,transparent)]",
  warning:
    "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--warning)_25%,transparent)]",
  danger:
    "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--danger)_25%,transparent)]",
  muted:
    "bg-transparent text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClasses[tone]} ${className}`}
    >
      {dot ? (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80"
        />
      ) : null}
      {children}
    </span>
  );
}
