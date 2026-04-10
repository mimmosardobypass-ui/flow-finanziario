import { useState, useMemo, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown, ChevronRight, Copy, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useDuplicateDetection, DuplicateGroup } from "@/hooks/useDuplicateDetection";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicatesDialog({ open, onOpenChange }: Props) {
  const { groups, scanning, deleting, scan, deleteSelected, reset } = useDuplicateDetection();
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      scan();
      setSelectedForDeletion(new Set());
    } else {
      reset();
    }
  }, [open]);

  useEffect(() => {
    const toDelete = new Set<string>();
    for (const g of groups) {
      for (const t of g.transactions) {
        if (t.id !== g.keepId) toDelete.add(t.id);
      }
    }
    setSelectedForDeletion(toDelete);
  }, [groups]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedForDeletion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const totalDuplicateRows = useMemo(
    () => groups.reduce((sum, g) => sum + g.transactions.length - 1, 0),
    [groups]
  );

  const handleDelete = async () => {
    const ids = Array.from(selectedForDeletion);
    try {
      await deleteSelected(ids);
      toast({ title: `${ids.length} movimenti duplicati eliminati` });
      if (groups.length === 0) onOpenChange(false);
    } catch {
      toast({ title: "Errore durante l'eliminazione", variant: "destructive" });
    }
  };

  const excludeAll = useCallback(() => {
    const toDelete = new Set<string>();
    for (const g of groups) {
      for (const t of g.transactions) {
        if (t.id !== g.keepId) toDelete.add(t.id);
      }
    }
    setSelectedForDeletion(toDelete);
  }, [groups]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Possibili duplicati
          </DialogTitle>
          <DialogDescription>
            Movimenti con stessa data, importo, descrizione e conto.
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisi in corso...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-lg font-semibold text-foreground">Nessun duplicato trovato</p>
            <p className="text-sm text-muted-foreground">Tutti i movimenti sono unici.</p>
          </div>
        ) : (
          <>
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 px-6 py-3 shrink-0">
              <Badge variant="secondary">{groups.length} gruppi trovati</Badge>
              <Badge variant="secondary">{totalDuplicateRows} copie extra</Badge>
              <Badge variant="destructive">{selectedForDeletion.size} selezionati per eliminazione</Badge>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
              <div className="space-y-3">
                {groups.map((group, gi) => (
                  <GroupCard
                    key={group.fingerprint}
                    group={group}
                    index={gi}
                    selectedForDeletion={selectedForDeletion}
                    onToggle={toggleSelection}
                  />
                ))}
              </div>
            </div>

            {/* Fixed footer */}
            <DialogFooter className="px-6 py-4 shrink-0 border-t gap-2">
              <Button variant="outline" onClick={excludeAll} disabled={deleting}>
                Seleziona tutti i duplicati
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || selectedForDeletion.size === 0}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Elimina {selectedForDeletion.size} duplicati selezionati
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupCard({
  group,
  index,
  selectedForDeletion,
  onToggle,
}: {
  group: DuplicateGroup;
  index: number;
  selectedForDeletion: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className="border-border">
        <CardContent className="p-0">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-t-lg">
              {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="text-xs font-semibold text-muted-foreground">
                Gruppo {index + 1} — {group.transactions.length} movimenti
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-1.5">
              {group.transactions.map((t) => {
                const isKeep = t.id === group.keepId;
                const isSelected = selectedForDeletion.has(t.id);

                return (
                  <div
                    key={t.id}
                    className={`flex items-start gap-3 rounded-md px-3 py-2.5 text-xs ${
                      isKeep
                        ? "bg-success/10 border border-success/30"
                        : isSelected
                        ? "bg-destructive/5 border border-destructive/20"
                        : "bg-secondary/50 border border-border"
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(t.id)}
                        disabled={isKeep}
                        aria-label={isKeep ? "Da conservare" : "Seleziona per eliminazione"}
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="whitespace-nowrap font-medium">
                          {format(new Date(t.date), "dd/MM/yyyy", { locale: it })}
                        </span>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {t.conti?.nome_conto || "—"}
                        </span>
                        <span
                          className={`whitespace-nowrap font-semibold ${
                            t.type === "income" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {t.type === "income" ? "+" : "-"}€{t.amount.toFixed(2)}
                        </span>
                        {isKeep && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            Conserva
                          </Badge>
                        )}
                      </div>
                      {/* Full description, wrapping */}
                      <p className="text-muted-foreground break-words whitespace-pre-wrap leading-relaxed">
                        {t.description || "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
