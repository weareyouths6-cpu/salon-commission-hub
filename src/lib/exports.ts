import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  triggerDownload(blob, filename + ".csv");
}

export function exportXLSX(filename: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename + ".xlsx");
}

export function exportPDF(filename: string, title: string, rows: Record<string, unknown>[]) {
  const doc = new jsPDF();
  doc.text(title, 14, 15);
  if (rows.length) {
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
      startY: 22,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
  }
  doc.save(filename + ".pdf");
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
