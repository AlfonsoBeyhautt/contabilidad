import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./env";

/**
 * Una sola instancia en el navegador: varias instancias de `createBrowserClient`
 * pueden provocar sesión inconsistente y fallos RLS al guardar.
 */
let browserClient: SupabaseClient | null = null;

/**
 * Cliente para componentes cliente (cookies / sesión con `@supabase/ssr`).
 * Devuelve `null` cuando faltan env vars — el DataProvider sigue usando localStorage.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null;
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
