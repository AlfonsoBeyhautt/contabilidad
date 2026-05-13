import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const baseField =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const sizeField = "h-9 px-3";

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex flex-col gap-1 text-[12px] font-medium text-[var(--foreground-muted)]"
    >
      <span className="flex items-center justify-between gap-2">
        <span>{children}</span>
        {hint ? (
          <span className="text-[11px] font-normal text-[var(--foreground-subtle)]">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  error,
  children,
  className = "",
}: {
  label?: string;
  hint?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[11.5px] text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;
export function Input({ className = "", ...rest }: InputProps) {
  return <input className={`${baseField} ${sizeField} ${className}`} {...rest} />;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <select
      className={`${baseField} ${sizeField} pr-8 appearance-none bg-[var(--surface)] bg-[length:14px] bg-[right_10px_center] bg-no-repeat ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' fill='none' stroke='currentColor' stroke-width='1.6'><polyline points='3,5 7,9 11,5'></polyline></svg>\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className = "", ...rest }: TextareaProps) {
  return (
    <textarea
      className={`${baseField} min-h-[72px] px-3 py-2 ${className}`}
      {...rest}
    />
  );
}
