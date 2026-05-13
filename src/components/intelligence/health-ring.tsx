"use client";

import { useEffect, useState } from "react";

const TONE_COLORS: Record<string, { stroke: string; fill: string }> = {
  excelente: { stroke: "var(--success)", fill: "var(--success-soft)" },
  saludable: { stroke: "var(--success)", fill: "var(--success-soft)" },
  estable: { stroke: "var(--accent)", fill: "var(--accent-soft)" },
  atención: { stroke: "var(--warning)", fill: "var(--warning-soft)" },
  crítico: { stroke: "var(--danger)", fill: "var(--danger-soft)" },
};

export function HealthRing({
  score,
  grade,
  size = 160,
}: {
  score: number;
  grade: string;
  size?: number;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, progress)) / 100) * circumference;
  const colors = TONE_COLORS[grade] ?? TONE_COLORS.estable;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.stroke}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-live="polite"
      >
        <span className="text-[44px] font-semibold leading-none tracking-tight text-[var(--foreground-strong)]">
          {score}
        </span>
        <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
          / 100
        </span>
      </div>
    </div>
  );
}
