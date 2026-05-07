"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DateRange } from "@/lib/data/finance-calcs";
import {
  rangeFromPreset,
  type PeriodPreset,
} from "@/lib/data/finance-calcs";

type PeriodContextValue = {
  preset: PeriodPreset;
  range: DateRange;
  customStart: Date | null;
  customEnd: Date | null;
  setPreset: (p: PeriodPreset) => void;
  setCustomRange: (start: Date, end: Date) => void;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<PeriodPreset>("este_mes");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  const range = useMemo(() => {
    if (preset === "personalizado" && customStart && customEnd) {
      return rangeFromPreset("personalizado", {
        start: customStart,
        end: customEnd,
      });
    }
    return rangeFromPreset(preset);
  }, [preset, customStart, customEnd]);

  const setPreset = useCallback((p: PeriodPreset) => {
    setPresetState(p);
  }, []);

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPresetState("personalizado");
  }, []);

  const value = useMemo(
    () => ({
      preset,
      range,
      customStart,
      customEnd,
      setPreset,
      setCustomRange,
    }),
    [preset, range, customStart, customEnd, setPreset, setCustomRange],
  );

  return (
    <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
  );
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod debe usarse dentro de PeriodProvider");
  return ctx;
}
