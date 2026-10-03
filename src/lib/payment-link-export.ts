// Browser-only export helpers (Excel + PDF). Import dynamically from components.
export type Col = { key: string; label: string };

export async function downloadXlsx(filename: string, sheets: { name: string; cols: Col[]; rows: Record<string, any>[] }[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const aoa = [s.cols.map((c) => c.label), ...s.rows.map((r) => s.cols.map((c) => r[c.key] ?? ""))];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export async function downloadPdf(filename: string, title: string, subtitle: string, sections: { heading: string; cols: Col[]; rows: Record<string, any>[] }[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 48;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(title, 40, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100); doc.text(subtitle, 40, y); doc.setTextColor(0); y += 24;
  for (const s of sections) {
    if (y > H - 80) { doc.addPage(); y = 48; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(s.heading, 40, y); y += 16;
    const colW = (W - 80) / s.cols.length;
    const header = () => {
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      s.cols.forEach((c, i) => doc.text(c.label, 40 + i * colW, y)); y += 6;
      doc.line(40, y, W - 40, y); y += 12; doc.setFont("helvetica", "normal");
    };
    header();
    if (s.rows.length === 0) { doc.text("None", 40, y); y += 14; }
    for (const r of s.rows) {
      if (y > H - 40) { doc.addPage(); y = 48; header(); }
      s.cols.forEach((c, i) => doc.text(String(r[c.key] ?? "").slice(0, Math.floor(colW / 5)), 40 + i * colW, y));
      y += 14;
    }
    y += 16;
  }
  doc.save(filename);
}
