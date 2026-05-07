"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { DataProvider } from "@/contexts/data-context";
import { PeriodProvider } from "@/contexts/period-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, authReady, supabaseConfigured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authReady && supabaseConfigured && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authReady, supabaseConfigured, isAuthenticated, router]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        Cargando sesión…
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-950">
        <Card className="max-w-md">
          <CardHeader
            title="Supabase no configurado"
            subtitle="Autenticación y base remota requieren variables de entorno"
          />
          <CardContent className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              Creá <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">.env.local</code> en la raíz del proyecto con:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 font-mono text-xs">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            </ul>
            <p className="mt-3">
              Reiniciá <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">npm run dev</code> después de guardar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <span className="text-sm text-zinc-500">Redirigiendo al acceso…</span>
      </div>
    );
  }

  return (
    <DataProvider>
      <PeriodProvider>
        <AppShell>{children}</AppShell>
      </PeriodProvider>
    </DataProvider>
  );
}
