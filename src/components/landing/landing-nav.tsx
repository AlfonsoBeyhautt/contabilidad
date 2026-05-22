"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Package, X } from "lucide-react";
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

  const panelHref = isAuthenticated ? APP_HOME : "/login";
  const panelLabel = isAuthenticated ? "Ir al panel" : "Iniciar sesión";
  const signupHref = "/registro";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,transparent)] shadow-[var(--shadow-sm)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-[var(--shadow-sm)]">
            <Package className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--foreground-strong)]">
            Contabilidad<span className="text-[var(--accent)]">D</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href={panelHref}
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
          >
            {panelLabel}
          </Link>
          {!isAuthenticated ? (
            <Link
              href={signupHref}
              className="rounded-lg bg-[var(--surface-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--foreground-on-inverted)] shadow-[var(--shadow-sm)] transition hover:opacity-90"
            >
              Crear cuenta
            </Link>
          ) : (
            <Link
              href={APP_HOME}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] transition hover:opacity-90"
            >
              Entrar
            </Link>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-[var(--foreground-muted)] md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-[var(--foreground)]"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <Link
              href={panelHref}
              className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-center text-[13px] font-medium text-[var(--foreground)]"
            >
              {panelLabel}
            </Link>
            {!isAuthenticated ? (
              <Link
                href={signupHref}
                className="rounded-lg bg-[var(--surface-inverted)] px-4 py-2.5 text-center text-[13px] font-semibold text-[var(--foreground-on-inverted)]"
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
