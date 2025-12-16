import { FileSpreadsheet, FileText, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionWithCategory } from "@/hooks/useTransactions";
import { exportToExcel } from "@/utils/exportExcel";
import { exportToPdf } from "@/utils/exportPdf";
import { toast } from "@/hooks/use-toast";

interface Props {
  transactions: TransactionWithCategory[];
  dateFrom?: string;
  dateTo?: string;
}

export function ExportDropdown({ transactions, dateFrom, dateTo }: Props) {
  const handleExportExcel = () => {
    try {
      exportToExcel(transactions, dateFrom, dateTo);
      toast({ title: "File Excel generato con successo" });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile generare il file Excel",
        variant: "destructive",
      });
    }
  };

  const handleExportPdf = () => {
    try {
      exportToPdf(transactions, dateFrom, dateTo);
      toast({ title: "File PDF generato con successo" });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile generare il file PDF",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 bg-secondary border-border">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Esporta</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border">
        <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-500" />
          Esporta Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPdf} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-red-500" />
          Esporta PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer">
          <Printer className="h-4 w-4" />
          Stampa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
