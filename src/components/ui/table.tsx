import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function Table({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] ${className}`}
    >
      <table className="w-full border-collapse text-left text-[13px] text-[var(--foreground)]">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-[var(--surface-muted)] text-[var(--foreground-muted)]">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-[var(--border-subtle)]">{children}</tbody>
  );
}

export function TR({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`${
        onClick ? "cursor-pointer hover:bg-[var(--surface-muted)]" : ""
      } ${className}`}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className = "",
  align,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${a} ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className = "",
  align,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td
      className={`whitespace-nowrap px-3 py-2.5 ${a} ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}

export function TableEmpty({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-10 text-center text-[12.5px] text-[var(--foreground-muted)]"
      >
        {message}
      </td>
    </tr>
  );
}
