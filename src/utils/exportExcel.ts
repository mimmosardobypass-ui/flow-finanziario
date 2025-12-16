import * as XLSX from "xlsx";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { TransactionWithCategory } from "@/hooks/useTransactions";

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
  }));

  // Calcola i totali
  const totaleEntrate = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totaleUscite = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const saldo = totaleEntrate - totaleUscite;

  // Prepara riepilogo per categoria
  const categorySummary: Record<string, { tipo: string; totale: number }> = {};
  
  transactions.forEach((t) => {
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
    { Voce: "Totale Entrate", Importo: totaleEntrate },
    { Voce: "Totale Uscite", Importo: totaleUscite },
    { Voce: "Saldo", Importo: saldo },
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
  ];
  
  XLSX.utils.book_append_sheet(wb, ws1, "Transazioni");

  // Foglio 2: Riepilogo
  const ws2 = XLSX.utils.json_to_sheet(summaryData);
  ws2["!cols"] = [
    { wch: 30 }, // Voce
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
