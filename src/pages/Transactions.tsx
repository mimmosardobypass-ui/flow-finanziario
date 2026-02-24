import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Receipt, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDialog } from "@/components/TransactionDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { TransactionFilters } from "@/components/TransactionFilters";
import { ExportDropdown } from "@/components/ExportDropdown";
import { ImportTransactionsDialog } from "@/components/ImportTransactionsDialog";
import {
  useFilteredTransactions,
  TransactionFilters as FiltersType,
} from "@/hooks/useFilteredTransactions";
import {
  useDeleteTransaction,
  TransactionWithCategory,
} from "@/hooks/useTransactions";
import { toast } from "@/hooks/use-toast";

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithCategory | null>(null);
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<FiltersType>(() => {
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    
    return {
      type: type === "income" || type === "expense" ? type : "all",
      categoryId: categoryId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      searchText: search || undefined,
    };
  });

  // Debounced URL sync to avoid cursor reset during typing
  const urlSyncTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    clearTimeout(urlSyncTimerRef.current);
    urlSyncTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (filters.type && filters.type !== "all") params.set("type", filters.type);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.searchText) params.set("search", filters.searchText);
      if (filters.amountMin) params.set("amountMin", filters.amountMin.toString());
      if (filters.amountMax) params.set("amountMax", filters.amountMax.toString());
      setSearchParams(params, { replace: true });
    }, 500);

    return () => clearTimeout(urlSyncTimerRef.current);
  }, [filters, setSearchParams]);

  const { data: transactions = [], isLoading, isPlaceholderData } = useFilteredTransactions(filters);
  const deleteMutation = useDeleteTransaction();

  // Calcola totali
  const totals = useMemo(() => {
    const entrate = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const uscite = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      entrate,
      uscite,
      saldo: entrate - uscite,
    };
  }, [transactions]);

  const handleEdit = (transaction: TransactionWithCategory) => {
    setSelectedTransaction(transaction);
    setDialogOpen(true);
  };

  const handleDelete = (transaction: TransactionWithCategory) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTransaction) return;
    try {
      await deleteMutation.mutateAsync(selectedTransaction.id);
      toast({ title: "Transazione eliminata" });
      setDeleteDialogOpen(false);
      setSelectedTransaction(null);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la transazione",
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    setSelectedTransaction(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Transazioni
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci le tue entrate e uscite
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importa</span>
          </Button>
          <ExportDropdown
            transactions={transactions}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />
          <Button className="gap-2" onClick={handleAddNew}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuova Transazione</span>
          </Button>
        </div>
      </div>

      {/* Intestazione stampa */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-center">FLOW FINANZIARIO</h1>
        <p className="text-center text-muted-foreground">Report Transazioni</p>
        {(filters.dateFrom || filters.dateTo) && (
          <p className="text-center text-sm mt-2">
            Periodo: {filters.dateFrom || "..."} - {filters.dateTo || "..."}
          </p>
        )}
      </div>

      {/* Filtri */}
      <TransactionFilters filters={filters} onFiltersChange={setFilters} />

      {/* Conteggio e totali */}
      {transactions.length > 0 && (
        <div className="flex flex-wrap gap-4 items-center text-sm print:hidden">
          <span className="text-muted-foreground">
            {transactions.length} transazion{transactions.length === 1 ? "e" : "i"}
          </span>
          <span className="text-success font-medium">
            Entrate: +€{totals.entrate.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-destructive font-medium">
            Uscite: -€{totals.uscite.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </span>
          <span className={`font-bold ${totals.saldo >= 0 ? "text-success" : "text-destructive"}`}>
            Saldo: {totals.saldo >= 0 ? "+" : ""}€{totals.saldo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Contenuto principale */}
      {transactions.length === 0 ? (
        <Card className="bg-card border-border print:hidden">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nessuna transazione trovata
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              {Object.values(filters).some((v) => v && v !== "all")
                ? "Nessuna transazione corrisponde ai filtri selezionati."
                : "Non hai ancora registrato nessuna transazione."}
            </p>
            {!Object.values(filters).some((v) => v && v !== "all") && (
              <Button className="gap-2" onClick={handleAddNew}>
                <Plus className="h-4 w-4" />
                Aggiungi la prima transazione
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border print:shadow-none print:border-0">
          <CardContent className="p-4 md:p-6 print:p-0">
            <div className="rounded-md border border-border overflow-hidden print:border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="hidden print:table-cell">Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="w-[100px] print:hidden">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {format(new Date(transaction.date), "dd MMM yyyy", {
                          locale: it,
                        })}
                      </TableCell>
                      <TableCell className="hidden print:table-cell">
                        {transaction.type === "income" ? "Entrata" : "Uscita"}
                      </TableCell>
                      <TableCell>
                        {transaction.categories ? (
                          <Badge variant="secondary">
                            {transaction.categories.name}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{transaction.description || "-"}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          transaction.type === "income"
                            ? "text-success"
                            : "text-destructive"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}€
                        {transaction.amount.toLocaleString("it-IT", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="print:hidden">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(transaction)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Riepilogo per stampa */}
      {transactions.length > 0 && (
        <div className="hidden print:block mt-8 p-4 border border-border rounded">
          <h3 className="font-bold mb-4">RIEPILOGO</h3>
          <p className="text-success">
            Totale Entrate: +€{totals.entrate.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-destructive">
            Totale Uscite: -€{totals.uscite.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </p>
          <p className={`font-bold mt-2 ${totals.saldo >= 0 ? "text-success" : "text-destructive"}`}>
            Saldo: {totals.saldo >= 0 ? "+" : ""}€{totals.saldo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={selectedTransaction}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />

      <ImportTransactionsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}
