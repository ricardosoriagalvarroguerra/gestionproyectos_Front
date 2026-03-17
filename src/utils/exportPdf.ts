import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Product, Task, DashboardResponse, TimelineItem } from "../api/client";
import { personLabel, formatDateLabel } from "./display";

interface ExportPdfParams {
  projectName: string;
  periodLabel: string;
  dashboard: DashboardResponse | undefined;
  products: Product[];
  tasks: Task[];
  timelineItems: TimelineItem[];
}

function fmtDate(value: string | null | undefined): string {
  return formatDateLabel(value, "—");
}

function personText(value: unknown): string {
  return personLabel(value as any) || "—";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Colors
const ACCENT = [35, 131, 226] as const;
const HEADER_BG = [30, 30, 30] as const;
const HEADER_TEXT = [255, 255, 255] as const;
const ROW_ALT = [245, 247, 250] as const;
const TEXT_DARK = [40, 40, 40] as const;
const TEXT_SECONDARY = [120, 120, 120] as const;
const OVERDUE_BG = [255, 235, 235] as const;
const DONE_BG = [230, 255, 240] as const;

export function exportProjectPdf({
  projectName,
  periodLabel,
  dashboard,
  products,
  tasks,
  timelineItems,
}: ExportPdfParams) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = margin;

  // ── Header band ──
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(projectName || "Proyecto", margin, 38);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(periodLabel, margin, 54);
  doc.text(`Exportado ${new Date().toLocaleDateString("es-BO")}`, pageW - margin, 54, { align: "right" });
  y = 80;

  // ── KPI row ──
  if (dashboard?.kpis) {
    const kpis = dashboard.kpis;
    const items = [
      { label: "Progreso", value: `${kpis.progress_pct}%` },
      { label: "Tareas", value: `${kpis.tasks_done}/${kpis.tasks_total}` },
      { label: "Vencidas", value: `${kpis.tasks_overdue}` },
      { label: "Productos", value: `${kpis.products_total}` },
      { label: "Listos", value: `${kpis.products_done}` },
    ];
    const boxW = (pageW - margin * 2) / items.length;
    doc.setFillColor(240, 242, 245);
    doc.roundedRect(margin, y, pageW - margin * 2, 44, 4, 4, "F");

    items.forEach((item, i) => {
      const cx = margin + boxW * i + boxW / 2;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text(item.value, cx, y + 20, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text(item.label.toUpperCase(), cx, y + 34, { align: "center" });
    });
    y += 56;
  }

  // ── Section: Cronograma (timeline table) ──
  if (timelineItems.length > 0) {
    y = drawSectionTitle(doc, "Cronograma", y, margin);

    const timelineRows = timelineItems.map((item) => [
      item.label || "—",
      item.status || "—",
      fmtDate(item.start),
      fmtDate(item.end),
      item.is_overdue ? "Sí" : "No",
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Elemento", "Estado", "Inicio", "Fin", "Vencida"]],
      body: timelineRows,
      styles: { fontSize: 8, cellPadding: 5, textColor: TEXT_DARK as any },
      headStyles: {
        fillColor: HEADER_BG as any,
        textColor: HEADER_TEXT as any,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: ROW_ALT as any },
      columnStyles: {
        0: { cellWidth: 220 },
        4: { halign: "center", cellWidth: 50 },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          if (data.cell.raw === "Sí") {
            data.cell.styles.textColor = [200, 50, 50];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ── Section: Productos ──
  if (products.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = margin;
    }
    y = drawSectionTitle(doc, "Productos", y, margin);

    const productRows = products.map((p) => [
      p.nombre || "—",
      p.estado || "—",
      p.prioridad || "—",
      personText(p.responsable),
      fmtDate(p.fecha_entrega_end || p.fecha_entrega_start),
      `${p.progress_pct}%`,
      `${p.tasks_done}/${p.tasks_total}`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Producto", "Estado", "Prioridad", "Responsable", "Entrega", "Progreso", "Tareas"]],
      body: productRows,
      styles: { fontSize: 8, cellPadding: 5, textColor: TEXT_DARK as any },
      headStyles: {
        fillColor: HEADER_BG as any,
        textColor: HEADER_TEXT as any,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: ROW_ALT as any },
      columnStyles: {
        0: { cellWidth: 180 },
        5: { halign: "center", cellWidth: 50 },
        6: { halign: "center", cellWidth: 50 },
      },
      didParseCell: (data: any) => {
        if (data.section === "body") {
          const progress = products[data.row.index]?.progress_pct ?? 0;
          if (data.column.index === 5) {
            if (progress >= 100) {
              data.cell.styles.fillColor = DONE_BG;
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ── Section: Tareas por producto ──
  if (tasks.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = margin;
    }
    y = drawSectionTitle(doc, "Tareas", y, margin);

    // Group tasks by product
    const productMap = new Map(products.map((p) => [p.product_id, p.nombre || "Sin producto"]));
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = task.product_id || "__none__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }

    for (const [productId, groupTasks] of groups) {
      const productName = productMap.get(productId) || task_product_name(groupTasks) || "Sin producto";

      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = margin;
      }

      // Product subheader
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...ACCENT);
      doc.text(`▸ ${productName}`, margin, y + 10);
      y += 18;

      const taskRows = groupTasks.map((t) => [
        t.tarea || "—",
        t.estado || "—",
        t.importancia || "—",
        personText(t.responsable),
        fmtDate(t.fecha_start),
        fmtDate(t.fecha_end),
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Tarea", "Estado", "Importancia", "Responsable", "Inicio", "Fin"]],
        body: taskRows,
        styles: { fontSize: 7.5, cellPadding: 4, textColor: TEXT_DARK as any },
        headStyles: {
          fillColor: [60, 60, 60] as any,
          textColor: HEADER_TEXT as any,
          fontStyle: "bold",
          fontSize: 7.5,
        },
        alternateRowStyles: { fillColor: ROW_ALT as any },
        columnStyles: {
          0: { cellWidth: 200 },
        },
        didParseCell: (data: any) => {
          if (data.section === "body") {
            const task = groupTasks[data.row.index];
            if (task?.is_overdue) {
              data.cell.styles.fillColor = OVERDUE_BG;
            }
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`${projectName} — Página ${i} de ${totalPages}`, pageW / 2, pageH - 16, { align: "center" });
  }

  const fileName = `${slugify(projectName || "proyecto")}-reporte-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(title, margin, y + 12);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.5);
  doc.line(margin, y + 16, margin + doc.getTextWidth(title), y + 16);
  return y + 26;
}

function task_product_name(tasks: Task[]): string | null {
  return tasks[0]?.product_nombre || null;
}
