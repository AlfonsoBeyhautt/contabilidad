"use client";

import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
};

export function Tabs({
  items,
  active,
  onChange,
  className = "",
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium tracking-tight disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? "bg-[var(--surface)] text-[var(--foreground-strong)] shadow-[var(--shadow-xs)]"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            }`}
          >
            {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
            <span>{item.label}</span>
            {item.badge ? <span className="ml-0.5">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
