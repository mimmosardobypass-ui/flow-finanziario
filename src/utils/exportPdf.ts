import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { TransactionWithCategory } from "@/hooks/useTransactions";

export function exportToPdf(
  transactions: TransactionWithCategory[],
  dateFrom?: string,
  dateTo?: string
) {
  const doc = new jsPDF();

  // Intestazione
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129); // Colore primary (emerald)
  doc.text("FLOW FINANZIARIO", 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("Report Transazioni", 105, 28, { align: "center" });

  // Periodo
  const periodoText = dateFrom || dateTo
    ? `Periodo: ${dateFrom ? format(new Date(dateFrom), "dd/MM/yyyy", { locale: it }) : "..."} - ${dateTo ? format(new Date(dateTo), "dd/MM/yyyy", { locale: it }) : "..."}`
    : `Generato il: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })}`;
  
  doc.setFontSize(10);
  doc.text(periodoText, 105, 36, { align: "center" });

  // Prepara dati tabella
  const tableData = transactions.map((t) => [
    format(new Date(t.date), "dd/MM/yyyy", { locale: it }),
    t.type === "income" ? "Entrata" : "Uscita",
    t.categories?.name || "-",
    t.description || "-",
    `${t.type === "income" ? "+" : "-"}€${t.amount.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
    })}`,
  ]);

  // Tabella transazioni
  autoTable(doc, {
    head: [["Data", "Tipo", "Categoria", "Descrizione", "Importo"]],
    body: tableData,
    startY: 45,
    theme: "striped",
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 20 },
      2: { cellWidth: 35 },
      3: { cellWidth: 60 },
      4: { cellWidth: 30, halign: "right" },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
  });

  // Calcola totali
  const totaleEntrate = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totaleUscite = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const saldo = totaleEntrate - totaleUscite;

  // Riepilogo
  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFillColor(240, 240, 240);
  doc.rect(14, finalY - 5, 182, 45, "F");

  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.text("RIEPILOGO", 20, finalY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  doc.setTextColor(16, 185, 129);
  doc.text(
    `Totale Entrate: +€${totaleEntrate.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
    })}`,
    20,
    finalY + 17
  );

  doc.setTextColor(239, 68, 68);
  doc.text(
    `Totale Uscite: -€${totaleUscite.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
    })}`,
    20,
    finalY + 27
  );

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Saldo: ${saldo >= 0 ? "+" : ""}€${saldo.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
    })}`,
    20,
    finalY + 37
  );

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
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  // Genera nome file
  const periodo = dateFrom || dateTo
    ? `_${dateFrom || "inizio"}_${dateTo || "fine"}`
    : `_${format(new Date(), "yyyy-MM-dd")}`;
  
  const filename = `flow_finanziario${periodo}.pdf`;

  // Scarica file
  doc.save(filename);
}
