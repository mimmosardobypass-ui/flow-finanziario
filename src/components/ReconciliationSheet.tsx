import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link2, Unlink, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TransactionWithCategory } from "@/hooks/useTransactions";
import {
  useCompatibleTransactions,
  useReconciliationGroup,
  useReconcile,
  useUnreconcile,
} from "@/hooks/useReconciliation";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionWithCategory | null;
}

export function ReconciliationSheet({ open, onOpenChange, transaction }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const reconciliationId = (transaction as any)?.reconciliation_id as string | null;
  const reconciliationStatus = (transaction as any)?.reconciliation_status as string | undefined;

  const { data: compatibleTxns = [], isLoading: loadingCompatible } =
    useCompatibleTransactions(transaction);
  const { data: groupTxns = [], isLoading: loadingGroup } =
    useReconciliationGroup(reconciliationId);

  const reconcileMutation = useReconcile();
  const unreconcileMutation = useUnreconcile();

  const isReconciled = reconciliationStatus && reconciliationStatus !== "none";

  // Group members excluding the selected transaction
  const otherGroupMembers = useMemo(
    () => groupTxns.filter((t) => t.id !== transaction?.id),
    [groupTxns, transaction?.id]
  );

  // Compatible transactions excluding already reconciled ones in same group
  const groupIds = useMemo(() => new Set(groupTxns.map((t) => t.id)), [groupTxns]);
  const availableCompatible = useMemo(
    () => compatibleTxns.filter((t) => !groupIds.has(t.id)),
    [compatibleTxns, groupIds]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReconcile = async () => {
    if (!transaction || selectedIds.size === 0) return;
    try {
      await reconcileMutation.mutateAsync([transaction.id, ...Array.from(selectedIds)]);
      toast({ title: "Movimenti riconciliati" });
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch {
      toast({ title: "Errore nella riconciliazione", variant: "destructive" });
    }
  };

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

  const handleOpenChange = (v: boolean) => {
    if (!v) setSelectedIds(new Set());
    onOpenChange(v);
  };

  if (!transaction) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
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
                  {transaction.conti?.nome_conto} · {format(new Date(transaction.date), "dd MMM yyyy", { locale: it })}
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
                <p className="text-sm font-medium mb-2">Movimenti già riconciliati</p>
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

          {/* Compatible transactions */}
          <div>
            <p className="text-sm font-medium mb-2">
              Movimenti compatibili
              {loadingCompatible && " (caricamento...)"}
            </p>
            {availableCompatible.length === 0 && !loadingCompatible ? (
              <p className="text-sm text-muted-foreground">Nessun movimento compatibile trovato.</p>
            ) : (
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-2 pr-4">
                  {availableCompatible.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.description || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.conti?.nome_conto} · {format(new Date(t.date), "dd MMM yyyy", { locale: it })}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${t.type === "income" ? "text-success" : "text-destructive"}`}
                      >
                        {t.type === "income" ? "+" : "-"}€
                        {t.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Reconcile button */}
          {selectedIds.size > 0 && (
            <Button
              className="w-full gap-2"
              onClick={handleReconcile}
              disabled={reconcileMutation.isPending}
            >
              {reconcileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Riconcilia ({selectedIds.size} moviment{selectedIds.size === 1 ? "o" : "i"})
            </Button>
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
          {transaction.conti?.nome_conto} · {format(new Date(transaction.date), "dd MMM yyyy", { locale: it })}
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
