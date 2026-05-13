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
  rangeFromPreset,
  type DateRange,
  type PeriodPreset,
} from "@/lib/data/finance-calcs";
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
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
  hoy: "Hoy",
  esta_semana: "Esta semana",
  este_mes: "Este mes",
  "este_año": "Este año",
  "año_anterior": "Año anterior",
  personalizado: "Personalizado",
};

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

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("este_mes");
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
    return rangeFromPreset(periodPreset);
  }, [periodPreset, customStart, customEnd]);

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
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Para que los reportes se vean profesionales, agregá el{" "}
          <strong>nombre comercial</strong> y un{" "}
          <strong>logo</strong> en{" "}
          <a className="underline" href="/configuracion">
            Configuración
          </a>
          .
        </div>
      ) : !hasLogo ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
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
            {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodPreset(p)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodPreset === p
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          {periodPreset === "personalizado" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Desde
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Hasta
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>
          ) : null}
          <p className="text-xs text-zinc-500">
            Período actual:{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">
              {periodLabelText}
            </strong>
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
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
                <span className="inline-flex items-center justify-center rounded-lg bg-amber-100 p-1.5 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  <FileBarChart className="h-4 w-4" aria-hidden />
                </span>
              }
            />
            <CardContent className="flex flex-1 flex-col justify-between gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Año
                  <input
                    type="number"
                    value={monthlyYear}
                    onChange={(e) => setMonthlyYear(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Mes
                  <select
                    value={monthlyMonth}
                    onChange={(e) => setMonthlyMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Año del ejercicio
                <input
                  type="number"
                  value={annualYear}
                  onChange={(e) => setAnnualYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <button
                type="button"
                onClick={downloadAnnual}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-500" aria-hidden />
                <p className="font-medium">Letterhead</p>
              </div>
              <p className="text-xs text-zinc-500">
                Logo + nombre del negocio + período + fecha de emisión.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zinc-500" aria-hidden />
                <p className="font-medium">KPIs + gráficos</p>
              </div>
              <p className="text-xs text-zinc-500">
                Tarjetas de métricas, barras, líneas y donut vectoriales.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-2 flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-zinc-500" aria-hidden />
                <p className="font-medium">Conclusiones</p>
              </div>
              <p className="text-xs text-zinc-500">
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
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    zinc: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
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
          <p className="text-xs text-zinc-500">{note}</p>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <Download className="h-4 w-4" aria-hidden />
          Descargar PDF
        </button>
      </CardContent>
    </Card>
  );
}
