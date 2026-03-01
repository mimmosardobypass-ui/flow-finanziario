import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link2, Unlink, Loader2, Search, Check, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TransactionWithCategory } from "@/hooks/useTransactions";
import {
  useReconciliationGroup,
  useUnreconcile,
} from "@/hooks/useReconciliation";
import {
  useSuggestionsForTransaction,
  useAcceptSuggestion,
  useDismissSuggestion,
  useGenerateSuggestionsForTransaction,
} from "@/hooks/useReconciliationSuggestions";
import { useTransactions } from "@/hooks/useTransactions";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionWithCategory | null;
}

export function ReconciliationSheet({ open, onOpenChange, transaction }: Props) {
  const reconciliationId = (transaction as any)?.reconciliation_id as string | null;
  const reconciliationStatus = (transaction as any)?.reconciliation_status as string | undefined;

  const { data: groupTxns = [], isLoading: loadingGroup } =
    useReconciliationGroup(reconciliationId);
  const { data: suggestions = [], isLoading: loadingSuggestions } =
    useSuggestionsForTransaction(transaction?.id ?? null);
  const { data: allTransactions = [] } = useTransactions();

  const unreconcileMutation = useUnreconcile();
  const acceptMutation = useAcceptSuggestion();
  const dismissMutation = useDismissSuggestion();
  const generateMutation = useGenerateSuggestionsForTransaction();

  const isReconciled = reconciliationStatus === "reconciled";

  const otherGroupMembers = useMemo(
    () => groupTxns.filter((t) => t.id !== transaction?.id),
    [groupTxns, transaction?.id],
  );

  // Map suggestion other_transaction_id to actual transaction data
  const suggestionsWithTxn = useMemo(() => {
    if (!suggestions.length || !allTransactions.length) return [];
    const txnMap = new Map(allTransactions.map((t) => [t.id, t]));
    return suggestions
      .map((s: any) => ({
        suggestion: s,
        transaction: txnMap.get(s.other_transaction_id),
      }))
      .filter((s) => s.transaction != null);
  }, [suggestions, allTransactions]);

  const handleUnreconcile = async () => {
    if (!reconciliationId) return;
    try {
      await unreconcileMutation.mutateAsync(reconciliationId);
      toast({ title: "Riconciliazione rimossa" });
      onOpenChange(false);
    } catch {
      toast({ title: "Errore nella rimozione", variant: "destructive" });
    }
  };

  const handleAccept = async (suggestion: any) => {
    if (!transaction) return;
    try {
      await acceptMutation.mutateAsync({
        sourceId: transaction.id,
        candidateId: suggestion.other_transaction_id,
      });
      toast({ title: "Movimenti riconciliati" });
      onOpenChange(false);
    } catch {
      toast({ title: "Errore nella riconciliazione", variant: "destructive" });
    }
  };

  const handleDismiss = async (suggestion: any) => {
    if (!transaction) return;
    try {
      await dismissMutation.mutateAsync({ suggestionId: suggestion.id, transactionId: transaction.id });
      toast({ title: "Proposta rifiutata" });
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    }
  };

  const handleSearch = async () => {
    if (!transaction) return;
    try {
      await generateMutation.mutateAsync(transaction.id);
      toast({ title: "Proposte aggiornate" });
    } catch {
      toast({ title: "Errore nel ricalcolo", variant: "destructive" });
    }
  };

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
  };

  if (!transaction) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden">
        <SheetHeader>
          <SheetTitle>Riconciliazione</SheetTitle>
          <SheetDescription>
            Collega movimenti di conti diversi per riconciliarli.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Selected transaction details */}
          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Movimento selezionato</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{transaction.description || "—"}</p>
                <p className="text-sm text-muted-foreground">
                  {transaction.conti?.nome_conto} ·{" "}
                  {format(new Date(transaction.date), "dd MMM yyyy", { locale: it })}
                </p>
              </div>
              <span
                className={`font-semibold ${transaction.type === "income" ? "text-success" : "text-destructive"}`}
              >
                {transaction.type === "income" ? "+" : "-"}€
                {transaction.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Already reconciled group */}
          {isReconciled && otherGroupMembers.length > 0 && (
            <>
              <div>
                <p className="text-sm font-medium mb-2">Movimenti riconciliati</p>
                <div className="space-y-2">
                  {otherGroupMembers.map((t) => (
                    <TransactionRow key={t.id} transaction={t} />
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive"
                onClick={handleUnreconcile}
                disabled={unreconcileMutation.isPending}
              >
                {unreconcileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Rimuovi riconciliazione
              </Button>
              <Separator />
            </>
          )}

          {/* Suggestions (for suggested or none status) */}
          {!isReconciled && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  Proposte
                  {loadingSuggestions && " (caricamento...)"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={handleSearch}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Cerca proposte
                </Button>
              </div>

              {suggestionsWithTxn.length === 0 && !loadingSuggestions ? (
                <p className="text-sm text-muted-foreground">
                  Nessuna proposta trovata. Prova "Cerca proposte" per ricalcolare.
                </p>
              ) : (
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-2 pr-4">
                    <TooltipProvider>
                      {suggestionsWithTxn.map(({ suggestion, transaction: candTxn }) => (
                        <div
                          key={suggestion.id}
                          className="flex flex-col rounded-lg border border-border p-3"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate max-w-[70%]">
                              {candTxn!.description || "—"}
                            </p>
                            {(() => {
                              const reason = suggestion.reason || "";
                              const type = reason.includes("internal_transfer")
                                ? "Giroconto"
                                : reason.includes("same_amount")
                                  ? "Importo"
                                  : reason.includes("keyword")
                                    ? "Keyword"
                                    : "Match";
                              return (
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {type}
                                </Badge>
                              );
                            })()}
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="text-[10px] shrink-0">
                                  {suggestion.score}pt
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{suggestion.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">
                              {candTxn!.conti?.nome_conto} ·{" "}
                              {format(new Date(candTxn!.date), "dd MMM yyyy", { locale: it })}
                              {(() => {
                                if (!transaction) return null;
                                const days = Math.abs(
                                  Math.round(
                                    (new Date(candTxn!.date).getTime() - new Date(transaction.date).getTime()) / 86400000
                                  )
                                );
                                return days > 0 ? ` · Δ${days}gg` : null;
                              })()}
                            </p>
                            <span
                              className={`text-sm font-semibold ${candTxn!.type === "income" ? "text-success" : "text-destructive"}`}
                            >
                              {candTxn!.type === "income" ? "+" : "-"}€
                              {candTxn!.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
                              onClick={() => handleAccept(suggestion)}
                              disabled={acceptMutation.isPending}
                            >
                              {acceptMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              Riconcilia
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={() => handleDismiss(suggestion)}
                              disabled={dismissMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                              Rifiuta
                            </Button>
                          </div>
                        </div>
                      ))}
                    </TooltipProvider>
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TransactionRow({ transaction }: { transaction: TransactionWithCategory }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{transaction.description || "—"}</p>
        <p className="text-xs text-muted-foreground">
          {transaction.conti?.nome_conto} ·{" "}
          {format(new Date(transaction.date), "dd MMM yyyy", { locale: it })}
        </p>
      </div>
      <span
        className={`text-sm font-semibold whitespace-nowrap ${transaction.type === "income" ? "text-success" : "text-destructive"}`}
      >
        {transaction.type === "income" ? "+" : "-"}€
        {transaction.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}
