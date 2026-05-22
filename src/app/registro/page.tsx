"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AuthBrandLink } from "@/components/auth/auth-brand-link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 py-12">
      <AuthBrandLink />

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
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <p className="text-sm text-[var(--foreground-muted)]">Cargando…</p>
        </div>
      }
    >
      <RegistroForm />
    </Suspense>
  );
}
