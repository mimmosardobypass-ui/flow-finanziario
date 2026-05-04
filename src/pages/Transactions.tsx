import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Receipt, Plus, Pencil, Trash2, Upload, ArrowLeftRight, Circle, Check, RefreshCw, Copy, type LucideIcon } from "lucide-react";
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
import { DuplicatesDialog } from "@/components/DuplicatesDialog";

import { ReconciliationSheet } from "@/components/ReconciliationSheet";
import {
  useFilteredTransactions,
  TransactionFilters as FiltersType,
} from "@/hooks/useFilteredTransactions";
import {
  useDeleteTransaction,
  TransactionWithCategory,
} from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useRecalculateAllSuggestions } from "@/hooks/useReconciliationSuggestions";
import { toast } from "@/hooks/use-toast";

/* ─── deterministic Ric. indicator (single source of truth) ─── */
type ReconciliationStatus = "none" | "suggested" | "reconciled";

function getRicIndicator(status: string): { Icon: LucideIcon; className: string; fill?: boolean } {
  switch (status) {
    case "reconciled":
      return { Icon: Check, className: "text-success" };
    case "suggested":
      return { Icon: Circle, className: "text-destructive", fill: true };
    case "none":
      return { Icon: Circle, className: "text-muted-foreground" };
    default:
      console.warn(`[RIC_RENDER] Unexpected reconciliation_status: "${status}"`);
      return { Icon: Circle, className: "text-muted-foreground" };
  }
}

export default function Transactions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [reconciliationTransaction, setReconciliationTransaction] =
    useState<TransactionWithCategory | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithCategory | null>(null);
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<FiltersType>(() => {
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const contoId = searchParams.get("contoId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    
    return {
      type: type === "income" || type === "expense" ? type : "all",
      categoryId: categoryId || undefined,
      contoId: contoId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      searchText: search || undefined,
    };
  });

  // Debounced URL sync to avoid cursor reset during typing
  const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(urlSyncTimerRef.current);
    urlSyncTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (filters.type && filters.type !== "all") params.set("type", filters.type);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.contoId) params.set("contoId", filters.contoId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.searchText) params.set("search", filters.searchText);
      if (filters.amountMin) params.set("amountMin", filters.amountMin.toString());
      if (filters.amountMax) params.set("amountMax", filters.amountMax.toString());
      setSearchParams(params, { replace: true });
    }, 500);

    return () => clearTimeout(urlSyncTimerRef.current);
  }, [filters, setSearchParams]);

  const { data: transactions = [], isLoading, isFetching, isPlaceholderData } = useFilteredTransactions(filters);
  const { data: allCategories = [] } = useCategories();
  const deleteMutation = useDeleteTransaction();

  // Build a map: categoryId -> parent category name
  const categoryParentMap = useMemo(() => {
    const map = new Map<string, string>();
    allCategories.forEach((cat) => {
      if (cat.parent_id) {
        const parent = allCategories.find((p) => p.id === cat.parent_id);
        if (parent) map.set(cat.id, parent.name);
      }
    });
    return map;
  }, [allCategories]);
  const normalizedSearchText = filters.searchText?.trim().toLowerCase() || "";
  const displayedTransactions = useMemo(() => {
    const seenIds = new Set<string>();
    const uniqueTransactions = transactions.filter((transaction) => {
      if (seenIds.has(transaction.id)) {
        return false;
      }

      seenIds.add(transaction.id);
      return true;
    });

    if (!normalizedSearchText) {
      return uniqueTransactions;
    }

    return uniqueTransactions.filter((transaction) =>
      (transaction.description || "").toLowerCase().includes(normalizedSearchText)
    );
  }, [transactions, normalizedSearchText]);
  const searchDebug = useMemo(() => {
    if (!normalizedSearchText) return null;

    const queryParts = ["deleted_at IS NULL", `description ILIKE '%${filters.searchText?.trim() || ""}%'`];

    if (filters.contoId) queryParts.push(`conto_id = '${filters.contoId}'`);
    if (filters.categoryId) queryParts.push(`category_id IN figli('${filters.categoryId}')`);
    if (filters.type && filters.type !== "all") queryParts.push(`type = '${filters.type}'`);
    if (filters.dateFrom) queryParts.push(`date >= '${filters.dateFrom}'`);
    if (filters.dateTo) queryParts.push(`date <= '${filters.dateTo}'`);
    if (filters.amountMin !== undefined && filters.amountMin > 0) queryParts.push(`amount >= ${filters.amountMin}`);
    if (filters.amountMax !== undefined && filters.amountMax > 0) queryParts.push(`amount <= ${filters.amountMax}`);
    if (filters.reconciliation && filters.reconciliation !== "all") {
      queryParts.push(
        filters.reconciliation === "not_reconciled"
          ? "reconciliation_status IN ('none', 'suggested')"
          : `reconciliation_status = '${filters.reconciliation}'`
      );
    }

    return {
      fields: ["description"],
      finalQuery: queryParts.join(" AND "),
      serverCount: isFetching && isPlaceholderData ? null : transactions.length,
      renderedCount: displayedTransactions.length,
      usingPlaceholderData: isPlaceholderData,
    };
  }, [displayedTransactions.length, filters.amountMax, filters.amountMin, filters.categoryId, filters.contoId, filters.dateFrom, filters.dateTo, filters.reconciliation, filters.searchText, filters.type, isFetching, isPlaceholderData, normalizedSearchText, transactions.length]);
  const recalcMutation = useRecalculateAllSuggestions();
  const backfillDoneRef = useRef(false);

  useEffect(() => {
    if (!searchDebug) return;
    console.log("[TX_SEARCH_RENDER_DEBUG]", searchDebug);
  }, [searchDebug]);

  // Auto-backfill: on first load, if there are transactions but no suggestions yet
  useEffect(() => {
    if (backfillDoneRef.current || isLoading || transactions.length === 0) return;
    const hasNone = transactions.some((t) => (t as any).reconciliation_status === "none");
    const hasSuggested = transactions.some((t) => (t as any).reconciliation_status === "suggested");
    if (hasNone && !hasSuggested) {
      backfillDoneRef.current = true;
      console.log("[suggestions] Auto-backfill triggered");
      recalcMutation.mutate(undefined, {
        onSuccess: (count) => {
          if (count && count > 0) {
            toast({ title: `Proposte di riconciliazione generate per ${count} transazioni` });
          }
        },
      });
    } else {
      backfillDoneRef.current = true;
    }
  }, [isLoading, transactions]);

  // Calcola totali
  const totals = useMemo(() => {
    const entrate = displayedTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const uscite = displayedTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      entrate,
      uscite,
      saldo: entrate - uscite,
    };
  }, [displayedTransactions]);

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
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              console.log("[RIC_RECALC_UI] click");
              recalcMutation.mutate(undefined, {
                onSuccess: (count) => {
                  console.log(`[RIC_RECALC_UI] success count=${count}`);
                  toast({ title: `Riconciliazione ricalcolata per ${count} transazioni` });
                },
                onError: (err) => {
                  console.error(`[RIC_RECALC_UI] error=`, err);
                  toast({ title: "Errore nel ricalcolo", variant: "destructive" });
                },
              });
            }}
            disabled={recalcMutation.isPending}
            title="Ricalcola proposte di riconciliazione"
          >
            <RefreshCw className={`h-4 w-4 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setDuplicatesOpen(true)}>
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Duplicati</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/import-transazioni")}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importa</span>
          </Button>
          <ExportDropdown
            transactions={displayedTransactions}
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

      {searchDebug && (
        <Card className="print:hidden bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Campi ricerca: {searchDebug.fields.join(", ")}</Badge>
              <Badge variant="secondary">
                Record dal server: {searchDebug.serverCount ?? "aggiornamento in corso..."}
              </Badge>
              <Badge variant="secondary">Record renderizzati: {searchDebug.renderedCount}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Query finale</p>
              <code className="block rounded-md bg-secondary px-3 py-2 text-xs text-foreground break-all">
                {searchDebug.finalQuery}
              </code>
              {searchDebug.usingPlaceholderData && (
                <p className="text-xs text-muted-foreground">
                  Risultati in aggiornamento: la tabella mostra comunque solo le righe la cui descrizione contiene il testo cercato.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteggio e totali */}
      {displayedTransactions.length > 0 && (
        <div className="flex flex-wrap gap-4 items-center text-sm print:hidden">
          <span className="text-muted-foreground">
            {displayedTransactions.length} transazion{displayedTransactions.length === 1 ? "e" : "i"}
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
      {displayedTransactions.length === 0 ? (
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
            <div className="rounded-md border border-border overflow-auto print:overflow-visible print:border-0 print:max-h-none max-h-[calc(100vh-360px)]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm print:static">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Conto</TableHead>
                    <TableHead className="hidden print:table-cell">Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="w-[50px] print:hidden">Ric.</TableHead>
                    <TableHead className="w-[100px] print:hidden">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setReconciliationTransaction(transaction);
                        setReconciliationOpen(true);
                      }}
                    >
                      <TableCell className="font-medium">
                        {format(new Date(transaction.date), "dd MMM yyyy", {
                          locale: it,
                        })}
                      </TableCell>
                      <TableCell>
                        {transaction.conti?.nome_conto || "Conto Principale"}
                      </TableCell>
                      <TableCell className="hidden print:table-cell">
                        {transaction.type === "income" ? "Entrata" : "Uscita"}
                      </TableCell>
                      <TableCell>
                        {transaction.categories ? (
                          <div className="flex flex-col gap-0.5">
                            {categoryParentMap.has(transaction.categories.id) ? (
                              <>
                                <Badge variant="secondary">
                                  {categoryParentMap.get(transaction.categories.id)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {transaction.categories.name}
                                </span>
                              </>
                            ) : (
                              <Badge variant="secondary">
                                {transaction.categories.name}
                              </Badge>
                            )}
                          </div>
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
                        <div className="flex items-center justify-end gap-1.5">
                          {(transaction as any).transfer_id && (
                            <Badge variant="outline" className="text-primary border-primary/30 text-[10px] px-1.5 py-0">
                              <ArrowLeftRight className="h-3 w-3 mr-0.5" />
                              Trasf.
                            </Badge>
                          )}
                          <span>
                            {transaction.type === "income" ? "+" : "-"}€
                            {transaction.amount.toLocaleString("it-IT", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="print:hidden">
                        {(() => {
                          const status = (transaction as any).reconciliation_status || "none";
                          const { Icon, className, fill } = getRicIndicator(status);
                          return (
                            <Icon className={`h-4 w-4 ${className}`} fill={fill ? "currentColor" : "none"} />
                          );
                        })()}
                      </TableCell>
                      <TableCell className="print:hidden">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEdit(transaction); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleDelete(transaction); }}
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
      {displayedTransactions.length > 0 && (
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


      <ReconciliationSheet
        open={reconciliationOpen}
        onOpenChange={setReconciliationOpen}
        transaction={reconciliationTransaction}
      />

      <DuplicatesDialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen} />
    </div>
  );
}
