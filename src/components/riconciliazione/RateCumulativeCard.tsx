import { useMemo, useState } from "react";
import { AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  useImputaPagamentoRate,
  useTrovaPagamentiCumulativi,
  type PagamentoCumulativo,
} from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData, tronca } from "@/components/finanziamenti/utils";

function classeConfidenza(c: string) {
  if (c === "alta") return "border-success/40 bg-success/10 text-success";
  if (c === "media") return "border-warning/40 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}

/** Quote ricalcolate lato client in ordine di scadenza. */
function quote(proposta: PagamentoCumulativo, scelte: Set<string>) {
  const mappa = new Map<string, number>();
  let resta = proposta.importo;
  [...proposta.righe]
    .filter((r) => scelte.has(r.rata_id))
    .sort((a, b) => (a.scadenza ?? "").localeCompare(b.scadenza ?? ""))
    .forEach((r) => {
      const q = Math.max(0, Math.min(resta, r.residuo));
      mappa.set(r.rata_id, q);
      resta = Math.round((resta - q) * 100) / 100;
    });
  return { mappa, imputato: Math.round((proposta.importo - resta) * 100) / 100, residuo: resta };
}

export function RateCumulativeCard() {
  const cerca = useTrovaPagamentiCumulativi();
  const imputa = useImputaPagamentoRate();
  const [proposte, setProposte] = useState<PagamentoCumulativo[]>([]);
  const [scelte, setScelte] = useState<Record<string, Set<string>>>({});
  const [ignorate, setIgnorate] = useState<Set<string>>(new Set());

  const visibili = useMemo(
    () => proposte.filter((p) => !ignorate.has(p.transaction_id)),
    [proposte, ignorate],
  );
  const altaFiducia = visibili.filter((p) => p.confidenza === "alta" && !p.ambiguo);

  const ricarica = async () => {
    const dati = await cerca.mutateAsync(null);
    setProposte(dati);
    setIgnorate(new Set());
    setScelte(
      Object.fromEntries(
        dati.map((p) => [p.transaction_id, new Set(p.righe.map((r) => r.rata_id))]),
      ),
    );
    toast.success(`${dati.length} proposte trovate`);
  };

  const toggle = (tid: string, rataId: string) =>
    setScelte((prec) => {
      const set = new Set(prec[tid] ?? []);
      if (set.has(rataId)) set.delete(rataId);
      else set.add(rataId);
      return { ...prec, [tid]: set };
    });

  const conferma = async (p: PagamentoCumulativo, rataIds: string[]) => {
    if (!rataIds.length) return;
    const esito = await imputa.mutateAsync({
      transaction_id: p.transaction_id,
      rata_ids: rataIds,
      confidenza: p.confidenza,
    });
    toast.success("Pagamento imputato", {
      description: `Imputato ${fmtEur(esito.imputato_ora)} di ${fmtEur(
        esito.importo_movimento,
      )} · residuo ${fmtEur(esito.residuo_non_imputato)}`,
    });
  };

  const confermaAlta = async () => {
    for (const p of altaFiducia) {
      await conferma(
        p,
        p.righe.map((r) => r.rata_id),
      );
    }
    await ricarica();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" />
          Rate di finanziamenti e dilazioni
          {visibili.length > 0 && (
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              {visibili.length}
            </Badge>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={ricarica} disabled={cerca.isPending}>
          {cerca.isPending ? "Ricerca…" : "Cerca proposte"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibili.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nessuna proposta. Premi “Cerca proposte” per analizzare i movimenti che coprono più rate.
          </p>
        ) : (
          visibili.map((p) => {
            const set = scelte[p.transaction_id] ?? new Set<string>();
            const { mappa, imputato, residuo } = quote(p, set);
            return (
              <div key={p.transaction_id} className="rounded-lg border border-border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="sm:w-[28%]">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {fmtEur(p.importo)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtData(p.data)} · {p.conto ?? "—"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{tronca(p.descrizione, 70)}</p>
                    <p className="truncate text-xs text-muted-foreground">Piano: {p.piano ?? "—"}</p>
                  </div>
                  <div className="sm:text-right">
                    <Badge variant="outline" className={classeConfidenza(p.confidenza)}>
                      {p.confidenza}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{p.tipo}</p>
                  </div>
                </div>

                {p.avviso && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{p.avviso}</span>
                  </div>
                )}

                <div className="mt-3 space-y-1.5">
                  {p.righe.map((r) => {
                    const scelta = set.has(r.rata_id);
                    const q = mappa.get(r.rata_id) ?? 0;
                    const resto = Math.round((r.residuo - q) * 100) / 100;
                    return (
                      <label
                        key={r.rata_id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border border-border px-2.5 py-2 text-sm",
                          !scelta && "opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={scelta}
                          onCheckedChange={() => toggle(p.transaction_id, r.rata_id)}
                        />
                        <span className="w-20 shrink-0 text-foreground">Rata {r.numero_rata}</span>
                        <span className="w-24 shrink-0 text-xs text-muted-foreground">
                          {fmtData(r.scadenza)}
                        </span>
                        <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">
                          residuo {fmtEur(r.residuo)}
                        </span>
                        <span className="w-24 shrink-0 font-medium tabular-nums text-foreground">
                          {scelta ? fmtEur(q) : "—"}
                        </span>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {!scelta
                            ? ""
                            : r.chiude && resto <= 0.009
                              ? "chiude la rata"
                              : `acconto — restano ${fmtEur(resto)}`}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Imputato {fmtEur(imputato)} di {fmtEur(p.importo)} · residuo non imputato{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        residuo > 0.009 ? "text-warning" : "text-success",
                      )}
                    >
                      {fmtEur(residuo)}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setIgnorate((prec) => new Set(prec).add(p.transaction_id))
                      }
                    >
                      Ignora
                    </Button>
                    <Button
                      size="sm"
                      disabled={set.size === 0 || imputa.isPending}
                      onClick={async () => {
                        await conferma(p, [...set]);
                        await ricarica();
                      }}
                    >
                      Conferma
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Le proposte non scrivono nulla da sole. Confermando, l'importo viene imputato alle rate
            spuntate e il movimento resta uno solo sul conto.
          </p>
          {altaFiducia.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={confermaAlta}
              disabled={imputa.isPending || cerca.isPending}
            >
              Conferma le {altaFiducia.length} ad alta fiducia
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
