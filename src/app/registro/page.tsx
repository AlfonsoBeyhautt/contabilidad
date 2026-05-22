"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

function RegistroForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signUpWithEmail, isAuthenticated, authReady, supabaseConfigured } =
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUpWithEmail(email, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.needsEmailConfirmation) {
        setSuccess(
          "Cuenta creada. Revisá tu email para confirmar el acceso y luego iniciá sesión.",
        );
        return;
      }
      router.refresh();
      router.replace(nextPath);
    } finally {
      setSubmitting(false);
    }
  }

  if (AUTH_DISABLED) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
        <p className="text-sm text-slate-400">Redirigiendo…</p>
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
          title="Crear cuenta"
          subtitle="Accedé al panel de gestión financiera"
        />
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[var(--success)]">
                {success}
              </p>
              <Link
                href="/login"
                className="inline-flex w-full justify-center rounded-lg bg-[var(--surface-inverted)] py-2.5 text-sm font-medium text-[var(--foreground-on-inverted)]"
              >
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
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
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-soft)]"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1.5 block text-xs font-medium text-[var(--foreground-muted)]"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-soft)]"
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
                {submitting ? "Creando cuenta…" : "Crear cuenta"}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-[12px] text-[var(--foreground-muted)]">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
              Iniciar sesión
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

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
          <p className="text-sm text-slate-400">Cargando…</p>
        </div>
      }
    >
      <RegistroForm />
    </Suspense>
  );
}
