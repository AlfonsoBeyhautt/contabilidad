"use client";

import { useEffect, useState } from "react";

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * Anima un número hacia `target` en `durationMs`. Reinicia al cambiar `target`.
 */
export function useCountUp(
  target: number,
  durationMs = 900,
  enabled = true,
): number {
  const [value, setValue] = useState(() => (enabled ? 0 : target));

  useEffect(() => {
    if (!enabled) {
      const id = requestAnimationFrame(() => {
        setValue(target);
      });
      return () => cancelAnimationFrame(id);
    }
    let frame: number;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(t);
      setValue(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, enabled]);

  return value;
}
