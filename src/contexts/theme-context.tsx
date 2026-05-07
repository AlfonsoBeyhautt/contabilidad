"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "contabilidad-theme";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDomTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = mode === "dark";
  root.classList.toggle("dark", dark);
  if (dark) {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
  root.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const initial: ThemeMode = raw === "dark" ? "dark" : "light";
      setThemeState(initial);
      applyDomTheme(initial);
    } catch {
      applyDomTheme("light");
    }
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    applyDomTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}

/** Colores para Recharts según modo (evita negro/blanco puros en trazos). */
export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const dark = theme === "dark";
    return {
      linePrimary: dark ? "#d4d4d8" : "#18181b",
      lineMuted: dark ? "#71717a" : "#a1a1aa",
      lineAccent: dark ? "#34d399" : "#059669",
      bar: dark ? "#a1a1aa" : "#27272a",
      barAlt: dark ? "#71717a" : "#3f3f46",
      grid: dark ? "#3f3f46" : "#e4e4e7",
      tooltipBg: dark ? "#1c1c1f" : "#ffffff",
      tooltipBorder: dark ? "#3f3f46" : "#e4e4e7",
      tooltipColor: dark ? "#e4e4e7" : "#18181b",
    };
  }, [theme]);
}
