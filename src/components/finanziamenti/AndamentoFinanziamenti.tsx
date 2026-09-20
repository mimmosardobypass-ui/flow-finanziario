import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, differenceInCalendarMonths, format, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Rectangle,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Finanziamento, RataAperta } from "@/hooks/useFinanziamenti";
import { fmtEur, fmtNum, titoloContratto } from "@/components/finanziamenti/utils";

const COLORI = [
  "hsl(var(--finance-1))",
  "hsl(var(--finance-2))",
  "hsl(var(--finance-3))",
  "hsl(var(--finance-4))",
  "hsl(var(--finance-5))",
  "hsl(var(--finance-6))",
  "hsl(var(--finance-7))",
  "hsl(var(--finance-8))",
];
const COLORE_ALTRI = "hsl(var(--finance-other))";

type Periodo = 12 | 24 | 36 | "tutto";
type Vista = "grafico" | "tabella";

interface Serie {
  key: string;
  label: string;
  colore: string;
  rata: number | null;
}

interface RigaMese extends Record<string, string | number | boolean> {
  mese: string;
  etichetta: string;
  meseEsteso: string;
  totale: number;
  scaduto: number;
  cambia: boolean;
}

interface Props {
  contratti: Finanziamento[];
  contrattiFiltrati: Finanziamento[];
  rate: RataAperta[];
  oggi: string;
}

function usaLarghezza<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [larghezza, setLarghezza] = useState(0);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const osservatore = new ResizeObserver(([voce]) => setLarghezza(voce.contentRect.width));
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, []);

  return { ref, larghezza };
}

function meseISO(data: Date) {
  return format(data, "yyyy-MM");
}

function importoAsse(valore: number) {
  return valore >= 1000 ? `${Math.round(valore / 100) / 10}k` : String(Math.round(valore));
}

function TooltipAndamento({
  active,
  payload,
  serie,
}: {
  active?: boolean;
  payload?: Array<{ payload: RigaMese }>;
  serie: Serie[];
}) {
  const riga = payload?.[0]?.payload;
  if (!active || !riga) return null;
  return (
    <div className="min-w-[260px] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="mb-2 text-sm font-semibold capitalize">{riga.meseEsteso}</p>
      <div className="space-y-1.5">
        {serie.map((s) => {
          const valore = Number(riga[s.key] ?? 0);
          if (!valore) return null;
          return (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.colore }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="whitespace-nowrap font-medium tabular-nums">{fmtEur(valore)}</span>
            </div>
          );
        })}
      </div>
      {riga.scaduto > 0 && (
        <div className="mt-2 border-t border-border pt-2 text-xs font-medium text-warning">
          di cui {fmtEur(riga.scaduto)} già scaduti
        </div>
      )}
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-bold">
        <span>Totale del mese</span>
        <span className="tabular-nums">{fmtEur(riga.totale)}</span>
      </div>
    </div>
  );
}

export function AndamentoFinanziamenti({ contratti, contrattiFiltrati, rate, oggi }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>(24);
  const [vista, setVista] = useState<Vista>("grafico");
  const [mostraImporti, setMostraImporti] = useState(true);
  const [anno, setAnno] = useState<string>("tutti");
  const { ref: graficoRef, larghezza } = usaLarghezza<HTMLDivElement>();

  const base = useMemo(() => startOfMonth(parseISO(oggi)), [oggi]);
  const graduatoria = useMemo(
    () => [...contratti].sort((a, b) => b.residuo_da_pagare - a.residuo_da_pagare || a.id.localeCompare(b.id)),
    [contratti],
  );
  const indiceColore = useMemo(
    () => new Map(graduatoria.map((contratto, indice) => [contratto.id, indice])),
    [graduatoria],
  );
  const idsFiltrati = useMemo(() => new Set(contrattiFiltrati.map((c) => c.id)), [contrattiFiltrati]);
  const rateFiltrate = useMemo(
    () => rate.filter((rata) => idsFiltrati.has(rata.scadenziario_id)),
    [idsFiltrati, rate],
  );

  const serie = useMemo(() => {
    const prime: Serie[] = contrattiFiltrati
      .filter((c) => (indiceColore.get(c.id) ?? 99) < COLORI.length)
      .sort((a, b) => (indiceColore.get(a.id) ?? 99) - (indiceColore.get(b.id) ?? 99))
      .map((c) => ({
        key: `c_${c.id}`,
        label: `${titoloContratto(c.societa_finanziaria, c.nome)}${c.origine_piano === "stimato" ? " (stimato)" : ""}`,
        colore: COLORI[indiceColore.get(c.id) ?? 0],
        rata: c.importo_rata,
      }));
    const haAltri = contrattiFiltrati.some((c) => (indiceColore.get(c.id) ?? 99) >= COLORI.length);
    if (haAltri) prime.push({ key: "altri", label: "Altri", colore: COLORE_ALTRI, rata: null });
    return prime;
  }, [contrattiFiltrati, indiceColore]);

  const ultimaData = useMemo(() => {
    const date = rateFiltrate.map((r) => r.data_scadenza).filter(Boolean).sort();
    return date.length > 0 ? date[date.length - 1] : meseISO(base);
  }, [base, rateFiltrate]);
  const mesiTutto = Math.max(1, differenceInCalendarMonths(startOfMonth(parseISO(ultimaData)), base) + 1);
  const numeroMesi = periodo === "tutto" ? mesiTutto : periodo;

  const datiCompleti = useMemo(() => {
    const righe: RigaMese[] = Array.from({ length: mesiTutto }, (_, indice) => {
      const data = addMonths(base, indice);
      const riga: RigaMese = {
        mese: meseISO(data),
        etichetta: format(data, "MMM yy", { locale: it }),
        meseEsteso: format(data, "MMMM yyyy", { locale: it }),
        totale: 0,
        scaduto: 0,
        cambia: false,
      };
      serie.forEach((s) => (riga[s.key] = 0));
      return riga;
    });
    const contrattiPerId = new Map(contrattiFiltrati.map((c) => [c.id, c]));
    rateFiltrate.forEach((rata) => {
      const dataMese = rata.data_scadenza.slice(0, 7);
      const destinazione = dataMese < righe[0].mese ? righe[0] : righe.find((r) => r.mese === dataMese);
      if (!destinazione) return;
      const posizione = indiceColore.get(rata.scadenziario_id) ?? 99;
      const key = posizione < COLORI.length ? `c_${rata.scadenziario_id}` : "altri";
      if (!(key in destinazione) || !contrattiPerId.has(rata.scadenziario_id)) return;
      destinazione[key] = Number(destinazione[key] ?? 0) + rata.importo;
      destinazione.totale += rata.importo;
      if (rata.data_scadenza < oggi) destinazione.scaduto += rata.importo;
    });
    righe.forEach((riga, indice) => {
      if (indice === 0) return;
      riga.cambia = serie.some((s) => Number(riga[s.key] ?? 0) !== Number(righe[indice - 1][s.key] ?? 0));
    });
    return righe;
  }, [base, contrattiFiltrati, indiceColore, mesiTutto, oggi, rateFiltrate, serie]);

  const dati = useMemo(() => datiCompleti.slice(0, numeroMesi), [datiCompleti, numeroMesi]);

  const totale = dati.reduce((somma, riga) => somma + riga.totale, 0);
  const troppoDenso = larghezza > 0 && (larghezza - 90) / numeroMesi < 36;
  const periodoTesto = `da ${format(base, "MMMM yyyy", { locale: it })} a ${format(addMonths(base, numeroMesi - 1), "MMMM yyyy", { locale: it })}`;
  const anni = useMemo(() => [...new Set(datiCompleti.map((r) => r.mese.slice(0, 4)))], [datiCompleti]);
  const annoScelto = anno === "tutti" || anni.includes(anno) ? anno : anni[0] ?? "tutti";
  const righeAnno = annoScelto === "tutti" ? datiCompleti : datiCompleti.filter((r) => r.mese.startsWith(annoScelto));
  const intervalloX = numeroMesi > 30 ? 2 : numeroMesi > 18 ? 1 : 0;
  const massimo = Math.max(0, ...dati.map((r) => r.totale));
  const passoY = Math.max(50, Math.ceil(maximoPasso(massimo) / 50) * 50);

  useEffect(() => {
    if (troppoDenso) setMostraImporti(false);
  }, [troppoDenso]);

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Andamento</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtEur(totale)} nel periodo · media {fmtEur(totale / numeroMesi)} al mese · {numeroMesi} mesi
            </p>
          </div>
          <div className="flex rounded-md border border-border p-0.5">
            <Button size="sm" variant={vista === "grafico" ? "secondary" : "ghost"} onClick={() => setVista("grafico")}>
              <BarChart3 className="h-4 w-4" /> Grafico
            </Button>
            <Button size="sm" variant={vista === "tabella" ? "secondary" : "ghost"} onClick={() => setVista("tabella")}>
              <Table2 className="h-4 w-4" /> Tabella
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {vista === "grafico" ? (
          <>
            <div className="flex flex-col gap-3 border-y border-border py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-muted-foreground">Periodo</span>
                {([12, 24, 36, "tutto"] as const).map((valore) => (
                  <Button
                    key={valore}
                    size="sm"
                    variant={periodo === valore ? "default" : "outline"}
                    onClick={() => setPeriodo(valore)}
                  >
                    {valore === "tutto" ? "Tutto" : `${valore} mesi`}
                  </Button>
                ))}
              </div>
              <span className="text-sm capitalize text-muted-foreground">{periodoTesto}</span>
            </div>
            {serie.length === 0 || !dati.some((r) => r.totale > 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nessuna rata da mostrare per i filtri scelti.</p>
            ) : (
              <>
                <div className="flex justify-end">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={mostraImporti && !troppoDenso}
                      disabled={troppoDenso}
                      onCheckedChange={setMostraImporti}
                      aria-label="Importo su ogni mese"
                    />
                    {troppoDenso ? "Troppi mesi per gli importi su ogni colonna" : "Importo su ogni mese"}
                  </label>
                </div>
                <div ref={graficoRef} className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dati} margin={{ top: 34, right: 12, left: 0, bottom: 4 }} barCategoryGap="20%">
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="etichetta" interval={intervalloX} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <YAxis domain={[0, Math.max(passoY, Math.ceil(massimo / passoY) * passoY)]} ticks={Array.from({ length: 5 }, (_, i) => i * passoY)} tickFormatter={importoAsse} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={48} />
                      <RTooltip content={<TooltipAndamento serie={serie} />} cursor={{ fill: "hsl(var(--muted) / 0.45)" }} />
                      {serie.map((s) => (
                        <Bar
                          key={s.key}
                          dataKey={s.key}
                          stackId="rate"
                          fill={s.colore}
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                          maxBarSize={24}
                          shape={(props) => {
                            const riga = props.payload as RigaMese;
                            const ultima = [...serie].reverse().find((voce) => Number(riga[voce.key] ?? 0) > 0)?.key;
                            return <Rectangle {...props} radius={ultima === s.key ? [4, 4, 0, 0] : 0} />;
                          }}
                        >
                          <LabelList
                            dataKey="totale"
                            position="top"
                            content={(props) => {
                              const riga = dati[Number(props.index)];
                              const ultima = riga ? [...serie].reverse().find((voce) => Number(riga[voce.key] ?? 0) > 0)?.key : null;
                              if (!riga || ultima !== s.key || (!riga.cambia && !mostraImporti)) return null;
                              return (
                                <text x={props.x} y={Number(props.y) - 7} textAnchor="middle" className={cn("fill-foreground text-[10px]", riga.cambia && "font-bold")}>
                                  {fmtNum(riga.totale)}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3">
                  {serie.map((s) => (
                    <div key={s.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.colore }} />
                      <span>{s.label}</span>
                      {s.rata !== null && <span className="font-medium tabular-nums text-foreground">{fmtEur(s.rata)}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <VistaTabella dati={datiCompleti} serie={serie} anni={anni} anno={annoScelto} onAnnoChange={setAnno} righe={righeAnno} />
        )}
      </CardContent>
    </Card>
  );
}

function maximoPasso(massimo: number) {
  return massimo <= 0 ? 50 : massimo / 4;
}

function VistaTabella({
  dati,
  serie,
  anni,
  anno,
  onAnnoChange,
  righe,
}: {
  dati: RigaMese[];
  serie: Serie[];
  anni: string[];
  anno: string;
  onAnnoChange: (anno: string) => void;
  righe: RigaMese[];
}) {
  const tutti = anno === "tutti";
  const totaliSerie = (insieme: RigaMese[], key: string) => insieme.reduce((somma, r) => somma + Number(r[key] ?? 0), 0);
  const anniAggregati = anni.map((a) => ({ anno: a, righe: dati.filter((r) => r.mese.startsWith(a)) }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {anni.map((a) => <Button key={a} size="sm" variant={anno === a ? "default" : "outline"} onClick={() => onAnnoChange(a)}>{a}</Button>)}
        <Button size="sm" variant={tutti ? "default" : "outline"} onClick={() => onAnnoChange("tutti")}>Tutti gli anni</Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>{tutti ? "Anno" : "Mese"}</TableHead>
              {serie.map((s) => <TableHead key={s.key} className="min-w-[140px] text-right">{s.label}</TableHead>)}
              <TableHead className="min-w-[130px] text-right">Totale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tutti ? anniAggregati : righe).map((voce) => {
              const insieme = "righe" in voce ? voce.righe : [voce];
              const chiave = "anno" in voce ? voce.anno : voce.mese;
              const cambia = "cambia" in voce && voce.cambia;
              return (
                <TableRow key={chiave} className={cn(cambia && "bg-primary/5")}>
                  <TableCell className="font-medium capitalize">
                    {"anno" in voce ? `${voce.anno} (${voce.righe.length} mesi)` : voce.meseEsteso}
                  </TableCell>
                  {serie.map((s) => {
                    const valore = totaliSerie(insieme, s.key);
                    return <TableCell key={s.key} className="text-right tabular-nums">{valore ? fmtEur(valore) : <span className="text-muted-foreground">—</span>}</TableCell>;
                  })}
                  <TableCell className={cn("text-right font-medium tabular-nums", cambia && "font-bold")}>{fmtEur(insieme.reduce((somma, r) => somma + r.totale, 0))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>{tutti ? "Totale complessivo" : `Totale ${anno}`}</TableCell>
              {serie.map((s) => <TableCell key={s.key} className="text-right tabular-nums">{fmtEur(totaliSerie(righe, s.key))}</TableCell>)}
              <TableCell className="text-right font-bold tabular-nums">{fmtEur(righe.reduce((somma, r) => somma + r.totale, 0))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}