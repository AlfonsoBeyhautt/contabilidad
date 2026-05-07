import type { Product, ProductFamily } from "./types";

/** Etiqueta principal: prenda · modelo (sin talle). */
export function buildVariantDisplayName(familyName: string, model: string): string {
  const m = (model ?? "").trim();
  const bits = [familyName.trim()];
  if (m) bits.push(m);
  return bits.filter(Boolean).join(" · ");
}

export function syncVariantLabels(
  families: ProductFamily[],
  products: Product[],
): Product[] {
  const fmap = new Map(families.map((f) => [f.id, f]));
  return products.map((p) => {
    const f = fmap.get(p.familyId);
    const fname = f?.name ?? "";
    return {
      ...p,
      category: f?.category ?? p.category,
      name: buildVariantDisplayName(fname, p.model),
    };
  });
}

export function generateVariantSku(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `AUTO-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `AUTO-${Date.now().toString(36)}`;
}
