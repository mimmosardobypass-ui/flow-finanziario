import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useImputaPagamentoRate,
  useMovimentiCandidati,
  useRatePerMovimento,
  type RataFinanziamento,
  type RataPerMovimento,
} from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData, tronca, parseImporto } from "./utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Movimento già scelto (es. dal pannello di un movimento). */
  transactionId?: string | null;
  /** Rata di partenza, quando si apre dal menu della riga. */
  rata?: RataFinanziamento | null;
  scadenziarioId?: string | null;
}

/** Distribuisce l'importo disponibile sulle rate spuntate, in ordine di scadenza. */
export function calcolaQuote(
  rate: RataPerMovimento[],
  selezionate: Set<string>,
  disponibile: number,
): { quote: Map<string, number>; imputato: number; residuo: number } {
  const quote = new Map<string, number>();
  let resta = disponibile;
  const ordinate = [...rate]
    .filter((r) => selezionate.has(r.rata_id))
    .sort((a, b) => (a.data_scadenza ?? "").localeCompare(b.data_scadenza ?? ""));
  ordinate.forEach((r) => {
    const quota = Math.max(0, Math.min(resta, r.residuo));
    quote.set(r.rata_id, quota);
    resta = Math.round((resta - quota) * 100) / 100;
  });
  return { quote, imputato: Math.round((disponibile - resta) * 100) / 100, residuo: resta };
}

export function ImputaPagamentoDialog({
  open,
  onOpenChange,
  transactionId = null,
  rata = null,
  scadenziarioId = null,
}: Props) {
  const [movimento, setMovimento] = useState<string | null>(transactionId);
  const [ricerca, setRicerca] = useState("");
  const [importoFiltro, setImportoFiltro] = useState("");
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setMovimento(transactionId);
      setSelezionate(new Set());
    }
  }, [open, transactionId]);

  const { data: candidati = [], isLoading: caricaCandidati } = useMovimentiCandidati(
    !movimento && rata ? rata.id : null,
    ricerca,
  );
  const { data: rate = [], isLoading: caricaRate } = useRatePerMovimento(
    movimento,
    scadenziarioId ?? rata?.scadenziario_id ?? null,
  );
  const imputa = useImputaPagamentoRate();

  useEffect(() => {
    if (!rate.length) return;
    setSelezionate((prec) => {
      if (prec.size) return prec;
      const base = new Set(rate.filter((r) => r.preselezionata).map((r) => r.rata_id));
      if (rata && rate.some((r) => r.rata_id === rata.id)) base.add(rata.id);
      return base;
    });
  }, [rate, rata]);

  const movimentoScelto = useMemo(
    () => candidati.find((m) => m.id === movimento) ?? null,
    [candidati, movimento],
  );
  const disponibile = useMemo(() => {
    if (movimentoScelto) return Math.abs(movimentoScelto.amount);
    return rate.reduce((s, r) => s + r.quota_proposta, 0);
  }, [movimentoScelto, rate]);

  const { quote, imputato, residuo } = useMemo(
    () => calcolaQuote(rate, selezionate, disponibile),
    [rate, selezionate, disponibile],
  );

  const filtrati = useMemo(() => {
    const target = parseImporto(importoFiltro);
    return candidati
      .filter((m) => (target === null ? true : Math.abs(Math.abs(m.amount) - target) < 0.02))
      .slice(0, 60);
  }, [candidati, importoFiltro]);

  const conferma = async () => {
    if (!movimento || !selezionate.size) return;
    const esito = await imputa.mutateAsync({
      transaction_id: movimento,
      rata_ids: [...selezionate],
    });
    toast.success("Pagamento imputato", {
      description: `Imputato ${fmtEur(esito.imputato_ora)} di ${fmtEur(
        esito.importo_movimento,
      )} · residuo non imputato ${fmtEur(esito.residuo_non_imputato)}`,
    });
    onOpenChange(false);
  };

  const toggle = (id: string) =>
    setSelezionate((prec) => {
      const next = new Set(prec);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Imputa pagamento</DialogTitle>
          <DialogDescription>
            Un solo movimento può coprire più rate, oppure solo una parte di una rata.
          </DialogDescription>
        </DialogHeader>

        {!movimento ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Cerca nella descrizione</Label>
                <Input
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  placeholder="Es. BONIFICO"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Importo (€)</Label>
                <Input
                  value={importoFiltro}
                  onChange={(e) => setImportoFiltro(e.target.value)}
                  placeholder="800,00"
                />
              </div>
            </div>
            <ScrollArea className="max-h-[45vh] pr-3">
              {caricaCandidati ? (
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
                      onClick={() => setMovimento(m.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
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
          </>
        ) : (
          <>
            <ScrollArea className="max-h-[45vh] pr-3">
              {caricaRate ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Caricamento…</p>
              ) : rate.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nessuna rata aperta da imputare a questo movimento.
                </p>
              ) : (
                <div className="space-y-2">
                  {rate.map((r) => {
                    const scelta = selezionate.has(r.rata_id);
                    const quota = quote.get(r.rata_id) ?? 0;
                    return (
                      <label
                        key={r.rata_id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3",
                          scelta ? "bg-primary/5" : "opacity-60",
                        )}
                      >
                        <Checkbox checked={scelta} onCheckedChange={() => toggle(r.rata_id)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            Rata {r.numero_rata}
                            {r.piano ? ` · ${r.piano}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            scadenza {fmtData(r.data_scadenza)} · residuo {fmtEur(r.residuo)}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                          {scelta ? fmtEur(quota) : "—"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="rounded-lg border border-border p-3 text-sm">
              Imputato {fmtEur(imputato)} di {fmtEur(disponibile)} · residuo non imputato{" "}
              <span className={cn("font-semibold", residuo > 0.009 ? "text-warning" : "text-success")}>
                {fmtEur(residuo)}
              </span>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          {movimento && !transactionId && (
            <Button variant="outline" onClick={() => setMovimento(null)}>
              Cambia movimento
            </Button>
          )}
          <Button
            onClick={conferma}
            disabled={!movimento || selezionate.size === 0 || imputa.isPending}
          >
            Conferma
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
