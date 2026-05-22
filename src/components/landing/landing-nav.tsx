"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Package, X } from "lucide-react";
import { AUTH_DISABLED } from "@/lib/feature-flags";
import { APP_HOME } from "@/lib/public-routes";

const links = [
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#inteligencia", label: "Inteligencia" },
];

export function LandingNav({ isAuthenticated }: { isAuthenticated?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const enterHref = AUTH_DISABLED ? APP_HOME : isAuthenticated ? APP_HOME : "/login";
  const enterLabel = AUTH_DISABLED
    ? "Ir al panel"
    : isAuthenticated
      ? "Ir al panel"
      : "Iniciar sesión";
  const signupHref = AUTH_DISABLED ? APP_HOME : "/registro";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-[#070a12]/85 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#6366f1] text-white shadow-lg shadow-blue-500/25">
            <Package className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Contabilidad<span className="text-blue-400">D</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium text-slate-300 transition hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href={enterHref}
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-200 transition hover:text-white"
          >
            {enterLabel}
          </Link>
          {!AUTH_DISABLED && !isAuthenticated ? (
            <Link
              href={signupHref}
              className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-[#0a0c12] shadow-md transition hover:bg-slate-100"
            >
              Crear cuenta
            </Link>
          ) : (
            <Link
              href={enterHref}
              className="rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#6366f1] px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:opacity-95"
            >
              Entrar
            </Link>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-300 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-[#070a12]/95 px-4 py-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-slate-200"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
            <Link
              href={enterHref}
              className="rounded-lg border border-white/15 px-4 py-2.5 text-center text-[13px] font-medium text-white"
            >
              {enterLabel}
            </Link>
            {!AUTH_DISABLED && !isAuthenticated ? (
              <Link
                href={signupHref}
                className="rounded-lg bg-white px-4 py-2.5 text-center text-[13px] font-semibold text-[#0a0c12]"
              >
                Crear cuenta
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
