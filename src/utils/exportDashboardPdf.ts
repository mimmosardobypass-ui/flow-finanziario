import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
}

interface DashboardExportData {
  periodLabel: string;
  totalBalance: number;
  periodIncome: number;
  periodExpenses: number;
  netSavings: number;
  spendingByCategory: CategoryData[];
  incomeByCategory: CategoryData[];
  dateFrom?: Date;
  dateTo?: Date;
}

export function exportDashboardToPdf(data: DashboardExportData) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129);
  doc.text("FLOW FINANZIARIO", 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("Report Dashboard", 105, 28, { align: "center" });

  // Period
  doc.setFontSize(10);
  doc.text(`Periodo: ${data.periodLabel}`, 105, 36, { align: "center" });

  // Summary Box
  doc.setFillColor(240, 240, 240);
  doc.rect(14, 45, 182, 50, "F");

  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.text("RIEPILOGO FINANZIARIO", 20, 55);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  // Total Balance
  doc.setTextColor(50, 50, 50);
  doc.text("Saldo Totale:", 20, 67);
  doc.setFont("helvetica", "bold");
  doc.text(
    `€${data.totalBalance.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
    80,
    67
  );

  // Period Income
  doc.setFont("helvetica", "normal");
  doc.text("Entrate del periodo:", 20, 77);
  doc.setTextColor(16, 185, 129);
  doc.setFont("helvetica", "bold");
  doc.text(
    `+€${data.periodIncome.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
    80,
    77
  );

  // Period Expenses
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text("Uscite del periodo:", 110, 67);
  doc.setTextColor(239, 68, 68);
  doc.setFont("helvetica", "bold");
  doc.text(
    `-€${data.periodExpenses.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
    160,
    67
  );

  // Net
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text("Netto del periodo:", 110, 77);
  doc.setTextColor(data.netSavings >= 0 ? 16 : 239, data.netSavings >= 0 ? 185 : 68, data.netSavings >= 0 ? 129 : 68);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${data.netSavings >= 0 ? "+" : ""}€${data.netSavings.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
    160,
    77
  );

  let currentY = 105;

  // Expenses by Category Table
  if (data.spendingByCategory.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.text("SPESE PER CATEGORIA", 14, currentY);

    const expenseTableData = data.spendingByCategory.map((cat) => [
      cat.name,
      `€${cat.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
      `${cat.percentage}%`,
    ]);

    autoTable(doc, {
      head: [["Categoria", "Importo", "%"]],
      body: expenseTableData,
      startY: currentY + 5,
      theme: "striped",
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [255, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 45, halign: "right" },
        2: { cellWidth: 25, halign: "right" },
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Income by Category Table
  if (data.incomeByCategory.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.text("ENTRATE PER CATEGORIA", 14, currentY);

    const incomeTableData = data.incomeByCategory.map((cat) => [
      cat.name,
      `€${cat.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
      `${cat.percentage}%`,
    ]);

    autoTable(doc, {
      head: [["Categoria", "Importo", "%"]],
      body: incomeTableData,
      startY: currentY + 5,
      theme: "striped",
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244],
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 45, halign: "right" },
        2: { cellWidth: 25, halign: "right" },
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Pagina ${i} di ${pageCount} - Flow Finanziario`,
      105,
      doc.internal.pageSize.height - 15,
      { align: "center" }
    );
    doc.text(
      `Generato il: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })}`,
      105,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  // Generate filename
  const filename = `flow_finanziario_dashboard_${format(new Date(), "yyyy-MM-dd")}.pdf`;

  // Download file
  doc.save(filename);
}
