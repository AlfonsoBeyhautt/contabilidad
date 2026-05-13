"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Brain,
  CalendarClock,
  CircleDollarSign,
  History,
  LayoutDashboard,
  Package,
  Settings,
  Shirt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "General",
    items: [{ href: "/", label: "Inicio", icon: LayoutDashboard }],
  },
  {
    label: "Operación",
    items: [
      { href: "/ventas", label: "Ventas", icon: TrendingUp },
      { href: "/productos", label: "Productos", icon: Shirt },
      { href: "/stock", label: "Stock", icon: Boxes },
      { href: "/historial", label: "Historial de movimientos", icon: History },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/gastos", label: "Gastos", icon: Wallet },
      { href: "/calendario", label: "Calendario de pagos", icon: CalendarClock },
      { href: "/costos", label: "Costos", icon: CircleDollarSign },
    ],
  },
  {
    label: "Relación",
    items: [{ href: "/clientes", label: "Clientes", icon: Users }],
  },
  {
    label: "Análisis",
    items: [
      { href: "/inteligencia", label: "Inteligencia del negocio", icon: Brain },
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function Sidebar({
  shopName,
  className = "",
  onNavigate,
}: {
  shopName: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-muted)] ${className}`}
    >
      <div className="border-b border-[var(--border)] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)] shadow-[var(--shadow-xs)]">
            <Package className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              Workspace
            </p>
            <p className="truncate text-[14px] font-semibold tracking-tight text-[var(--foreground-strong)]">
              {shopName || "Mi negocio"}
            </p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium ${
                    active
                      ? "bg-[var(--surface)] text-[var(--foreground-strong)] shadow-[var(--shadow-xs)]"
                      : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full transition-opacity ${
                      active ? "bg-[var(--accent)] opacity-100" : "opacity-0"
                    }`}
                  />
                  <Icon className="h-[15px] w-[15px] shrink-0 opacity-90" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]"
          />
          <p className="text-[11px] text-[var(--foreground-muted)]">
            Sincronizado con la nube
          </p>
        </div>
      </div>
    </aside>
  );
}
