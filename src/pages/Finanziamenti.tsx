import { useMemo, useState } from "react";
import { addDays, addMonths, format, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, HandCoins, Plus } from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { fmtEur, fmtData, fmtMeseAnno, iniziali, titoloContratto } from "@/components/finanziamenti/utils";

const COLORI = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

type FiltroStato = "attivi" | "verificare" | "estinti";

function Pill({ testo, classe }: { testo: string; classe: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-normal", classe)}>
      {testo}
    </Badge>
  );
}

function pillsContratto(c: Finanziamento) {
  const pills: { testo: string; classe: string }[] = [];
  if (c.rate_totali === 0)
    pills.push({ testo: "Piano da caricare", classe: "border-border bg-muted text-muted-foreground" });
  if (c.rate_scadute > 0)
    pills.push({
      testo: `${c.rate_scadute} rate scadute senza pagamento`,
      classe: "border-destructive/40 bg-destructive/10 text-destructive",
    });
  if (c.rate_senza_movimento > 0)
    pills.push({
      testo: `${c.rate_senza_movimento} rate senza movimento`,
      classe: "border-warning/40 bg-warning/10 text-warning",
    });
  if (c.differenza_residuo_ente !== null && Math.abs(c.differenza_residuo_ente) >= 0.01)
    pills.push({
      testo: "Residuo diverso dall'ente",
      classe: "border-warning/40 bg-warning/10 text-warning",
    });
  if (!pills.length)
    pills.push({ testo: "In regola", classe: "border-success/40 bg-success/10 text-success" });
  return pills;
}

export default function Finanziamenti() {
  const { data: contratti = [], isLoading } = useFinanziamenti();
  const { data: rateAperte = [] } = useRateFinanziamentiAperte();
  const { data: proposte = [] } = useProposteRate(null, true);

  const [abbina, setAbbina] = useState(false);
  const [nuovo, setNuovo] = useState(false);
  const [aperto, setAperto] = useState<Finanziamento | null>(null);
  const [per, setPer] = useState<string>("tutti");
  const [stato, setStato] = useState<FiltroStato>("attivi");

  const attivi = contratti.filter((c) => c.stato === "attivo");
  const daVerificare = contratti.filter((c) => c.da_verificare);

  const debitoResiduo = attivi.reduce((s, c) => s + c.residuo_da_pagare, 0);
  const rateAlMese = attivi.reduce((s, c) => s + (c.importo_rata ?? 0), 0);

  const oggi = new Date();
  const limite30 = format(addDays(oggi, 30), "yyyy-MM-dd");
  const oggiISO = format(oggi, "yyyy-MM-dd");
  const prossime30 = rateAperte.filter(
    (r) => r.data_scadenza >= oggiISO && r.data_scadenza <= limite30,
  );
  const totale30 = prossime30.reduce((s, r) => s + r.importo, 0);

  const beneficiari = useMemo(
    () => [...new Set(contratti.map((c) => c.beneficiario).filter(Boolean))] as string[],
    [contratti],
  );

  const elenco = useMemo(() => {
    return contratti.filter((c) => {
      if (per !== "tutti" && c.beneficiario !== per) return false;
      if (stato === "attivi") return c.stato === "attivo";
      if (stato === "estinti") return c.stato === "estinto";
      return c.da_verificare;
    });
  }, [contratti, per, stato]);

  // Grafico impegno mensile 24 mesi
  const { datiGrafico, serie } = useMemo(() => {
    const mesi: string[] = [];
    for (let k = 1; k <= 24; k++) mesi.push(format(startOfMonth(addMonths(oggi, k)), "yyyy-MM"));
    const nomi = new Map<string, string>();
    attivi.forEach((c) => nomi.set(c.id, titoloContratto(c.societa_finanziaria, c.nome)));
    const righe = mesi.map((m) => {
      const riga: Record<string, string | number> = {
        mese: format(parseISO(`${m}-01`), "MMM yy", { locale: it }),
      };
      nomi.forEach((nome) => (riga[nome] = 0));
      rateAperte
        .filter((r) => r.data_scadenza.slice(0, 7) === m)
        .forEach((r) => {
          const nome = nomi.get(r.scadenziario_id);
          if (!nome) return;
          riga[nome] = Number(riga[nome] ?? 0) + r.importo;
        });
      return riga;
    });
    const usate = [...nomi.values()].filter((nome) =>
      righe.some((r) => Number(r[nome] ?? 0) > 0),
    );
    return { datiGrafico: righe, serie: usate };
  }, [attivi, rateAperte, oggi]);

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
              {elenco.map((c) => {
                const perc = c.rate_totali ? (c.rate_pagate / c.rate_totali) * 100 : 0;
                const percScadute = c.rate_totali ? (c.rate_scadute / c.rate_totali) * 100 : 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAperto(c)}
                    className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/50 md:flex-row md:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 md:max-w-[28%]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {iniziali(c.societa_finanziaria)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {titoloContratto(c.societa_finanziaria, c.nome)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            c.beneficiario,
                            [c.banca, c.nome_conto].filter(Boolean).join(" "),
                            c.importo_rata ? `${fmtEur(c.importo_rata)}/mese` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 md:max-w-[24%]">
                      {c.rate_totali === 0 ? (
                        <>
                          <div className="h-2 w-full rounded-full border border-dashed border-border" />
                          <p className="mt-1 text-xs text-muted-foreground">Piano da caricare</p>
                        </>
                      ) : (
                        <>
                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="bg-primary" style={{ width: `${perc}%` }} />
                            <div className="bg-destructive/40" style={{ width: `${percScadute}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.rate_pagate}/{c.rate_totali} rate · fine {fmtMeseAnno(c.data_fine)}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="md:w-[14%]">
                      <p className="text-xs text-muted-foreground md:hidden">Residuo</p>
                      <p className="text-sm font-semibold text-foreground">
                        {fmtEur(c.residuo_da_pagare)}
                      </p>
                    </div>

                    <div className="md:w-[16%]">
                      <p className="text-xs text-muted-foreground">Prossima rata</p>
                      {c.prossima_scadenza ? (
                        <p className="text-sm text-foreground">
                          {fmtEur(c.prossima_importo)} ·{" "}
                          <span className={cn(c.prossima_stimata && "italic")}>
                            {fmtData(c.prossima_scadenza)}
                          </span>
                          {c.prossima_stimata && (
                            <span className="ml-1 text-xs text-muted-foreground">stimata</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 md:w-[18%] md:justify-end">
                      {pillsContratto(c).map((p) => (
                        <Pill key={p.testo} testo={p.testo} classe={p.classe} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pannelli */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impegno mensile nei prossimi 24 mesi</CardTitle>
          </CardHeader>
          <CardContent>
            {serie.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nessuna rata futura da mostrare.
              </p>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datiGrafico}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mese" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip
                      formatter={(v: number) => fmtEur(v)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {serie.map((nome, idx) => (
                      <Bar
                        key={nome}
                        dataKey={nome}
                        stackId="rate"
                        fill={COLORI[idx % COLORI.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

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

      <AbbinaRateDialog open={abbina} onOpenChange={setAbbina} />
      <NuovoFinanziamentoDialog open={nuovo} onOpenChange={setNuovo} />
      <FinanziamentoSheet contratto={aperto} onOpenChange={(v) => !v && setAperto(null)} />
    </div>
  );
}
