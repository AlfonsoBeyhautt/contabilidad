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
    <div className="flex min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar shopName={data.settings.shopName} className="hidden lg:flex" />

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--surface-inverted)_55%,transparent)] backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          />
          <Sidebar
            shopName={data.settings.shopName}
            className="relative z-10 h-full shadow-[var(--shadow-pop)]"
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
