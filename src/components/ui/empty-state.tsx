import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      {icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--foreground-muted)] ring-1 ring-inset ring-[var(--border)]">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-[14px] font-semibold tracking-tight text-[var(--foreground-strong)]">
          {title}
        </p>
        {description ? (
          <p className="mx-auto max-w-md text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
