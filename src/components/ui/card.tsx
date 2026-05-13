import type { ReactNode } from "react";

type CardProps = {
  className?: string;
  children: ReactNode;
  /**
   * `flat` quita la sombra para usos en contextos densos.
   * `interactive` añade un hover sutil (no usar en cards estáticas).
   */
  variant?: "default" | "flat" | "elevated" | "interactive";
};

export function Card({
  className = "",
  children,
  variant = "default",
}: CardProps) {
  const base =
    "relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";
  const shadow =
    variant === "flat"
      ? ""
      : variant === "elevated"
        ? "shadow-[var(--shadow-md)]"
        : "shadow-[var(--shadow-sm)]";
  const interactive =
    variant === "interactive"
      ? "transition-shadow hover:shadow-[var(--shadow-md)]"
      : "";
  return (
    <div className={`${base} ${shadow} ${interactive} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--foreground-strong)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12.5px] text-[var(--foreground-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardContent({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`px-5 py-4 sm:px-6 sm:py-5 ${className}`}>{children}</div>
  );
}

export function CardFooter({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-5 py-3 text-xs text-[var(--foreground-muted)] sm:px-6 ${className}`}
    >
      {children}
    </div>
  );
}
