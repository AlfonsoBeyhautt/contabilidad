"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { useAppData } from "@/contexts/data-context";

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useAppData();

  return (
    <div className="flex min-h-screen bg-zinc-100/90 dark:bg-zinc-950">
      <Sidebar shopName={data.settings.shopName} />
      <div className="flex min-w-0 flex-1 flex-col bg-zinc-50/80 dark:bg-zinc-950">
        <TopBar />
        <main className="flex-1 overflow-auto bg-zinc-50/50 p-4 sm:p-6 lg:p-8 dark:bg-zinc-950 dark:text-zinc-100">
          {children}
        </main>
      </div>
    </div>
  );
}
