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

const subtitles: Record<string, string> = {
  "/": "Resumen ejecutivo del negocio",
  "/ventas": "Operaciones de venta y trazabilidad",
  "/productos": "Catálogo de familias, modelos y talles",
  "/stock": "Inventario disponible por variante",
  "/historial": "Trazabilidad de stock por producto y talle",
  "/gastos": "Registro y planificación de gastos",
  "/costos": "Estructura de costos y márgenes",
  "/clientes": "Base de clientes y comportamiento",
  "/calendario": "Pagos previstos y vencimientos",
  "/reportes": "Documentos analíticos descargables",
  "/configuracion": "Preferencias y branding",
};

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const title = titles[pathname] ?? "Panel";
  const subtitle = subtitles[pathname];

  return (
    <header className="sticky top-0 z-30 flex min-h-[64px] flex-col gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,transparent)] px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[18px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="hidden truncate text-[12px] text-[var(--foreground-muted)] sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
        <PeriodFilter />
        <button
          type="button"
          onClick={() => toggleTheme()}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          aria-label={
            theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
          }
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Salir
          </button>
        ) : null}
      </div>
    </header>
  );
}
