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
import { AUTH_DISABLED } from "@/lib/feature-flags";
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
  const panelHref = AUTH_DISABLED ? APP_HOME : isAuthenticated ? APP_HOME : "/registro";
  const loginHref = AUTH_DISABLED ? APP_HOME : "/login";

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="landing-pulse-glow absolute -left-32 top-20 h-[420px] w-[420px] rounded-full bg-blue-600/20 blur-[100px]" />
        <div
          className="landing-pulse-glow absolute -right-24 top-1/3 h-[360px] w-[360px] rounded-full bg-indigo-600/15 blur-[90px]"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute bottom-0 left-1/2 h-[280px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[80px]" />
      </div>

      <LandingNav isAuthenticated={authReady && isAuthenticated} />

      <main className="relative pt-24">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-28 lg:pt-16">
          <FadeIn>
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Gestión financiera para tu negocio
            </p>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="mt-6 max-w-3xl text-[36px] font-semibold leading-[1.08] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
              Entendé tu negocio en segundos:{" "}
              <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                ingresos, egresos y resultado
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-slate-400 sm:text-[18px]">
              ContabilidadD centraliza ventas, stock, gastos e inteligencia en un panel
              sobrio y profesional. Sin hojas de cálculo dispersas ni dashboards
              confusos.
            </p>
          </FadeIn>
          <FadeIn delay={240} className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={panelHref}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#6366f1] px-6 py-3.5 text-[14px] font-semibold text-white shadow-xl shadow-blue-600/25 transition hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]"
            >
              {AUTH_DISABLED || isAuthenticated
                ? "Entrar al panel"
                : "Crear cuenta gratis"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={loginHref}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-[14px] font-medium text-slate-200 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/10"
            >
              Iniciar sesión
            </Link>
          </FadeIn>

          <FadeIn delay={320} className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <p className="text-[22px] font-semibold tracking-tight text-white">
                  {s.value}
                </p>
                <p className="mt-1 text-[12px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </FadeIn>
        </section>

        {/* Mock dashboard preview */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="landing-float relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-1 shadow-2xl shadow-black/40">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-[11px] text-slate-500">Panel · Inicio</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {[
                  { label: "Ingresos", value: "$ 4.280.000", tone: "text-emerald-400" },
                  { label: "Egresos", value: "$ 3.120.000", tone: "text-amber-300" },
                  { label: "Resultado", value: "$ 1.160.000", tone: "text-blue-300" },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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

        {/* Features */}
        <section
          id="funciones"
          className="scroll-mt-24 border-t border-white/10 bg-[#070a12]/50 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-400">
              Funciones
            </p>
            <h2 className="mt-3 text-center text-[28px] font-semibold tracking-tight text-white sm:text-[34px]">
              Todo lo que necesitás para operar y cerrar el mes
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] text-slate-400">
              Diseñado para dueños y equipos chicos que quieren claridad financiera sin
              complejidad innecesaria.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {features.map((f, i) => (
                <FadeIn key={f.title} delay={i * 60}>
                  <article className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-blue-500/30 hover:bg-white/[0.05]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 transition group-hover:bg-blue-500/25">
                      <f.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-[17px] font-semibold text-white">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-slate-400">
                      {f.description}
                    </p>
                  </article>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="como-funciona" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Implementación simple
            </p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-white sm:text-[34px]">
              Cómo funciona
            </h2>
            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              {steps.map((s, i) => (
                <FadeIn key={s.n} delay={i * 100}>
                  <div className="relative">
                    <span className="text-[48px] font-bold leading-none text-white/10">
                      {s.n}
                    </span>
                    <h3 className="mt-2 text-[18px] font-semibold text-white">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-slate-400">
                      {s.body}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Intelligence */}
        <section
          id="inteligencia"
          className="scroll-mt-24 border-y border-white/10 bg-gradient-to-br from-blue-950/40 via-[#070a12] to-indigo-950/30 py-20 sm:py-24"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-300">
                Inteligencia del negocio
              </p>
              <h2 className="mt-3 text-[28px] font-semibold tracking-tight text-white sm:text-[32px]">
                Datos reales primero. IA cuando la necesitás.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
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
                  <li key={t} className="flex gap-2 text-[14px] text-slate-300">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                      aria-hidden
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 shadow-xl">
              <div className="flex items-center gap-2 text-indigo-300">
                <BarChart3 className="h-5 w-5" aria-hidden />
                <span className="text-[13px] font-semibold">Vista previa</span>
              </div>
              <div className="mt-4 space-y-3">
                {["Estado general", "Lectura financiera", "Prioridades"].map(
                  (block) => (
                    <div
                      key={block}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {block}
                      </p>
                      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                        <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Package
              className="mx-auto h-10 w-10 text-blue-400 opacity-80"
              aria-hidden
            />
            <h2 className="mt-6 text-[30px] font-semibold tracking-tight text-white sm:text-[36px]">
              Empezá a leer tu negocio con claridad
            </h2>
            <p className="mt-4 text-[16px] text-slate-400">
              Creá tu cuenta o iniciá sesión. Al cerrar sesión volvés a esta página
              cuando quieras.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={panelHref}
                className="rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-[#0a0c12] shadow-lg transition hover:bg-slate-100"
              >
                Crear cuenta
              </Link>
              <Link
                href={loginHref}
                className="rounded-xl border border-white/20 px-6 py-3.5 text-[14px] font-medium text-white transition hover:bg-white/10"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-[12px] text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} ContabilidadD</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-slate-300">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="hover:text-slate-300">
              Registro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
