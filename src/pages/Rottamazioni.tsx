import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, FileWarning } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFinanziamenti, useProposteRate, type Finanziamento } from "@/hooks/useFinanziamenti";
import { AbbinaRateDialog } from "@/components/finanziamenti/AbbinaRateDialog";
import { FinanziamentoSheet } from "@/components/finanziamenti/FinanziamentoSheet";
import { RigaContratto } from "@/components/finanziamenti/RigaContratto";
import { fmtEur, fmtData } from "@/components/finanziamenti/utils";

export default function Rottamazioni() {
  const { data: contratti = [], isLoading } = useFinanziamenti();
  const { data: tutteProposte = [] } = useProposteRate(null, true);
  const [abbina, setAbbina] = useState(false);
  const [aperto, setAperto] = useState<Finanziamento | null>(null);

  const rottamazioni = useMemo(
    () => contratti.filter((c) => c.gruppo === "rottamazione"),
    [contratti],
  );
  const ids = useMemo(() => new Set(rottamazioni.map((c) => c.id)), [rottamazioni]);
  const proposte = useMemo(
    () => tutteProposte.filter((p) => ids.has(p.scadenziario_id)),
    [tutteProposte, ids],
  );

  const oggiISO = format(new Date(), "yyyy-MM-dd");
  const attive = rottamazioni.filter((c) => c.stato === "attivo");
  const residuo = attive.reduce((s, c) => s + c.residuo_da_pagare, 0);
  const scadute = attive.reduce((s, c) => s + c.rate_scadute, 0);
  const prossima = attive
    .filter((c) => c.prossima_scadenza && c.prossima_scadenza >= oggiISO)
    .sort((a, b) => (a.prossima_scadenza ?? "").localeCompare(b.prossima_scadenza ?? ""))[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rottamazioni</h1>
          <p className="text-sm text-muted-foreground">
            Definizioni agevolate con Agenzia delle Entrate-Riscossione
          </p>
        </div>
        <Button variant="outline" onClick={() => setAbbina(true)} className="gap-2">
          Abbina rate
          {proposte.length > 0 && (
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              {proposte.length}
            </Badge>
          )}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Debito residuo</p>
            <p className="text-2xl font-bold text-foreground">{fmtEur(residuo)}</p>
            <p className="text-xs text-muted-foreground">su {attive.length} piani attivi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Prossima rata</p>
            <p className="text-2xl font-bold text-foreground">
              {prossima ? fmtEur(prossima.prossima_importo) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {prossima ? fmtData(prossima.prossima_scadenza) : "nessuna scadenza"}
            </p>
          </CardContent>
        </Card>
        <Card className={cn(scadute > 0 && "border-destructive/50 bg-destructive/5")}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rate scadute non pagate</p>
            <p className={cn("text-2xl font-bold", scadute > 0 ? "text-destructive" : "text-foreground")}>
              {scadute}
            </p>
            <p className="text-xs text-muted-foreground">
              {scadute > 0 ? "attenzione alla decadenza" : "tutto in regola"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Rottamazione-quinquies: la tolleranza di 5 giorni vale solo per l'ultima rata. Due rate
          non pagate, anche non consecutive, fanno decadere dal beneficio. Paga entro la scadenza.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rottamazioni.length === 0 ? (
            <div className="p-10 text-center">
              <FileWarning className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nessuna rottamazione da mostrare.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rottamazioni.map((c) => (
                <RigaContratto key={c.id} c={c} onApri={setAperto} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AbbinaRateDialog open={abbina} onOpenChange={setAbbina} gruppo="rottamazione" />
      <FinanziamentoSheet contratto={aperto} onOpenChange={(v) => !v && setAperto(null)} />
    </div>
  );
}
