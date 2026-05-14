"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  CalendarRange,
  Download,
  FileBarChart,
  FileLineChart,
  FileText,
  PiggyBank,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import {
  operationalBaselineRange,
  rangeFromPreset,
  type DateRange,
  type PeriodPreset,
} from "@/lib/data/finance-calcs";
import {
  endOfDay,
  startOfDay,
} from "date-fns";
import {
  generateAnnualReport,
  generateCostsReport,
  generateMonthlyReport,
  generateProfitReport,
  generateSalesReport,
  generateStockReport,
} from "@/lib/pdf/business-reports";
import { monthLabel, rangeLabel } from "@/lib/pdf/foundation";

const PRESET_LABELS: Record<PeriodPreset, string> = {
  desde_operacion: "Desde inicio operativo",
  hoy: "Hoy",
  esta_semana: "Esta semana",
  este_mes: "Este mes",
  "este_año": "Este año",
  "año_anterior": "Año anterior",
  personalizado: "Personalizado",
};

const REPORT_PRESET_ORDER: PeriodPreset[] = [
  "desde_operacion",
  "hoy",
  "esta_semana",
  "este_mes",
  "este_año",
  "año_anterior",
  "personalizado",
];

const MONTHS_ES = [
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

export function ReportesView() {
  const { data } = useAppData();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("desde_operacion");
  const [customStart, setCustomStart] = useState<string>(
    () => new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10),
  );
  const [customEnd, setCustomEnd] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );

  const [monthlyYear, setMonthlyYear] = useState(currentYear);
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonth);

  const [annualYear, setAnnualYear] = useState(currentYear);

  const range: DateRange = useMemo(() => {
    if (periodPreset === "personalizado") {
      const start = startOfDay(new Date(`${customStart}T12:00:00`));
      const end = endOfDay(new Date(`${customEnd}T12:00:00`));
      return rangeFromPreset("personalizado", { start, end });
    }
    if (periodPreset === "desde_operacion") {
      return operationalBaselineRange(data);
    }
    return rangeFromPreset(periodPreset);
  }, [periodPreset, customStart, customEnd, data]);

  const periodLabelText = useMemo(() => {
    if (periodPreset === "este_mes") {
      return monthLabel(currentMonth, currentYear);
    }
    if (periodPreset === "este_año") return String(currentYear);
    if (periodPreset === "año_anterior") return String(currentYear - 1);
    return rangeLabel(range.start, range.end);
  }, [periodPreset, range, currentMonth, currentYear]);

  function downloadSales() {
    generateSalesReport(data, range, { periodLabel: periodLabelText });
  }
  function downloadCosts() {
    generateCostsReport(data, range, { periodLabel: periodLabelText });
  }
  function downloadProfit() {
    generateProfitReport(data, range, { periodLabel: periodLabelText });
  }
  function downloadStock() {
    generateStockReport(data);
  }
  function downloadMonthly() {
    generateMonthlyReport(data, monthlyYear, monthlyMonth);
  }
  function downloadAnnual() {
    generateAnnualReport(data, annualYear);
  }

  const hasLogo = Boolean(data.settings.logoDataUrl);
  const hasShopName = Boolean(data.settings.shopName?.trim());

  return (
    <div className="space-y-6">
      {!hasShopName ? (
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">
          Para que los reportes se vean profesionales, agregá el{" "}
          <strong>nombre comercial</strong> y un{" "}
          <strong>logo</strong> en{" "}
          <a className="underline" href="/configuracion">
            Configuración
          </a>
          .
        </div>
      ) : !hasLogo ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--foreground)]">
          Tip: subí un <strong>logo</strong> en{" "}
          <a className="underline" href="/configuracion">
            Configuración
          </a>{" "}
          para que aparezca en el encabezado de cada PDF.
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Período del reporte"
          subtitle="Define el rango temporal para los reportes de ventas, costos y ganancias"
        />
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REPORT_PRESET_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodPreset(p)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodPreset === p
                    ? "border-[var(--surface-inverted)] bg-[var(--surface-inverted)] text-[var(--foreground-on-inverted)]"
                    : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          {periodPreset === "personalizado" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Desde
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Hasta
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
              </label>
            </div>
          ) : null}
          <p className="text-xs text-[var(--foreground-muted)]">
            Período actual:{" "}
            <strong className="text-[var(--foreground)]">
              {periodLabelText}
            </strong>
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Descargas — período seleccionado
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReportCard
            icon={TrendingUp}
            iconTone="emerald"
            title="Reporte de ventas"
            description="Ingresos, ticket promedio, productos más vendidos y métodos de pago."
            onDownload={downloadSales}
          />
          <ReportCard
            icon={Receipt}
            iconTone="zinc"
            title="Reporte de costos"
            description="COGS, compras de mercadería, gastos operativos y pérdidas por defectuosos."
            onDownload={downloadCosts}
          />
          <ReportCard
            icon={PiggyBank}
            iconTone="violet"
            title="Reporte de ganancias"
            description="Margen, ganancia neta y rentabilidad por producto."
            onDownload={downloadProfit}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Descargas independientes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReportCard
            icon={Boxes}
            iconTone="blue"
            title="Reporte de stock"
            description="Foto actual del inventario, alertas de stock bajo y agotados."
            onDownload={downloadStock}
            note="No depende del período (estado en tiempo real)."
          />

          <Card className="flex h-full flex-col">
            <CardHeader
              title="Reporte mensual"
              subtitle="Resumen ejecutivo del mes con comparativo interanual"
              action={
                <span className="inline-flex items-center justify-center rounded-lg bg-[var(--warning-soft)] p-1.5 text-[var(--warning)]">
                  <FileBarChart className="h-4 w-4" aria-hidden />
                </span>
              }
            />
            <CardContent className="flex flex-1 flex-col justify-between gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-[var(--foreground-muted)]">
                  Año
                  <input
                    type="number"
                    value={monthlyYear}
                    onChange={(e) => setMonthlyYear(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--foreground-muted)]">
                  Mes
                  <select
                    value={monthlyMonth}
                    onChange={(e) => setMonthlyMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                  >
                    {MONTHS_ES.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={downloadMonthly}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--surface-inverted)] px-3 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
              >
                <Download className="h-4 w-4" aria-hidden />
                Descargar PDF
              </button>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader
              title="Reporte anual"
              subtitle="Cierre integral del ejercicio con evolución mensual"
              action={
                <span className="inline-flex items-center justify-center rounded-lg bg-rose-100 p-1.5 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                  <FileLineChart className="h-4 w-4" aria-hidden />
                </span>
              }
            />
            <CardContent className="flex flex-1 flex-col justify-between gap-3 text-sm">
              <label className="text-xs font-medium text-[var(--foreground-muted)]">
                Año del ejercicio
                <input
                  type="number"
                  value={annualYear}
                  onChange={(e) => setAnnualYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={downloadAnnual}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--surface-inverted)] px-3 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
              >
                <Download className="h-4 w-4" aria-hidden />
                Descargar PDF
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Vista previa del estilo"
          subtitle="Todos los reportes comparten encabezado, paleta y tipografía"
        />
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
                <p className="font-medium">Letterhead</p>
              </div>
              <p className="text-xs text-[var(--foreground-muted)]">
                Logo + nombre del negocio + período + fecha de emisión.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
                <p className="font-medium">KPIs + gráficos</p>
              </div>
              <p className="text-xs text-[var(--foreground-muted)]">
                Tarjetas de métricas, barras, líneas y donut vectoriales.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
                <p className="font-medium">Conclusiones</p>
              </div>
              <p className="text-xs text-[var(--foreground-muted)]">
                Cada reporte cierra con bullets ejecutivos accionables.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type IconType = typeof TrendingUp;

function ReportCard({
  icon: Icon,
  iconTone,
  title,
  description,
  onDownload,
  note,
}: {
  icon: IconType;
  iconTone: "emerald" | "zinc" | "violet" | "blue";
  title: string;
  description: string;
  onDownload: () => void;
  note?: string;
}) {
  const toneClasses: Record<typeof iconTone, string> = {
    emerald:
      "bg-[var(--success-soft)] text-[var(--success)]",
    zinc: "bg-[var(--surface-muted)] text-[var(--foreground)]",
    violet:
      "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  };
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={title}
        subtitle={description}
        action={
          <span
            className={`inline-flex items-center justify-center rounded-lg p-1.5 ${toneClasses[iconTone]}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        }
      />
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        {note ? (
          <p className="text-xs text-[var(--foreground-muted)]">{note}</p>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--surface-inverted)] px-3 py-2 text-sm font-medium text-[var(--foreground-on-inverted)] hover:opacity-90"
        >
          <Download className="h-4 w-4" aria-hidden />
          Descargar PDF
        </button>
      </CardContent>
    </Card>
  );
}
