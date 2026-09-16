import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  useProposteRate,
  useCollegaRata,
  useFinanziamenti,
  type PropostaRata,
} from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData, tronca, titoloContratto } from "./utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scadenziarioId?: string | null;
}

const GRUPPI: { chiave: string; titolo: string; classe: string }[] = [
  { chiave: "alta", titolo: "Alta", classe: "border-success/40 bg-success/10 text-success" },
  { chiave: "media", titolo: "Media", classe: "border-warning/40 bg-warning/10 text-warning" },
  { chiave: "bassa", titolo: "Bassa", classe: "border-border bg-muted text-muted-foreground" },
];

export function AbbinaRateDialog({ open, onOpenChange, scadenziarioId }: Props) {
  const { data: proposte = [], isLoading } = useProposteRate(scadenziarioId ?? null, open);
  const { data: contratti = [] } = useFinanziamenti();
  const collega = useCollegaRata();
  const [selezione, setSelezione] = useState<Record<string, boolean>>({});
  const [inCorso, setInCorso] = useState(false);

  const keyOf = (p: PropostaRata) => `${p.rata_id}|${p.transaction_id}`;

  useEffect(() => {
    if (!open) return;
    const iniziale: Record<string, boolean> = {};
    proposte.forEach((p) => {
      if (p.confidenza === "alta") iniziale[keyOf(p)] = true;
    });
    setSelezione(iniziale);
  }, [open, proposte]);

  const nomeContratto = (id: string) => {
    const c = contratti.find((x) => x.id === id);
    return c ? titoloContratto(c.societa_finanziaria, c.nome) : "Finanziamento";
  };

  const selezionate = useMemo(
    () => proposte.filter((p) => selezione[keyOf(p)]),
    [proposte, selezione],
  );

  const conferma = async () => {
    setInCorso(true);
    let ok = 0;
    for (const p of selezionate) {
      try {
        await collega.mutateAsync({
          rata_id: p.rata_id,
          transaction_id: p.transaction_id,
          confidenza: p.confidenza,
        });
        ok++;
      } catch {
        /* l'errore viene già mostrato dal gestore globale */
      }
    }
    setInCorso(false);
    toast.success(`${ok} rate collegate`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Abbina rate</DialogTitle>
          <DialogDescription>
            Movimenti bancari che corrispondono alle rate dei tuoi finanziamenti.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ricerca in corso…</p>
        ) : proposte.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nessun abbinamento da rivedere.
          </p>
        ) : (
          <ScrollArea className="max-h-[55vh] pr-3">
            <div className="space-y-5">
              {GRUPPI.map((g) => {
                const righe = proposte.filter((p) => p.confidenza === g.chiave);
                if (!righe.length) return null;
                return (
                  <div key={g.chiave} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={g.classe}>
                        Confidenza {g.titolo}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{righe.length}</span>
                    </div>
                    {righe.map((p) => {
                      const k = keyOf(p);
                      return (
                        <label
                          key={k}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={!!selezione[k]}
                            onCheckedChange={(v) =>
                              setSelezione((s) => ({ ...s, [k]: v === true }))
                            }
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {nomeContratto(p.scadenziario_id)} · rata {p.numero_rata} del{" "}
                              {fmtData(p.data_scadenza)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Movimento del {fmtData(p.data_movimento)} · {tronca(p.descrizione, 70)}
                            </p>
                            {p.giorni_scarto > 5 && (
                              <p className="text-xs text-warning">
                                {p.giorni_scarto} giorni dopo la scadenza
                              </p>
                            )}
                          </div>
                          <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                            {fmtEur(p.importo_movimento)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
          <Button onClick={conferma} disabled={!selezionate.length || inCorso}>
            {inCorso ? "Collegamento…" : `Collega selezionate (${selezionate.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
