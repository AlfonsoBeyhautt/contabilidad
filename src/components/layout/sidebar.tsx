"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
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

const nav = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/productos", label: "Productos", icon: Shirt },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/historial", label: "Historial de movimientos", icon: History },
  { href: "/gastos", label: "Gastos", icon: Wallet },
  { href: "/costos", label: "Costos", icon: CircleDollarSign },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

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
    <aside className={`flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Package className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Gestión interna
            </p>
            <p className="truncate text-xs text-zinc-500">{shopName}</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          Menú
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
