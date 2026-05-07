import { migrateAppDataShape } from "./app-data-migrate";
import type { AppData } from "./types";

/** v2: no reutilizar payloads demo de `contabilidad_app_v1`. */
export const APP_DATA_STORAGE_KEY = "contabilidad_app_v2";

const LEGACY_APP_DATA_STORAGE_KEY = "contabilidad_app_v1";

/** Borra caché local actual y la clave heredada con datos de prueba. */
export function clearAppDataLocalStorage(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(APP_DATA_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_APP_DATA_STORAGE_KEY);
  } catch {
    /* cuota / modo privado */
  }
}

/** Solo migración: la v1 ya no se lee, se elimina para no mezclar residuos. */
export function removeLegacyAppDataStorageKey(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_APP_DATA_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Validación superficial: suficiente para evitar lecturas corruptas obvias.
 * Si el formato cambia en el futuro, se puede añadir `version` y migraciones.
 */
export function parseStoredAppData(rawUnknown: unknown): AppData | null {
  if (rawUnknown === null || typeof rawUnknown !== "object") return null;
  const o = rawUnknown as Record<string, unknown>;

  if (!Array.isArray(o.products)) return null;
  if (!Array.isArray(o.productFamilies)) {
    (o as Record<string, unknown>).productFamilies = [];
  }
  if (!Array.isArray(o.customers)) return null;
  if (!Array.isArray(o.sales)) return null;
  if (!Array.isArray(o.purchases)) return null;
  if (!Array.isArray(o.expenses)) return null;

  const settings = o.settings;
  if (settings === null || typeof settings !== "object") return null;
  const s = settings as Record<string, unknown>;
  if (typeof s.shopName !== "string") return null;
  if (typeof s.currency !== "string") return null;
  if (typeof s.lowStockAlerts !== "boolean") return null;

  return migrateAppDataShape(rawUnknown as AppData);
}

export function readAppDataFromLocalStorage(): AppData | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(APP_DATA_STORAGE_KEY);
    if (raw === null || raw === "") return null;
    const parsed = JSON.parse(raw) as unknown;
    return parseStoredAppData(parsed);
  } catch {
    return null;
  }
}

export function writeAppDataToLocalStorage(data: AppData): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* cuota agotada o modo privado */
  }
}
