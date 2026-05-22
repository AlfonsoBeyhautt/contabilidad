"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  LineChart,
  Package,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { APP_HOME } from "@/lib/public-routes";
import { LandingNav } from "./landing-nav";

const stats = [
  { value: "1 panel", label: "Ingresos, egresos y resultado" },
  { value: "Stock", label: "Inventario por familia y talle" },
  { value: "IA", label: "Análisis ejecutivo opcional" },
  { value: "PDF", label: "Reportes profesionales" },
] as const;

const features = [
  {
    icon: LineChart,
    title: "Dashboard financiero",
    description:
      "Ingresos, egresos totales y resultado neto en un vistazo. Períodos flexibles y lectura ejecutiva sin ruido.",
  },
  {
    icon: TrendingUp,
    title: "Ventas y operación",
    description:
      "Registrá ventas, productos, variantes y movimientos de stock con trazabilidad clara.",
  },
  {
    icon: Wallet,
    title: "Gastos y costos",
    description:
      "Gastos operativos, compras, defectuosos y recurrencias integrados al cierre del período.",
  },
  {
    icon: Brain,
    title: "Inteligencia del negocio",
    description:
      "Motor determinístico de insights y health score; capa de IA para informe ejecutivo y preguntas puntuales.",
  },
] as const;

const steps = [
  {
    n: "01",
    title: "Creá tu cuenta",
    body: "Registrate con email y contraseña. Si tu proyecto requiere confirmación por mail, activás el acceso en un paso.",
  },
  {
    n: "02",
    title: "Cargá tu operación",
    body: "Ventas, stock, gastos y clientes en un solo flujo. Los números se calculan automáticamente en cada sección.",
  },
  {
    n: "03",
    title: "Decidí con datos",
    body: "Revisá el dashboard, la inteligencia del negocio y exportá reportes PDF cuando necesites presentar resultados.",
  },
] as const;

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`landing-fade-up ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated, authReady } = useAuth();
  const authed = authReady && isAuthenticated;
  const signupHref = authed ? APP_HOME : "/registro";
  const loginHref = "/login";
  const primaryLabel = authed ? "Entrar al panel" : "Crear cuenta gratis";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="landing-pulse-glow absolute -left-32 top-20 h-[420px] w-[420px] rounded-full bg-[var(--accent-soft)] opacity-80 blur-[100px]" />
        <div
          className="landing-pulse-glow absolute -right-24 top-1/3 h-[360px] w-[360px] rounded-full bg-[var(--accent-soft)] opacity-60 blur-[90px]"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <LandingNav isAuthenticated={authed} />

      <main className="relative pt-24">
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-28 lg:pt-16">
          <FadeIn>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Gestión financiera para tu negocio
            </p>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="mt-6 max-w-3xl text-[36px] font-semibold leading-[1.08] tracking-tight text-[var(--foreground-strong)] sm:text-[48px] lg:text-[56px]">
              Entendé tu negocio en segundos:{" "}
              <span className="text-[var(--accent)]">
                ingresos, egresos y resultado
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--foreground-muted)] sm:text-[18px]">
              ContabilidadD centraliza ventas, stock, gastos e inteligencia en un panel
              sobrio y profesional. Sin hojas de cálculo dispersas ni dashboards
              confusos.
            </p>
          </FadeIn>
          <FadeIn delay={240} className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={signupHref}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface-inverted)] px-6 py-3.5 text-[14px] font-semibold text-[var(--foreground-on-inverted)] shadow-[var(--shadow-md)] transition hover:opacity-90 active:scale-[0.98]"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {!authed ? (
              <Link
                href={loginHref}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3.5 text-[14px] font-medium text-[var(--foreground)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface-muted)]"
              >
                Iniciar sesión
              </Link>
            ) : null}
          </FadeIn>

          <FadeIn delay={320} className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-xs)] transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
              >
                <p className="text-[22px] font-semibold tracking-tight text-[var(--foreground-strong)]">
                  {s.value}
                </p>
                <p className="mt-1 text-[12px] text-[var(--foreground-muted)]">
                  {s.label}
                </p>
              </div>
            ))}
          </FadeIn>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="landing-float relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]">
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)] opacity-70" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning)] opacity-70" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)] opacity-70" />
                <span className="ml-2 text-[11px] text-[var(--foreground-subtle)]">
                  Panel · Inicio
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {[
                  { label: "Ingresos", value: "$ 4.280.000", tone: "text-[var(--success)]" },
                  { label: "Egresos", value: "$ 3.120.000", tone: "text-[var(--warning)]" },
                  { label: "Resultado", value: "$ 1.160.000", tone: "text-[var(--accent)]" },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
                      {k.label}
                    </p>
                    <p className={`mt-1 text-lg font-semibold tabular-nums ${k.tone}`}>
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </section>

        <section
          id="funciones"
          className="scroll-mt-24 border-t border-[var(--border)] bg-[var(--surface-muted)] py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Funciones
            </p>
            <h2 className="mt-3 text-center text-[28px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[34px]">
              Todo lo que necesitás para operar y cerrar el mes
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] text-[var(--foreground-muted)]">
              Diseñado para dueños y equipos chicos que quieren claridad financiera sin
              complejidad innecesaria.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {features.map((f, i) => (
                <FadeIn key={f.title} delay={i * 60}>
                  <article className="group h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xs)] transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] transition group-hover:bg-[var(--accent-soft)]">
                      <f.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-[17px] font-semibold text-[var(--foreground-strong)]">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--foreground-muted)]">
                      {f.description}
                    </p>
                  </article>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">
              Implementación simple
            </p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[34px]">
              Cómo funciona
            </h2>
            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              {steps.map((s, i) => (
                <FadeIn key={s.n} delay={i * 100}>
                  <div className="relative">
                    <span className="text-[48px] font-bold leading-none text-[var(--border-strong)]">
                      {s.n}
                    </span>
                    <h3 className="mt-2 text-[18px] font-semibold text-[var(--foreground-strong)]">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--foreground-muted)]">
                      {s.body}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section
          id="inteligencia"
          className="scroll-mt-24 border-y border-[var(--border)] bg-[var(--surface-muted)] py-20 sm:py-24"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                Inteligencia del negocio
              </p>
              <h2 className="mt-3 text-[28px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[32px]">
                Datos reales primero. IA cuando la necesitás.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--foreground-muted)]">
                El motor calcula métricas, health score e insights con reglas propias.
                Opcionalmente, generá un análisis ejecutivo estructurado o hacé preguntas
                puntuales sobre el período.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Health score y estado financiero del período",
                  "Informe ejecutivo IA en bloques (no chat genérico)",
                  "Reportes PDF con estilo corporativo",
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-[14px] text-[var(--foreground)]">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]"
                      aria-hidden
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)]">
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <BarChart3 className="h-5 w-5" aria-hidden />
                <span className="text-[13px] font-semibold">Vista previa</span>
              </div>
              <div className="mt-4 space-y-3">
                {["Estado general", "Lectura financiera", "Prioridades"].map(
                  (block) => (
                    <div
                      key={block}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                        {block}
                      </p>
                      <div className="mt-2 h-2 w-full rounded-full bg-[var(--border)]">
                        <div className="h-2 w-2/3 rounded-full bg-[var(--accent)]" />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Package
              className="mx-auto h-10 w-10 text-[var(--accent)] opacity-80"
              aria-hidden
            />
            <h2 className="mt-6 text-[30px] font-semibold tracking-tight text-[var(--foreground-strong)] sm:text-[36px]">
              Empezá a leer tu negocio con claridad
            </h2>
            <p className="mt-4 text-[16px] text-[var(--foreground-muted)]">
              Creá tu cuenta o iniciá sesión. Al cerrar sesión volvés a esta página
              cuando quieras.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={signupHref}
                className="rounded-xl bg-[var(--surface-inverted)] px-6 py-3.5 text-[14px] font-semibold text-[var(--foreground-on-inverted)] shadow-[var(--shadow-md)] transition hover:opacity-90"
              >
                {authed ? "Ir al panel" : "Crear cuenta"}
              </Link>
              {!authed ? (
                <Link
                  href={loginHref}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3.5 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                >
                  Ya tengo cuenta
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-[12px] text-[var(--foreground-subtle)] sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} ContabilidadD</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-[var(--foreground-muted)]">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="hover:text-[var(--foreground-muted)]">
              Registro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
