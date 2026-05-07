"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type SignInResult = { ok: true } | { ok: false; message: string };

type AuthContextValue = {
  supabaseConfigured: boolean;
  user: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabaseConfigured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setUser(null);
      setAuthReady(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabaseConfigured]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return {
          ok: false,
          message:
            "Supabase no está configurado. Agregá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local y reiniciá el servidor.",
        };
      }
      const trimmed = email.trim();
      if (!trimmed || !password) {
        return { ok: false, message: "Completá email y contraseña." };
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    router.refresh();
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      supabaseConfigured,
      user,
      isAuthenticated: Boolean(supabaseConfigured && user),
      authReady,
      signInWithEmail,
      logout,
    }),
    [supabaseConfigured, user, authReady, signInWithEmail, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
