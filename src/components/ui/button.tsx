import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle";

type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)] shadow-[var(--shadow-sm)] hover:opacity-90 active:opacity-95",
  secondary:
    "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  ghost:
    "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
  subtle:
    "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--surface-muted)_70%,var(--border))]",
  danger:
    "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--danger)_25%,transparent)] hover:bg-[color-mix(in_oklab,var(--danger-soft)_80%,var(--danger))]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-10 px-4 text-[13.5px]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Renderiza solo como icono cuadrado. */
  iconOnly?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  iconOnly = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const cls = `${base} ${variantClasses[variant]} ${sizeClasses[size]} ${
    iconOnly ? "aspect-square px-0" : ""
  } ${className}`;
  return (
    <button className={cls} {...rest}>
      {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      {!iconOnly ? <span>{children}</span> : children}
      {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
}

export function IconButton({
  className = "",
  ...rest
}: Omit<ButtonProps, "iconOnly">) {
  return <Button iconOnly className={className} {...rest} />;
}
