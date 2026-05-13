import {
  AlertTriangle,
  Eye,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Insight } from "@/lib/intelligence/types";

const severityChrome: Record<
  Insight["severity"],
  {
    label: string;
    badgeTone: "info" | "positive" | "warning" | "danger" | "muted" | "neutral";
    icon: React.ReactNode;
    chip: string;
  }
> = {
  critical: {
    label: "Crítico",
    badgeTone: "danger",
    icon: <TriangleAlert className="h-4 w-4" aria-hidden />,
    chip: "bg-[var(--danger-soft)] text-[var(--danger)]",
  },
  warning: {
    label: "Atención",
    badgeTone: "warning",
    icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
    chip: "bg-[var(--warning-soft)] text-[var(--warning)]",
  },
  watch: {
    label: "Vigilar",
    badgeTone: "info",
    icon: <Eye className="h-4 w-4" aria-hidden />,
    chip: "bg-[var(--accent-soft)] text-[var(--accent)]",
  },
  positive: {
    label: "Fortaleza",
    badgeTone: "positive",
    icon: <Sparkles className="h-4 w-4" aria-hidden />,
    chip: "bg-[var(--success-soft)] text-[var(--success)]",
  },
  info: {
    label: "Observación",
    badgeTone: "muted",
    icon: <Info className="h-4 w-4" aria-hidden />,
    chip: "bg-[var(--surface-muted)] text-[var(--foreground-muted)]",
  },
};

const categoryLabel: Record<Insight["category"], string> = {
  financiero: "Financiero",
  operativo: "Operativo",
  comercial: "Comercial",
  riesgo: "Riesgo",
  oportunidad: "Oportunidad",
};

export function InsightCard({ insight }: { insight: Insight }) {
  const chrome = severityChrome[insight.severity];
  return (
    <article className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chrome.chip}`}
              aria-hidden
            >
              {chrome.icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={chrome.badgeTone}>{chrome.label}</Badge>
                <Badge tone="muted">{categoryLabel[insight.category]}</Badge>
              </div>
              <h3 className="mt-2 text-[15.5px] font-semibold tracking-tight text-[var(--foreground-strong)]">
                {insight.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--foreground)]">
                {insight.summary}
              </p>
            </div>
          </div>
        </header>

        <p className="text-[12.5px] leading-relaxed text-[var(--foreground-muted)]">
          {insight.detail}
        </p>

        {insight.metrics && insight.metrics.length > 0 ? (
          <div className="grid gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 sm:grid-cols-2">
            {insight.metrics.map((m, idx) => (
              <div
                key={`${m.label}-${idx}`}
                className="flex items-center justify-between gap-3 text-[12px]"
              >
                <span className="truncate text-[var(--foreground-muted)]">
                  {m.label}
                </span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    m.tone === "positive"
                      ? "text-[var(--success)]"
                      : m.tone === "warning"
                        ? "text-[var(--warning)]"
                        : m.tone === "danger"
                          ? "text-[var(--danger)]"
                          : m.tone === "info"
                            ? "text-[var(--accent)]"
                            : "text-[var(--foreground-strong)]"
                  }`}
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {insight.evidence && insight.evidence.length > 0 ? (
          <ul className="space-y-1 border-t border-[var(--border-subtle)] pt-3 text-[12px]">
            {insight.evidence.map((e, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[var(--foreground-muted)]"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--foreground-subtle)]"
                />
                <span>{e.point}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {insight.recommendation ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Recomendación
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--foreground)]">
              {insight.recommendation}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
