"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SupabaseStatusSection } from "./supabase-status";
import { useAppData } from "@/contexts/data-context";

export function ConfigView() {
  const { data, updateSettings, reloadAppData } = useAppData();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader
          title="Identidad del negocio"
          subtitle="Visible solo en este panel administrativo"
        />
        <CardContent className="space-y-4">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Nombre comercial (interno)
            <input
              type="text"
              value={data.settings.shopName}
              onChange={(e) => updateSettings({ shopName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Moneda mostrada
            <input
              type="text"
              value={data.settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.settings.lowStockAlerts}
              onChange={(e) =>
                updateSettings({ lowStockAlerts: e.target.checked })
              }
              className="rounded border-zinc-300"
            />
            Alertas de stock bajo en tablero
          </label>

          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "¿Borrar la copia local en este navegador y volver a cargar desde Supabase? Si no hay conexión o falla el servidor, se usará caché vacía o el último respaldo disponible.",
                  )
                ) {
                  void reloadAppData();
                }
              }}
              className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Borrar caché local y recargar
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              No restaura datos de prueba: solo limpia localStorage y repite la
              carga inicial (Supabase primero).
            </p>
          </div>
        </CardContent>
      </Card>

      <SupabaseStatusSection />

      <Card>
        <CardHeader title="Persistencia actual" subtitle="localStorage + contrato AppData" />
        <CardContent className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            La fuente principal es <strong>Supabase</strong> cuando está
            configurado; el navegador guarda una copia en localStorage (
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
              AppData
            </code>
            ) como respaldo si falla la lectura remota. No se cargan datos demo
            automáticamente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Acceso" />
        <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
          El acceso al panel usa <strong>Supabase Auth</strong> (email y contraseña).
          Las cuentas se administran desde el dashboard de Supabase; no hay alta
          pública en esta app.
        </CardContent>
      </Card>
    </div>
  );
}
