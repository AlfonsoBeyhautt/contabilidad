"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Package } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AUTH_DISABLED } from "@/lib/feature-flags";
import { APP_HOME } from "@/lib/public-routes";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return APP_HOME;
  }
  if (next === "/" || next === "/login" || next === "/registro") {
    return APP_HOME;
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
    if (AUTH_DISABLED) {
      router.replace(APP_HOME);
      return;
    }
    if (authReady && supabaseConfigured && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [authReady, supabaseConfigured, isAuthenticated, router, nextPath]);

  if (AUTH_DISABLED) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
        <p className="text-sm text-slate-400">Redirigiendo al panel…</p>
      </div>
    );
  }

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
      <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#05070d] via-[#0a0e18] to-[#05070d] px-4 py-12">
        <Link href="/" className="mb-8 text-sm text-slate-400 hover:text-white">
          ← Volver al inicio
        </Link>
        <Card className="w-full max-w-md shadow-md">
          <CardHeader
            title="Supabase no configurado"
            subtitle="No se puede iniciar sesión hasta definir las credenciales"
          />
          <CardContent className="text-sm leading-relaxed text-[var(--foreground-muted)]">
            <p>
              Agregá en la raíz del proyecto un archivo{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1">
                .env.local
              </code>{" "}
              con:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 font-mono text-xs">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#05070d] via-[#0a0e18] to-[#05070d] px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-slate-400 transition hover:text-white"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#6366f1] text-white">
          <Package className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-[14px] font-semibold text-white">
          Contabilidad<span className="text-blue-400">D</span>
        </span>
      </Link>

      <Card className="w-full max-w-md border-[var(--border)] shadow-xl">
        <CardHeader
          title="Iniciar sesión"
          subtitle="Email y contraseña de tu cuenta"
        />
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-[var(--foreground-muted)]"
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
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-soft)]"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium text-[var(--foreground-muted)]"
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
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-soft)]"
                placeholder="••••••••"
              />
            </div>
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[var(--surface-inverted)] py-2.5 text-sm font-medium text-[var(--foreground-on-inverted)] transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Entrando…" : "Entrar al panel"}
            </button>
          </form>
          <p className="mt-4 text-center text-[12px] text-[var(--foreground-muted)]">
            ¿No tenés cuenta?{" "}
            <Link
              href="/registro"
              className="font-medium text-[var(--accent)] hover:underline"
            >
              Crear cuenta
            </Link>
          </p>
          <p className="mt-2 text-center text-[11px] text-[var(--foreground-subtle)]">
            <Link href="/" className="hover:text-[var(--foreground-muted)]">
              ← Volver al inicio
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
          <p className="text-sm text-slate-400">Cargando…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
