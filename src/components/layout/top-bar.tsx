"use client";

import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { PeriodFilter } from "@/components/period/period-filter";
import { AUTH_DISABLED } from "@/lib/feature-flags";

const titles: Record<string, string> = {
  "/": "Inicio",
  "/ventas": "Ventas",
  "/productos": "Productos",
  "/stock": "Stock",
  "/historial": "Historial de movimientos",
  "/gastos": "Gastos",
  "/costos": "Costos",
  "/clientes": "Clientes",
  "/calendario": "Calendario de pagos",
  "/reportes": "Reportes",
  "/configuracion": "Configuración",
};

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const title = titles[pathname] ?? "Panel";

  return (
    <header className="flex min-h-14 flex-col gap-3 border-b border-zinc-200 bg-zinc-100/90 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuToggle}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-200 p-2 text-zinc-700 transition-colors hover:bg-zinc-100 lg:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          aria-label="Abrir menú"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
      </div>
      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:gap-4">
        <PeriodFilter />
        <button
          type="button"
          onClick={() => toggleTheme()}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-200 p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden />
          ) : (
            <Moon className="h-4 w-4" aria-hidden />
          )}
        </button>
        {!AUTH_DISABLED ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Salir
          </button>
        ) : null}
      </div>
    </header>
  );
}
