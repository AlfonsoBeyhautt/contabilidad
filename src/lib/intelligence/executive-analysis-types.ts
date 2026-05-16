export type ExecutiveAnalysisSections = {
  estado_general: string;
  lectura_financiera: string;
  que_funciona: string | string[];
  problemas_principales: string | string[];
  riesgos: string | string[];
  oportunidades: string | string[];
  prioridades_de_accion: string | string[];
  conclusion_ejecutiva: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function asStringBlock(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function asStringOrList(v: unknown): string | string[] {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    const out = v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    return out.length === 0 ? "" : out.length === 1 ? out[0]! : out;
  }
  return "";
}

function normalizeFlexible(v: unknown): string | string[] {
  const block = asStringOrList(v);
  if (typeof block === "string") return block || "—";
  return block.length > 0 ? block : "—";
}

export function parseExecutiveAnalysisJson(raw: string): ExecutiveAnalysisSections | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/u, "")
      .trim();
  }
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  return {
    estado_general: asStringBlock(data.estado_general) || "—",
    lectura_financiera: asStringBlock(data.lectura_financiera) || "—",
    que_funciona: normalizeFlexible(data.que_funciona),
    problemas_principales: normalizeFlexible(data.problemas_principales),
    riesgos: normalizeFlexible(data.riesgos),
    oportunidades: normalizeFlexible(data.oportunidades),
    prioridades_de_accion: normalizeFlexible(data.prioridades_de_accion),
    conclusion_ejecutiva: asStringBlock(data.conclusion_ejecutiva) || "—",
  };
}
