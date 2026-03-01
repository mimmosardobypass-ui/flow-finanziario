import * as XLSX from "xlsx";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { TransactionWithCategory } from "@/hooks/useTransactions";
import { isInternalTransfer } from "@/hooks/useDashboardStats";

export function exportToExcel(
  transactions: TransactionWithCategory[],
  dateFrom?: string,
  dateTo?: string
) {
  // Prepara i dati per il foglio transazioni
  const transactionData = transactions.map((t) => ({
    Data: format(new Date(t.date), "dd/MM/yyyy", { locale: it }),
    Tipo: t.type === "income" ? "Entrata" : "Uscita",
    Categoria: t.categories?.name || "-",
    Descrizione: t.description || "-",
    Importo: t.type === "income" ? t.amount : -t.amount,
    Giroconto: isInternalTransfer(t) ? "Sì" : "No",
  }));

  // Filtra i giroconti per i totali statistici
  const realTransactions = transactions.filter((t) => !isInternalTransfer(t));
  const transferTransactions = transactions.filter((t) => isInternalTransfer(t));

  // Calcola i totali (solo operazioni reali)
  const totaleEntrate = realTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totaleUscite = realTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const saldo = totaleEntrate - totaleUscite;

  const totaleGiroconti = transferTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Prepara riepilogo per categoria
  const categorySummary: Record<string, { tipo: string; totale: number }> = {};
  
  // Build category summary from real transactions only
  realTransactions.forEach((t) => {
    const catName = t.categories?.name || "Senza categoria";
    if (!categorySummary[catName]) {
      categorySummary[catName] = {
        tipo: t.type === "income" ? "Entrata" : "Uscita",
        totale: 0,
      };
    }
    categorySummary[catName].totale += t.amount;
  });

  // Dati foglio riepilogo
  const summaryData = [
    { Voce: "Totale Entrate (esclusi giroconti)", Importo: totaleEntrate },
    { Voce: "Totale Uscite (esclusi giroconti)", Importo: totaleUscite },
    { Voce: "Saldo", Importo: saldo },
    { Voce: "", Importo: "" },
    { Voce: "Totale Giroconti (esclusi dalle statistiche)", Importo: totaleGiroconti },
    { Voce: "", Importo: "" },
    { Voce: "RIEPILOGO PER CATEGORIA", Importo: "" },
  ];

  Object.entries(categorySummary).forEach(([categoria, data]) => {
    summaryData.push({
      Voce: `${categoria} (${data.tipo})`,
      Importo: data.totale,
    });
  });

  // Crea workbook
  const wb = XLSX.utils.book_new();

  // Foglio 1: Transazioni
  const ws1 = XLSX.utils.json_to_sheet(transactionData);
  
  // Imposta larghezza colonne
  ws1["!cols"] = [
    { wch: 12 }, // Data
    { wch: 10 }, // Tipo
    { wch: 20 }, // Categoria
    { wch: 30 }, // Descrizione
    { wch: 15 }, // Importo
    { wch: 12 }, // Giroconto
  ];
  
  XLSX.utils.book_append_sheet(wb, ws1, "Transazioni");

  // Foglio 2: Riepilogo
  const ws2 = XLSX.utils.json_to_sheet(summaryData);
  ws2["!cols"] = [
    { wch: 45 }, // Voce
    { wch: 15 }, // Importo
  ];
  
  XLSX.utils.book_append_sheet(wb, ws2, "Riepilogo");

  // Genera nome file
  const periodo = dateFrom || dateTo
    ? `_${dateFrom || "inizio"}_${dateTo || "fine"}`
    : `_${format(new Date(), "yyyy-MM-dd")}`;
  
  const filename = `flow_finanziario${periodo}.xlsx`;

  // Scarica file
  XLSX.writeFile(wb, filename);
}
