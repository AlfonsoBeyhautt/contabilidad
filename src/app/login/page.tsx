"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Package } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signInWithEmail, isAuthenticated, authReady, supabaseConfigured } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (authReady && supabaseConfigured && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [authReady, supabaseConfigured, isAuthenticated, router, nextPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signInWithEmail(email, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      router.replace(nextPath);
    } finally {
      setSubmitting(false);
    }
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Cargando…</p>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-200 px-4 dark:from-zinc-950 dark:to-zinc-900">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <Package className="h-6 w-6" aria-hidden />
        </div>
        <Card className="w-full max-w-md shadow-md">
          <CardHeader
            title="Supabase no configurado"
            subtitle="No se puede iniciar sesión hasta definir las credenciales"
          />
          <CardContent className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              Agregá en la raíz del proyecto un archivo{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">.env.local</code> con:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 font-mono text-xs">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            </ul>
            <p className="mt-3">
              Obtené los valores en el panel de Supabase →{" "}
              <strong>Project Settings → API</strong>. Luego reiniciá{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">npm run dev</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-200 px-4 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Package className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Acceso administrativo
        </h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Herramienta interna de contabilidad y gestión. Solo el dueño puede
          entrar; no hay registro público.
        </p>
      </div>

      <Card className="w-full max-w-md shadow-md">
        <CardHeader
          title="Iniciar sesión"
          subtitle="Email y contraseña de tu cuenta en Supabase Auth"
        />
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="••••••••"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {submitting ? "Entrando…" : "Entrar al panel"}
            </button>
            <p className="text-center text-[11px] text-zinc-500">
              Las cuentas se crean desde el panel de Supabase (Auth → Users) o
              invitación; esta app no ofrece registro público.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">Cargando…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
