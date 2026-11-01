import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, HandCoins, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useFinanziamenti,
  useProposteRate,
  useRateFinanziamentiAperte,
  type Finanziamento,
} from "@/hooks/useFinanziamenti";
import { AbbinaRateDialog } from "@/components/finanziamenti/AbbinaRateDialog";
import { NuovoFinanziamentoDialog } from "@/components/finanziamenti/NuovoFinanziamentoDialog";
import { FinanziamentoSheet } from "@/components/finanziamenti/FinanziamentoSheet";
import { AndamentoFinanziamenti } from "@/components/finanziamenti/AndamentoFinanziamenti";
import { fmtEur, titoloContratto } from "@/components/finanziamenti/utils";
import { RigaContratto } from "@/components/finanziamenti/RigaContratto";

type FiltroStato = "attivi" | "verificare" | "estinti";

export default function Finanziamenti() {
  const { data: contratti = [], isLoading } = useFinanziamenti();
  const { data: rateAperte = [] } = useRateFinanziamentiAperte();
  const { data: tutteProposte = [] } = useProposteRate(null, true);

  const [abbina, setAbbina] = useState(false);
  const [nuovo, setNuovo] = useState(false);
  const [aperto, setAperto] = useState<Finanziamento | null>(null);
  const [per, setPer] = useState<string>("tutti");
  const [stato, setStato] = useState<FiltroStato>("attivi");

  // L'elenco principale e tutti i riepiloghi considerano solo i finanziamenti;
  // le rottamazioni hanno una pagina dedicata.
  const finanziamenti = useMemo(
    () => contratti.filter((c) => c.gruppo !== "rottamazione"),
    [contratti],
  );
  const attivi = finanziamenti.filter((c) => c.stato === "attivo");
  const daVerificare = finanziamenti.filter((c) => c.da_verificare);

  const debitoResiduo = attivi.reduce((s, c) => s + c.residuo_da_pagare, 0);
  const rateAlMese = attivi.reduce((s, c) => s + (c.importo_rata ?? 0), 0);

  const oggi = new Date();
  const limite30 = format(addDays(oggi, 30), "yyyy-MM-dd");
  const oggiISO = format(oggi, "yyyy-MM-dd");
  const idsFinanziamenti = useMemo(() => new Set(finanziamenti.map((c) => c.id)), [finanziamenti]);
  const rateAperteFinanziamenti = useMemo(
    () => rateAperte.filter((r) => idsFinanziamenti.has(r.scadenziario_id)),
    [rateAperte, idsFinanziamenti],
  );
  const proposte = useMemo(
    () => tutteProposte.filter((p) => idsFinanziamenti.has(p.scadenziario_id)),
    [tutteProposte, idsFinanziamenti],
  );
  const prossime30 = rateAperteFinanziamenti.filter(
    (r) => r.data_scadenza >= oggiISO && r.data_scadenza <= limite30,
  );
  const totale30 = prossime30.reduce((s, r) => s + r.importo, 0);

  const beneficiari = useMemo(
    () => [...new Set(finanziamenti.map((c) => c.beneficiario).filter(Boolean))] as string[],
    [finanziamenti],
  );

  const elenco = useMemo(() => {
    return finanziamenti.filter((c) => {
      if (per !== "tutti" && c.beneficiario !== per) return false;
      if (stato === "attivi") return c.stato === "attivo";
      if (stato === "estinti") return c.stato === "estinto";
      return c.da_verificare;
    });
  }, [finanziamenti, per, stato]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanziamenti</h1>
          <p className="text-sm text-muted-foreground">
            Contratti in corso, rate pagate e scadenze, su tutti i conti.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAbbina(true)} className="gap-2">
            Abbina rate
            {proposte.length > 0 && (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                {proposte.length}
              </Badge>
            )}
          </Button>
          <Button onClick={() => setNuovo(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuovo finanziamento
          </Button>
        </div>
      </div>

      {/* Riepilogo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Debito residuo</p>
            <p className="text-2xl font-bold text-foreground">{fmtEur(debitoResiduo)}</p>
            <p className="text-xs text-muted-foreground">su {attivi.length} contratti</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rate al mese</p>
            <p className="text-2xl font-bold text-foreground">{fmtEur(rateAlMese)}</p>
            <p className="text-xs text-muted-foreground">contratti attivi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Prossimi 30 giorni</p>
            <p className="text-2xl font-bold text-foreground">{fmtEur(totale30)}</p>
            <p className="text-xs text-muted-foreground">{prossime30.length} rate</p>
          </CardContent>
        </Card>
        <Card className={cn(daVerificare.length > 0 && "border-warning/50 bg-warning/5")}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Da verificare</p>
            <p
              className={cn(
                "text-2xl font-bold",
                daVerificare.length > 0 ? "text-warning" : "text-foreground",
              )}
            >
              {daVerificare.length}
            </p>
            {daVerificare.length > 0 ? (
              <button
                type="button"
                onClick={() => setStato("verificare")}
                className="text-xs text-primary underline"
              >
                Mostra solo questi
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">tutto in regola</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Per</span>
          <div className="flex rounded-lg border border-border p-0.5">
            {["tutti", ...beneficiari].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setPer(b)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  per === b ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {b === "tutti" ? "Tutti" : b}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Stato</span>
          <div className="flex rounded-lg border border-border p-0.5">
            {(
              [
                ["attivi", "Attivi"],
                ["verificare", "Da verificare"],
                ["estinti", "Estinti"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStato(k)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  stato === k ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AndamentoFinanziamenti
        contratti={finanziamenti}
        contrattiFiltrati={elenco}
        rate={rateAperteFinanziamenti}
        oggi={oggiISO}
      />

      {/* Elenco contratti */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : elenco.length === 0 ? (
            <div className="p-10 text-center">
              <HandCoins className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nessun finanziamento da mostrare.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {elenco.map((c) => (
                <RigaContratto key={c.id} c={c} onApri={setAperto} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pannelli */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In scadenza nei prossimi 30 giorni</CardTitle>
          </CardHeader>
          <CardContent>
            {prossime30.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nessuna rata nei prossimi 30 giorni.
              </p>
            ) : (
              <div className="space-y-2">
                {prossime30.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                  >
                    <div className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-muted">
                      <span className="text-sm font-semibold leading-none text-foreground">
                        {format(parseISO(r.data_scadenza), "d")}
                      </span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {format(parseISO(r.data_scadenza), "MMM", { locale: it })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {titoloContratto(r.ente, r.nome)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[r.banca, r.conto_nome].filter(Boolean).join(" ") || "—"}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                      {fmtEur(r.importo)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm text-muted-foreground">Totale</span>
                  <span className="text-sm font-bold text-foreground">{fmtEur(totale30)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {daVerificare.length > 0 && stato !== "verificare" && (
        <div className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4" />
          {daVerificare.length} contratti hanno qualcosa da controllare.
        </div>
      )}

      <AbbinaRateDialog open={abbina} onOpenChange={setAbbina} gruppo="finanziamento" />
      <NuovoFinanziamentoDialog open={nuovo} onOpenChange={setNuovo} />
      <FinanziamentoSheet contratto={aperto} onOpenChange={(v) => !v && setAperto(null)} />
    </div>
  );
}
