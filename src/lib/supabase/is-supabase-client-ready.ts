import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** En cliente: hay URL/key y se pudo crear el cliente (Supabase es la persistencia principal). */
export function isSupabaseClientReady(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(isSupabaseConfigured() && getSupabaseBrowserClient());
}
