"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SupabaseStatusSection } from "./supabase-status";
import { useAppData } from "@/contexts/data-context";

const MAX_LOGO_BYTES = 300 * 1024;

export function ConfigView() {
  const { data, dataSource, updateSettings, reloadAppData } = useAppData();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });
  }

  async function handleLogoFile(file: File) {
    setLogoError(null);
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.type)) {
      setLogoError("Formato no soportado. Usá PNG, JPG, WEBP o SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(
        `El archivo pesa ${Math.round(file.size / 1024)} KB. Máximo ${Math.round(MAX_LOGO_BYTES / 1024)} KB.`,
      );
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateSettings({ logoDataUrl: dataUrl });
    } catch {
      setLogoError("No se pudo leer el archivo. Probá otro.");
    }
  }
  const sourceLabel =
    dataSource === "supabase"
      ? "Supabase"
      : dataSource === "local_fallback"
        ? "Local backup"
        : "Vacío (sin backup local)";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader
          title="Identidad del negocio"
          subtitle="Visible solo en este panel administrativo"
        />
        <CardContent className="space-y-4">
          <label className="block text-xs font-medium text-[var(--foreground-muted)]">
            Nombre comercial (interno)
            <input
              type="text"
              value={data.settings.shopName}
              onChange={(e) => updateSettings({ shopName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-[var(--foreground-muted)]">
            Moneda mostrada
            <input
              type="text"
              value={data.settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.settings.lowStockAlerts}
              onChange={(e) =>
                updateSettings({ lowStockAlerts: e.target.checked })
              }
              className="rounded border-[var(--border-strong)]"
            />
            Alertas de stock bajo en tablero
          </label>

          <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                Logo del negocio
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Se muestra en los reportes PDF. PNG / JPG / WEBP / SVG, máximo{" "}
                {Math.round(MAX_LOGO_BYTES / 1024)} KB. Recomendado: cuadrado o
                rectangular con fondo transparente.
              </p>
              <div className="mt-3 flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]">
                  {data.settings.logoDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={data.settings.logoDataUrl}
                      alt="Logo del negocio"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImageIcon
                      className="h-8 w-8 text-[var(--foreground-subtle)]"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden />
                      {data.settings.logoDataUrl ? "Reemplazar logo" : "Subir logo"}
                    </button>
                    {data.settings.logoDataUrl ? (
                      <button
                        type="button"
                        onClick={() => updateSettings({ logoDataUrl: undefined })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Quitar
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handleLogoFile(file);
                      e.target.value = "";
                    }}
                  />
                  {logoError ? (
                    <p
                      role="alert"
                      className="text-xs text-[var(--danger)]"
                    >
                      {logoError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <label className="block text-xs font-medium text-[var(--foreground-muted)]">
              Pie de página de los PDF (opcional)
              <input
                type="text"
                value={data.settings.legalFooter ?? ""}
                onChange={(e) =>
                  updateSettings({ legalFooter: e.target.value })
                }
                placeholder="Ej: CUIT 20-XXXXXXXX-X · contacto@empresa.com"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4">
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
              className="w-full rounded-lg border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            >
              Borrar caché local y recargar
            </button>
            <p className="mt-2 text-xs text-[var(--foreground-muted)]">
              No restaura datos de prueba: solo limpia localStorage y repite la
              carga inicial (Supabase primero).
            </p>
          </div>
        </CardContent>
      </Card>

      <SupabaseStatusSection />

      <Card>
        <CardHeader title="Persistencia actual" subtitle="localStorage + contrato AppData" />
        <CardContent className="text-sm leading-relaxed text-[var(--foreground-muted)]">
          <p className="mb-2">
            Fuente actual:{" "}
            <strong
              className={
                dataSource === "supabase"
                  ? "text-[var(--success)]"
                  : "text-[var(--warning)]"
              }
            >
              {sourceLabel}
            </strong>
          </p>
          <p>
            La fuente principal es <strong>Supabase</strong> cuando está
            configurado; el navegador guarda una copia en localStorage (
            <code className="rounded bg-[var(--surface-muted)] px-1">
              AppData
            </code>
            ) como respaldo si falla la lectura remota. No se cargan datos demo
            automáticamente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Acceso" />
        <CardContent className="text-sm text-[var(--foreground-muted)]">
          El acceso al panel usa <strong>Supabase Auth</strong> (email y contraseña).
          Las cuentas se administran desde el dashboard de Supabase; no hay alta
          pública en esta app.
        </CardContent>
      </Card>
    </div>
  );
}
