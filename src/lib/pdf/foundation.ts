/**
 * Fundación de los PDFs corporativos.
 *
 * Patrón visual:
 *  - Banda lateral izquierda gris oscuro (acento de marca).
 *  - Letterhead con logo del negocio + nombre + tagline + período.
 *  - KPI cards (rectángulos con borde fino y números grandes).
 *  - Secciones con barra delgada de color y subtítulo en gris.
 *  - Tablas con `jspdf-autotable` y estilos custom (hairlines + zebra).
 *  - Gráficos vectoriales: barras horizontales/verticales, línea, donut.
 *  - Pie de página con paginación, nombre del negocio y `legalFooter`.
 *
 * Toda la unidad es mm (jsPDF default), A4 portrait: 210 x 297.
 */
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { AppSettings } from "@/lib/data/types";
import { formatCurrency, formatDate } from "@/lib/format";

export const PAGE = {
  width: 210,
  height: 297,
  marginX: 18,
  marginTop: 22,
  marginBottom: 18,
  contentLeft: 18,
  contentRight: 192,
  contentWidth: 192 - 18,
};

export const COLORS = {
  /** Casi negro: títulos, headers de tabla. */
  ink: [24, 24, 27] as [number, number, number],
  /** Gris medio: texto secundario. */
  mute: [113, 113, 122] as [number, number, number],
  /** Gris claro: bordes hairline. */
  hairline: [212, 212, 216] as [number, number, number],
  /** Fondo de zebra rows. */
  zebra: [248, 248, 250] as [number, number, number],
  /** Acento principal (banda lateral, barras gráficos). */
  accent: [28, 31, 46] as [number, number, number],
  /** Verde profesional para resultados positivos. */
  positive: [21, 128, 61] as [number, number, number],
  /** Rojo profesional para resultados negativos. */
  negative: [185, 28, 28] as [number, number, number],
  /** Ámbar para advertencias. */
  warn: [180, 83, 9] as [number, number, number],
  /** Azul corporativo para serie secundaria. */
  blue: [37, 78, 138] as [number, number, number],
  /** Blanco. */
  white: [255, 255, 255] as [number, number, number],
};

export type DocContext = {
  doc: jsPDF;
  settings: AppSettings;
  /** Etiqueta de período humanizada para el header. */
  periodLabel: string;
  /** Título del informe (ej. "Reporte de ventas"). */
  title: string;
  /** Subtítulo opcional para el header (ej. "Mensual · mayo 2026"). */
  subtitle?: string;
  /** Cursor Y para escribir el siguiente bloque. */
  y: number;
};

/** Setea el color de relleno actual (compatibilidad con tuplas). */
function setFill(
  doc: jsPDF,
  rgb: [number, number, number] | { r: number; g: number; b: number },
): void {
  if (Array.isArray(rgb)) doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  else doc.setFillColor(rgb.r, rgb.g, rgb.b);
}

function setDraw(doc: jsPDF, rgb: [number, number, number]): void {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: [number, number, number]): void {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

/** Detecta el formato de imagen desde un data URL. */
function detectImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" | null {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
    return "JPEG";
  }
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  // SVG no soportado directamente por addImage; el caller debe convertir.
  return null;
}

/**
 * Encabezado corporativo: banda lateral, logo opcional, título y período.
 * Se llama en cada página automáticamente vía `renderPage`, pero los reportes
 * inicializan el primer header con `drawLetterhead`.
 */
export function drawLetterhead(ctx: DocContext): void {
  const { doc, settings, title, subtitle, periodLabel } = ctx;

  // Banda lateral izquierda
  setFill(doc, COLORS.accent);
  doc.rect(0, 0, 6, PAGE.height, "F");

  // Logo (si hay)
  let textOffsetX = PAGE.contentLeft;
  if (settings.logoDataUrl) {
    const fmt = detectImageFormat(settings.logoDataUrl);
    if (fmt) {
      try {
        doc.addImage(
          settings.logoDataUrl,
          fmt,
          PAGE.contentLeft,
          12,
          18,
          18,
          undefined,
          "FAST",
        );
        textOffsetX = PAGE.contentLeft + 22;
      } catch {
        // si la imagen está corrupta, seguimos sin logo
      }
    }
  }

  // Nombre del negocio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, COLORS.ink);
  const shopName = settings.shopName?.trim() || "Mi negocio";
  doc.text(shopName.toUpperCase(), textOffsetX, 18);

  // Título del informe
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setText(doc, COLORS.ink);
  doc.text(title, textOffsetX, 25);

  // Subtítulo / período
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, COLORS.mute);
  if (subtitle) doc.text(subtitle, textOffsetX, 30);
  doc.text(`Período: ${periodLabel}`, textOffsetX, subtitle ? 34 : 30);

  // Fecha de emisión (alineada a la derecha)
  doc.setFontSize(8);
  setText(doc, COLORS.mute);
  doc.text(
    `Emitido: ${formatDate(new Date().toISOString())}`,
    PAGE.contentRight,
    18,
    { align: "right" },
  );

  // Línea separadora
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.3);
  doc.line(PAGE.contentLeft, 38, PAGE.contentRight, 38);

  ctx.y = 44;
}

/**
 * Pie corporativo con número de página, nombre del negocio y legend opcional.
 * Se invoca al final, una vez sabidas las páginas totales.
 */
export function drawFooters(ctx: DocContext): void {
  const { doc, settings } = ctx;
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setDraw(doc, COLORS.hairline);
    doc.setLineWidth(0.2);
    doc.line(
      PAGE.contentLeft,
      PAGE.height - 14,
      PAGE.contentRight,
      PAGE.height - 14,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, COLORS.mute);

    const left = settings.shopName?.trim() || "Mi negocio";
    doc.text(left, PAGE.contentLeft, PAGE.height - 9);

    const center = settings.legalFooter?.trim() ?? "Documento generado automáticamente";
    doc.text(center, PAGE.width / 2, PAGE.height - 9, { align: "center" });

    doc.text(
      `Página ${i} de ${pages}`,
      PAGE.contentRight,
      PAGE.height - 9,
      { align: "right" },
    );
  }
}

/** Verifica si hay espacio vertical; si no, agrega página y vuelve a pintar header. */
export function ensureSpace(ctx: DocContext, needed: number): void {
  if (ctx.y + needed > PAGE.height - PAGE.marginBottom) {
    ctx.doc.addPage();
    ctx.y = 0;
    drawLetterhead(ctx);
  }
}

/** Título de sección con barra delgada acentuada. */
export function drawSection(
  ctx: DocContext,
  title: string,
  subtitle?: string,
): void {
  ensureSpace(ctx, 16);
  const { doc } = ctx;
  setFill(doc, COLORS.accent);
  doc.rect(PAGE.contentLeft, ctx.y, 2.5, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, COLORS.ink);
  doc.text(title, PAGE.contentLeft + 5, ctx.y + 5.2);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, COLORS.mute);
    doc.text(subtitle, PAGE.contentLeft + 5, ctx.y + 10);
    ctx.y += 14;
  } else {
    ctx.y += 11;
  }
}

export type KpiCard = {
  label: string;
  value: string;
  hint?: string;
  /** "positive" | "negative" | "neutral" para el color del valor. */
  tone?: "positive" | "negative" | "warn" | "neutral";
};

/**
 * Grilla horizontal de KPIs (3 o 4 por fila). Recibe ancho de página completo.
 * Acomoda automáticamente saltos cuando hay > 4.
 */
export function drawKpiGrid(ctx: DocContext, cards: KpiCard[]): void {
  if (cards.length === 0) return;
  ensureSpace(ctx, 32);
  const { doc } = ctx;
  const perRow = cards.length <= 3 ? cards.length : 4;
  const rows = Math.ceil(cards.length / perRow);
  const gap = 4;
  const w = (PAGE.contentWidth - gap * (perRow - 1)) / perRow;
  const h = 24;

  for (let i = 0; i < cards.length; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = PAGE.contentLeft + col * (w + gap);
    const y = ctx.y + row * (h + gap);

    setFill(doc, COLORS.white);
    setDraw(doc, COLORS.hairline);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");

    const c = cards[i];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(doc, COLORS.mute);
    doc.text(c.label.toUpperCase(), x + 4, y + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const tone = c.tone ?? "neutral";
    const valueColor =
      tone === "positive"
        ? COLORS.positive
        : tone === "negative"
          ? COLORS.negative
          : tone === "warn"
            ? COLORS.warn
            : COLORS.ink;
    setText(doc, valueColor);
    doc.text(c.value, x + 4, y + 14.5);

    if (c.hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setText(doc, COLORS.mute);
      doc.text(c.hint, x + 4, y + 20);
    }
  }
  ctx.y += rows * (h + gap) + 4;
}

/** Texto explicativo / conclusión. */
export function drawParagraph(
  ctx: DocContext,
  text: string,
  opts?: { bold?: boolean; size?: number },
): void {
  const lines = ctx.doc.splitTextToSize(
    text,
    PAGE.contentWidth,
  ) as string[];
  ensureSpace(ctx, lines.length * 4.5 + 2);
  ctx.doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  ctx.doc.setFontSize(opts?.size ?? 9.5);
  setText(ctx.doc, COLORS.ink);
  for (const line of lines) {
    ctx.doc.text(line, PAGE.contentLeft, ctx.y);
    ctx.y += 4.5;
  }
  ctx.y += 2;
}

/** Línea de viñetas para las conclusiones. */
export function drawBullets(ctx: DocContext, items: string[]): void {
  if (items.length === 0) return;
  const { doc } = ctx;
  for (const it of items) {
    const lines = doc.splitTextToSize(it, PAGE.contentWidth - 6) as string[];
    ensureSpace(ctx, lines.length * 4.5 + 1);
    setFill(doc, COLORS.accent);
    doc.circle(PAGE.contentLeft + 1.5, ctx.y - 1.5, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(doc, COLORS.ink);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], PAGE.contentLeft + 5, ctx.y);
      ctx.y += 4.5;
    }
  }
  ctx.y += 2;
}

/** Tabla profesional con headers oscuros y zebra row. */
export function drawTable(
  ctx: DocContext,
  head: string[],
  body: (string | number)[][],
  opts?: {
    columnStyles?: Record<number, { halign?: "left" | "right" | "center"; cellWidth?: number | "auto" }>;
  },
): void {
  if (body.length === 0) return;
  ensureSpace(ctx, 30);
  autoTable(ctx.doc, {
    startY: ctx.y,
    head: [head],
    body: body as RowInput[],
    margin: { left: PAGE.contentLeft, right: PAGE.marginX },
    tableWidth: PAGE.contentWidth,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      textColor: COLORS.ink,
      lineColor: COLORS.hairline,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.accent,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "left",
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: COLORS.zebra },
    columnStyles: opts?.columnStyles,
    didDrawPage: () => {
      // Cuando la tabla salta de página, re-renderizamos el letterhead.
      const currentPage = ctx.doc.getCurrentPageInfo().pageNumber;
      if (currentPage > 1) {
        // letterhead simple para páginas continuación
        drawLetterhead(ctx);
      }
    },
  });
  // jspdf-autotable expone lastAutoTable en el doc.
  const lastY = (ctx.doc as unknown as { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY;
  ctx.y = (lastY ?? ctx.y) + 5;
}

/* -------------------------------------------------------------------------- */
/* Gráficos vectoriales                                                       */
/* -------------------------------------------------------------------------- */

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const m = value / base;
  let rounded: number;
  if (m <= 1) rounded = 1;
  else if (m <= 2) rounded = 2;
  else if (m <= 2.5) rounded = 2.5;
  else if (m <= 5) rounded = 5;
  else rounded = 10;
  return rounded * base;
}

function formatAxisCurrency(value: number, currency: string): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1000)}k`;
  }
  return formatCurrency(value, currency);
}

export type BarPoint = { label: string; value: number; color?: [number, number, number] };

/**
 * Barras verticales: usa todo el ancho de contenido. Apto para "ventas por mes"
 * con 12 puntos. Incluye eje Y con grilla horizontal cada 4 ticks.
 */
export function drawVerticalBars(
  ctx: DocContext,
  data: BarPoint[],
  opts?: { height?: number; currency?: string; secondary?: number[]; secondaryColor?: [number, number, number]; secondaryLabel?: string; primaryLabel?: string },
): void {
  if (data.length === 0) return;
  const height = opts?.height ?? 60;
  ensureSpace(ctx, height + 8);
  const { doc } = ctx;
  const x0 = PAGE.contentLeft + 16;
  const y0 = ctx.y + height;
  const w = PAGE.contentWidth - 18;
  const h = height - 10;

  const allValues = [...data.map((d) => d.value), ...(opts?.secondary ?? [])];
  const max = niceMax(Math.max(1, ...allValues));
  const ticks = 4;
  const tickStep = max / ticks;

  // grilla horizontal + labels eje Y
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, COLORS.mute);
  for (let i = 0; i <= ticks; i++) {
    const y = y0 - (i / ticks) * h;
    doc.line(x0, y, x0 + w, y);
    const tickVal = tickStep * i;
    doc.text(
      formatAxisCurrency(tickVal, opts?.currency ?? "ARS"),
      x0 - 2,
      y + 1,
      { align: "right" },
    );
  }

  const hasSecondary = (opts?.secondary?.length ?? 0) > 0;
  const groupCount = data.length;
  const groupW = w / groupCount;
  const barW = hasSecondary ? groupW * 0.32 : groupW * 0.6;
  const padW = (groupW - (hasSecondary ? barW * 2 + 1 : barW)) / 2;

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    const value = Math.max(0, p.value);
    const barH = (value / max) * h;
    const baseX = x0 + i * groupW + padW;
    setFill(doc, p.color ?? COLORS.accent);
    doc.rect(baseX, y0 - barH, barW, barH, "F");

    if (hasSecondary && opts?.secondary && opts.secondary[i] != null) {
      const sv = Math.max(0, opts.secondary[i]);
      const sH = (sv / max) * h;
      const sx = baseX + barW + 1;
      setFill(doc, opts.secondaryColor ?? COLORS.blue);
      doc.rect(sx, y0 - sH, barW, sH, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, COLORS.mute);
    doc.text(p.label, baseX + (hasSecondary ? barW : barW / 2), y0 + 4, {
      align: "center",
    });
  }

  // Eje X
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.3);
  doc.line(x0, y0, x0 + w, y0);

  // Leyenda
  if (hasSecondary) {
    const lx = x0;
    const ly = ctx.y - 2;
    setFill(doc, COLORS.accent);
    doc.rect(lx, ly - 2, 2.5, 2.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, COLORS.ink);
    doc.text(opts?.primaryLabel ?? "Actual", lx + 3.5, ly);
    setFill(doc, opts?.secondaryColor ?? COLORS.blue);
    doc.rect(lx + 30, ly - 2, 2.5, 2.5, "F");
    doc.text(opts?.secondaryLabel ?? "Comparado", lx + 33.5, ly);
  }

  ctx.y += height + 4;
}

/** Barras horizontales (rankings). */
export function drawHorizontalBars(
  ctx: DocContext,
  data: BarPoint[],
  opts?: { rowHeight?: number; currency?: string },
): void {
  if (data.length === 0) return;
  const rowH = opts?.rowHeight ?? 6.5;
  const totalH = data.length * (rowH + 1.5) + 2;
  ensureSpace(ctx, totalH + 4);
  const { doc } = ctx;
  const labelW = 50;
  const x0 = PAGE.contentLeft + labelW;
  const w = PAGE.contentWidth - labelW - 22;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    const y = ctx.y + i * (rowH + 1.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    setText(doc, COLORS.ink);
    const lbl = doc.splitTextToSize(p.label, labelW - 2)[0] as string;
    doc.text(lbl, PAGE.contentLeft, y + rowH * 0.7);

    // pista
    setFill(doc, COLORS.zebra);
    doc.rect(x0, y, w, rowH, "F");

    // barra
    const barW = Math.max(0.4, (Math.max(0, p.value) / max) * w);
    setFill(doc, p.color ?? COLORS.accent);
    doc.rect(x0, y, barW, rowH, "F");

    // valor
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, COLORS.ink);
    doc.text(
      formatCurrency(p.value, opts?.currency ?? "ARS"),
      x0 + w + 2,
      y + rowH * 0.7,
    );
  }
  ctx.y += totalH + 4;
}

export type LinePoint = { label: string; value: number };

/**
 * Línea acumulada / evolución. Simple, sin múltiples series (con secondary se
 * dibuja una segunda línea con `secondaryColor`).
 */
export function drawLineChart(
  ctx: DocContext,
  data: LinePoint[],
  opts?: {
    height?: number;
    currency?: string;
    secondary?: LinePoint[];
    secondaryColor?: [number, number, number];
    primaryLabel?: string;
    secondaryLabel?: string;
  },
): void {
  if (data.length === 0) return;
  const height = opts?.height ?? 60;
  ensureSpace(ctx, height + 12);
  const { doc } = ctx;
  const x0 = PAGE.contentLeft + 16;
  const y0 = ctx.y + height;
  const w = PAGE.contentWidth - 18;
  const h = height - 10;

  const allValues = [
    ...data.map((d) => d.value),
    ...(opts?.secondary?.map((d) => d.value) ?? []),
  ];
  const max = niceMax(Math.max(1, ...allValues));
  const ticks = 4;
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, COLORS.mute);
  for (let i = 0; i <= ticks; i++) {
    const y = y0 - (i / ticks) * h;
    doc.line(x0, y, x0 + w, y);
    doc.text(
      formatAxisCurrency((max / ticks) * i, opts?.currency ?? "ARS"),
      x0 - 2,
      y + 1,
      { align: "right" },
    );
  }

  const slotW = w / Math.max(1, data.length - 1);

  function drawSerie(
    points: LinePoint[],
    color: [number, number, number],
    showDots: boolean,
  ) {
    setDraw(doc, color);
    doc.setLineWidth(0.8);
    let prevX: number | null = null;
    let prevY: number | null = null;
    for (let i = 0; i < points.length; i++) {
      const value = Math.max(0, points[i].value);
      const x = x0 + i * slotW;
      const y = y0 - (value / max) * h;
      if (prevX !== null && prevY !== null) {
        doc.line(prevX, prevY, x, y);
      }
      prevX = x;
      prevY = y;
    }
    if (showDots) {
      setFill(doc, color);
      for (let i = 0; i < points.length; i++) {
        const value = Math.max(0, points[i].value);
        const x = x0 + i * slotW;
        const y = y0 - (value / max) * h;
        doc.circle(x, y, 0.9, "F");
      }
    }
  }

  drawSerie(data, COLORS.accent, true);
  if (opts?.secondary && opts.secondary.length === data.length) {
    drawSerie(opts.secondary, opts.secondaryColor ?? COLORS.blue, false);
  }

  // X labels
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, COLORS.mute);
  for (let i = 0; i < data.length; i++) {
    const x = x0 + i * slotW;
    doc.text(data[i].label, x, y0 + 4, { align: "center" });
  }

  // Eje X
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.3);
  doc.line(x0, y0, x0 + w, y0);

  // Leyenda
  if (opts?.secondary && opts.secondary.length === data.length) {
    const lx = x0;
    const ly = ctx.y - 2;
    setFill(doc, COLORS.accent);
    doc.rect(lx, ly - 2, 2.5, 2.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, COLORS.ink);
    doc.text(opts.primaryLabel ?? "Actual", lx + 3.5, ly);
    setFill(doc, opts.secondaryColor ?? COLORS.blue);
    doc.rect(lx + 30, ly - 2, 2.5, 2.5, "F");
    doc.text(opts.secondaryLabel ?? "Comparado", lx + 33.5, ly);
  }

  ctx.y += height + 4;
}

export type DonutSlice = { label: string; value: number; color: [number, number, number] };

/** Donut con leyenda lateral. Ideal para gastos por categoría o ventas por método de pago. */
export function drawDonut(
  ctx: DocContext,
  slices: DonutSlice[],
  opts?: { radius?: number; centerLabel?: string; centerValue?: string },
): void {
  if (slices.length === 0) return;
  const radius = opts?.radius ?? 22;
  const inner = radius * 0.6;
  const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0);
  if (total <= 0) return;

  const blockH = Math.max(radius * 2 + 6, slices.length * 5 + 4);
  ensureSpace(ctx, blockH + 4);
  const { doc } = ctx;
  const cx = PAGE.contentLeft + radius + 2;
  const cy = ctx.y + radius;

  // dibujamos como sectores poligonales (jspdf no tiene arc nativo robusto)
  let cursor = -Math.PI / 2;
  for (const s of slices) {
    const v = Math.max(0, s.value);
    const sweep = (v / total) * Math.PI * 2;
    const steps = Math.max(6, Math.ceil((sweep / (Math.PI * 2)) * 60));
    setFill(doc, s.color);
    // construye polígono outer-inner como triangle fan; aproximamos cada step con dos triangulos.
    for (let i = 0; i < steps; i++) {
      const a1 = cursor + (sweep * i) / steps;
      const a2 = cursor + (sweep * (i + 1)) / steps;
      const xO1 = cx + Math.cos(a1) * radius;
      const yO1 = cy + Math.sin(a1) * radius;
      const xO2 = cx + Math.cos(a2) * radius;
      const yO2 = cy + Math.sin(a2) * radius;
      const xI1 = cx + Math.cos(a1) * inner;
      const yI1 = cy + Math.sin(a1) * inner;
      const xI2 = cx + Math.cos(a2) * inner;
      const yI2 = cy + Math.sin(a2) * inner;
      doc.triangle(xO1, yO1, xO2, yO2, xI1, yI1, "F");
      doc.triangle(xO2, yO2, xI2, yI2, xI1, yI1, "F");
    }
    cursor += sweep;
  }

  // Centro
  if (opts?.centerValue) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(doc, COLORS.ink);
    doc.text(opts.centerValue, cx, cy + 1, { align: "center" });
  }
  if (opts?.centerLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, COLORS.mute);
    doc.text(opts.centerLabel, cx, cy - 5, { align: "center" });
  }

  // Leyenda
  const lx = cx + radius + 10;
  let ly = ctx.y + 2;
  for (const s of slices) {
    setFill(doc, s.color);
    doc.rect(lx, ly - 2.6, 3, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, COLORS.ink);
    const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0";
    const labelText = doc.splitTextToSize(
      `${s.label} — ${pct}%`,
      PAGE.contentRight - lx - 5,
    )[0] as string;
    doc.text(labelText, lx + 5, ly);
    ly += 5;
  }

  ctx.y += blockH + 4;
}

/**
 * Hero KPI ancho completo: ideal para "Ingresos" o "Ganancia neta" en portada.
 * Más grande y vistoso que un KPI estándar, soporta delta y comparativo.
 */
export function drawHeroKpi(
  ctx: DocContext,
  card: {
    label: string;
    value: string;
    deltaLabel?: string;
    deltaTone?: "positive" | "negative" | "neutral";
    description?: string;
  },
): void {
  ensureSpace(ctx, 36);
  const { doc } = ctx;
  const w = PAGE.contentWidth;
  const h = 30;

  setFill(doc, COLORS.zebra);
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE.contentLeft, ctx.y, w, h, 2.5, 2.5, "FD");

  // Banda vertical acentuada
  setFill(doc, COLORS.accent);
  doc.rect(PAGE.contentLeft, ctx.y, 3, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, COLORS.mute);
  doc.text(
    card.label.toUpperCase(),
    PAGE.contentLeft + 7,
    ctx.y + 6,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  setText(doc, COLORS.ink);
  doc.text(card.value, PAGE.contentLeft + 7, ctx.y + 18);

  if (card.deltaLabel) {
    const tone =
      card.deltaTone === "positive"
        ? COLORS.positive
        : card.deltaTone === "negative"
          ? COLORS.negative
          : COLORS.mute;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, tone);
    doc.text(card.deltaLabel, PAGE.contentLeft + 7, ctx.y + 25);
  }

  if (card.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, COLORS.mute);
    const lines = doc.splitTextToSize(
      card.description,
      Math.min(80, w / 2),
    ) as string[];
    for (let i = 0; i < Math.min(2, lines.length); i++) {
      doc.text(lines[i], PAGE.contentRight - 4, ctx.y + 10 + i * 4.5, {
        align: "right",
      });
    }
  }

  ctx.y += h + 4;
}

/**
 * Barras verticales apiladas (hasta 3 series). Útil para "Estructura de costos
 * mensual: COGS / Gastos / Defectuosos" o equivalentes.
 */
export type StackPoint = {
  label: string;
  segments: { value: number; color: [number, number, number] }[];
};

export function drawStackedBars(
  ctx: DocContext,
  data: StackPoint[],
  opts?: {
    height?: number;
    currency?: string;
    legend?: { label: string; color: [number, number, number] }[];
  },
): void {
  if (data.length === 0) return;
  const height = opts?.height ?? 60;
  ensureSpace(ctx, height + 14);
  const { doc } = ctx;
  const x0 = PAGE.contentLeft + 16;
  const y0 = ctx.y + height;
  const w = PAGE.contentWidth - 18;
  const h = height - 10;

  const max = niceMax(
    Math.max(
      1,
      ...data.map((p) =>
        p.segments.reduce((a, s) => a + Math.max(0, s.value), 0),
      ),
    ),
  );
  const ticks = 4;
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, COLORS.mute);
  for (let i = 0; i <= ticks; i++) {
    const y = y0 - (i / ticks) * h;
    doc.line(x0, y, x0 + w, y);
    doc.text(
      formatAxisCurrency((max / ticks) * i, opts?.currency ?? "ARS"),
      x0 - 2,
      y + 1,
      { align: "right" },
    );
  }

  const groupW = w / data.length;
  const barW = groupW * 0.6;
  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    const x = x0 + i * groupW + (groupW - barW) / 2;
    let cursorY = y0;
    for (const seg of p.segments) {
      const value = Math.max(0, seg.value);
      const segH = (value / max) * h;
      setFill(doc, seg.color);
      doc.rect(x, cursorY - segH, barW, segH, "F");
      cursorY -= segH;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, COLORS.mute);
    doc.text(p.label, x + barW / 2, y0 + 4, { align: "center" });
  }
  setDraw(doc, COLORS.hairline);
  doc.setLineWidth(0.3);
  doc.line(x0, y0, x0 + w, y0);

  // Leyenda
  if (opts?.legend && opts.legend.length > 0) {
    let lx = x0;
    const ly = ctx.y - 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    for (const it of opts.legend) {
      setFill(doc, it.color);
      doc.rect(lx, ly - 2.5, 2.5, 2.5, "F");
      setText(doc, COLORS.ink);
      doc.text(it.label, lx + 3.5, ly);
      lx += doc.getTextWidth(it.label) + 8;
    }
  }

  ctx.y += height + 4;
}

/* -------------------------------------------------------------------------- */
/* Función para forzar nueva página manualmente (cover sections, etc.)        */
/* -------------------------------------------------------------------------- */

export function forcePageBreak(ctx: DocContext): void {
  ctx.doc.addPage();
  ctx.y = 0;
  drawLetterhead(ctx);
}

/* -------------------------------------------------------------------------- */
/* Helpers de inicialización y guardado                                       */
/* -------------------------------------------------------------------------- */

export function createReport(
  settings: AppSettings,
  title: string,
  periodLabel: string,
  subtitle?: string,
): DocContext {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setProperties({
    title,
    subject: title,
    author: settings.shopName?.trim() || "Mi negocio",
    creator: "Gestión interna",
  });
  const ctx: DocContext = {
    doc,
    settings,
    title,
    subtitle,
    periodLabel,
    y: 0,
  };
  drawLetterhead(ctx);
  return ctx;
}

export function finishAndSave(ctx: DocContext, filename: string): void {
  drawFooters(ctx);
  ctx.doc.save(filename);
}

/* -------------------------------------------------------------------------- */
/* Utilidades de etiquetado de período                                        */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1] ?? "—"} ${year}`;
}

export function rangeLabel(start: Date, end: Date): string {
  const s = `${start.getDate().toString().padStart(2, "0")}/${(start.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${start.getFullYear()}`;
  const e = `${end.getDate().toString().padStart(2, "0")}/${(end.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${end.getFullYear()}`;
  return `${s} — ${e}`;
}
