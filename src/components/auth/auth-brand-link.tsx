import Link from "next/link";
import { Package } from "lucide-react";

export function AuthBrandLink() {
  return (
    <Link
      href="/"
      className="mb-8 flex items-center gap-2 text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-[var(--shadow-sm)]">
        <Package className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-[14px] font-semibold text-[var(--foreground-strong)]">
        Contabilidad<span className="text-[var(--accent)]">D</span>
      </span>
    </Link>
  );
}
