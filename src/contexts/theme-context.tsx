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

/** Colores para Recharts según modo. Paleta sobria + accents discretos. */
export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const dark = theme === "dark";
    return {
      // Líneas
      linePrimary: dark ? "#dde1e7" : "#0c0d10",
      lineMuted: dark ? "#5e646e" : "#a8acb5",
      lineAccent: dark ? "#6b9bff" : "#2f6feb",
      linePositive: dark ? "#4ed18a" : "#0f8a4c",
      lineNegative: dark ? "#f08585" : "#c43a3a",
      lineWarning: dark ? "#e0a96d" : "#b3651a",

      // Barras
      bar: dark ? "#a3a8b2" : "#2a313c",
      barAlt: dark ? "#5e646e" : "#7c828e",
      barAccent: dark ? "#6b9bff" : "#2f6feb",

      // Áreas / gradientes (id refs en el JSX)
      areaPrimaryTop: dark ? "rgba(107,155,255,0.35)" : "rgba(47,111,235,0.22)",
      areaPrimaryBottom: dark ? "rgba(107,155,255,0)" : "rgba(47,111,235,0)",

      // Estructura
      grid: dark ? "#1c2129" : "#eef0f3",
      axis: dark ? "#5e646e" : "#868c95",
      axisLabel: dark ? "#8a9098" : "#5b6168",

      // Tooltip
      tooltipBg: dark ? "#14181f" : "#ffffff",
      tooltipBorder: dark ? "#2a313c" : "#e6e7eb",
      tooltipColor: dark ? "#e6e8ec" : "#0c0d10",
      tooltipShadow: dark
        ? "0 12px 28px -8px rgba(0,0,0,0.6)"
        : "0 12px 28px -8px rgba(15,23,42,0.12)",
    };
  }, [theme]);
}
