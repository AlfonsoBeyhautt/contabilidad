import { getSupabaseBrowserClient } from "./client";

/**
 * Comprueba conectividad y credenciales vía función `health_check` (SECURITY DEFINER).
 * Funciona incluso sin sesión (anon), sin exponer datos.
 */
export async function pingSupabase(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("health_check");
  if (error || data !== true) return false;
  return true;
}
