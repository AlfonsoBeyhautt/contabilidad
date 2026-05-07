"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { useAppData } from "@/contexts/data-context";

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useAppData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-zinc-100/90 dark:bg-zinc-950">
      <Sidebar shopName={data.settings.shopName} className="hidden lg:flex" />

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          />
          <Sidebar
            shopName={data.settings.shopName}
            className="relative z-10 h-full shadow-xl"
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-zinc-50/80 dark:bg-zinc-950">
        <TopBar onMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/50 p-3 sm:p-6 lg:p-8 dark:bg-zinc-950 dark:text-zinc-100">
          {children}
        </main>
      </div>
    </div>
  );
}
