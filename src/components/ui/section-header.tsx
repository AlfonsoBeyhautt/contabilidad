import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[20px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] text-[var(--foreground-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
