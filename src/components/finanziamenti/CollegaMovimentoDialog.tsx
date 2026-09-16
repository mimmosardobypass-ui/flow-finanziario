import { useMemo, useState } from "react";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMovimentiCandidati, useCollegaRata, type RataFinanziamento } from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData, tronca, parseImporto } from "./utils";

interface Props {
  rata: RataFinanziamento | null;
  onOpenChange: (v: boolean) => void;
}

export function CollegaMovimentoDialog({ rata, onOpenChange }: Props) {
  const [ricerca, setRicerca] = useState("");
  const [importo, setImporto] = useState("");
  const [scelto, setScelto] = useState<string | null>(null);
  const { data: movimenti = [], isLoading } = useMovimentiCandidati(rata?.id ?? null, ricerca);
  const collega = useCollegaRata();

  const filtrati = useMemo(() => {
    const target = parseImporto(importo);
    const scadenza = rata?.data_scadenza ? parseISO(rata.data_scadenza) : null;
    return movimenti
      .filter((m) => (target === null ? true : Math.abs(m.amount - target) < 0.02))
      .sort((a, b) => {
        if (!scadenza) return b.date.localeCompare(a.date);
        return (
          Math.abs(differenceInDays(parseISO(a.date), scadenza)) -
          Math.abs(differenceInDays(parseISO(b.date), scadenza))
        );
      })
      .slice(0, 60);
  }, [movimenti, importo, rata?.data_scadenza]);

  const conferma = async () => {
    if (!rata || !scelto) return;
    await collega.mutateAsync({ rata_id: rata.id, transaction_id: scelto, confidenza: "manuale" });
    toast.success("Movimento collegato alla rata");
    setScelto(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={!!rata} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Collega un movimento</DialogTitle>
          <DialogDescription>
            {rata
              ? `Rata ${rata.numero_rata} del ${fmtData(rata.data_scadenza)} · ${fmtEur(rata.importo)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cerca nella descrizione</Label>
            <Input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Es. FINDOMESTIC" />
          </div>
          <div className="space-y-1.5">
            <Label>Importo (€)</Label>
            <Input value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="180,50" />
          </div>
        </div>

        <ScrollArea className="max-h-[45vh] pr-3">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Caricamento…</p>
          ) : filtrati.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nessun movimento di uscita libero corrisponde ai filtri.
            </p>
          ) : (
            <div className="space-y-2">
              {filtrati.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setScelto(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                    scelto === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{tronca(m.description, 70)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtData(m.date)} · {m.conto_nome ?? "—"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                    {fmtEur(m.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={conferma} disabled={!scelto || collega.isPending}>
            Collega
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
