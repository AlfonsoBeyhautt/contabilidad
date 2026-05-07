import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadCsv(
  filename: string,
  rows: Record<string, string | number>[],
) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPdfTable(
  filename: string,
  title: string,
  head: string[],
  body: string[][],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [head],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [39, 39, 42] },
    margin: { left: 14, right: 14 },
  });
  doc.save(filename);
}
