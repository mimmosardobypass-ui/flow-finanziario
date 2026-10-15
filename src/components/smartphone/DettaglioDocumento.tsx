import { Fragment, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, Download } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RigaPezzo } from "@/hooks/useSmartphone";
import { dataRientro, giorniTra, totali, type Totali } from "@/lib/smartphone/calcoli";
import { eur, pct, segnoEur } from "@/lib/smartphone/formato";
import { esportaExcel, r2 } from "@/lib/smartphone/esporta";
import { fmtData, oggiISO } from "@/components/finanziamenti/utils";
import type { AnalisiDoc } from "./TabDocumenti";

function Blocco({ titolo, t, nota }: { titolo: string; t: Totali; nota: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-sm font-semibold">{titolo}</div>
      <div className="text-xs text-muted-foreground mb-2">{nota}</div>
      <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
        <dt className="text-muted-foreground">Incasso</dt><dd className="text-right tabular-nums">{eur(t.incasso)}</dd>
        <dt className="text-muted-foreground">Utile</dt><dd className="text-right tabular-nums font-semibold">{eur(t.utile)}</dd>
        <dt className="text-muted-foreground">Ricarico</dt><dd className="text-right tabular-nums">{pct(t.ricarico)}</dd>
        <dt className="text-muted-foreground">Margine</dt><dd className="text-right tabular-nums">{pct(t.margine)}</dd>
      </dl>
    </div>
  );
}

export function DettaglioDocumento({ a, onIndietro, onInserisciPrezzi }: { a: AnalisiDoc; onIndietro: () => void; onInserisciPrezzi: () => void }) {
  const [artAperto, setArtAperto] = useState<string | null>(null);
  const oggi = oggiISO();
  const vend = a.righe.filter((r) => r.vendita);
  const rimasti = a.righe.filter((r) => !r.vendita);
  const senzaPrezzoMag = rimasti.filter((r) => r.previsto === null).length;

  const tPrev = totali(a.righe.filter((r) => r.previsto !== null).map((r) => ({ costo: r.costo, incasso: r.previsto! })));
  const tReal = totali(vend.map((r) => ({ costo: r.costo, incasso: r.venduto! })));
  const tRes = totali(rimasti.filter((r) => r.previsto !== null).map((r) => ({ costo: r.costo, incasso: r.previsto! })));

  const rientro = dataRientro(vend.map((r) => ({ data: r.vendita!.data_vendita, incasso: r.venduto! })), a.costo);
  const vendPrev = vend.filter((r) => r.previsto !== null);
  const A = vendPrev.reduce((s, r) => s + r.previsto! - r.costo, 0);
  const B = vendPrev.reduce((s, r) => s + r.venduto! - r.previsto!, 0);
  const C = tRes.utile;

  const serie = useMemo(() => {
    const per = new Map<string, number>();
    for (const r of vend) per.set(r.vendita!.data_vendita, (per.get(r.vendita!.data_vendita) ?? 0) + r.venduto! - r.costo);
    const out: { data: string; utile: number }[] = [];
    let cum = 0;
    const fine = oggi < a.doc.data_documento ? a.doc.data_documento : oggi;
    for (let d = parseISO(a.doc.data_documento); format(d, "yyyy-MM-dd") <= fine; d = addDays(d, 1)) {
      const k = format(d, "yyyy-MM-dd");
      cum += per.get(k) ?? 0;
      out.push({ data: k, utile: Math.round(cum * 100) / 100 });
      if (out.length > 1500) break;
    }
    return out;
  }, [vend, a.doc.data_documento, oggi]); // eslint-disable-line react-hooks/exhaustive-deps

  const articoli = useMemo(() => {
    const m = new Map<string, RigaPezzo[]>();
    for (const r of a.righe) { const l = m.get(r.articolo.id) ?? []; l.push(r); m.set(r.articolo.id, l); }
    return [...m.values()].map((rs) => {
      const v = rs.filter((r) => r.vendita);
      const conPrev = rs.filter((r) => r.previsto !== null);
      return {
        art: rs[0].articolo, righe: rs, caricati: rs.length, venduti: v.length, rimasti: rs.length - v.length,
        medioVenduto: v.length ? v.reduce((s, r) => s + r.venduto!, 0) / v.length : null,
        utilePrev: conPrev.length ? conPrev.reduce((s, r) => s + r.previsto! - r.costo, 0) : null,
        utileReal: v.reduce((s, r) => s + r.venduto! - r.costo, 0),
        giacenza: giorniTra(a.doc.data_documento, rs.length === v.length ? v.map((r) => r.vendita!.data_vendita).sort().slice(-1)[0] : oggi),
      };
    }).sort((x, y) => x.art.descrizione.localeCompare(y.art.descrizione));
  }, [a, oggi]);

  const esporta = () => esportaExcel(`documento_${a.doc.numero}_${a.doc.data_documento}`, [
    { nome: "Articoli", righe: articoli.map((x) => ({
      Articolo: x.art.descrizione, Marca: x.art.marca, Codice: x.art.codice_articolo, Categoria: x.art.categoria,
      Caricati: x.caricati, Venduti: x.venduti, Rimasti: x.rimasti, "Costo unitario": r2(x.art.costo_unitario),
      "Prezzo previsto": r2(x.art.prezzo_previsto), "Prezzo medio venduto": r2(x.medioVenduto), "Utile previsto": r2(x.utilePrev), "Utile realizzato": r2(x.utileReal), "Giacenza (gg)": x.giacenza,
    })) },
    { nome: "Vendite", righe: vend.map((r) => ({
      Data: fmtData(r.vendita!.data_vendita), Articolo: r.articolo.descrizione, Costo: r2(r.costo), Previsto: r2(r.previsto), Venduto: r2(r.venduto), Utile: r2(r.venduto! - r.costo),
    })) },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onIndietro}><ArrowLeft className="mr-1 h-4 w-4" />Documenti</Button>
        <h2 className="text-lg font-semibold">{a.doc.tipo} n. {a.doc.numero} del {fmtData(a.doc.data_documento)}</h2>
        <span className="text-sm text-muted-foreground">{a.pezzi} pezzi · costo carico {eur(a.costo)} · {giorniTra(a.doc.data_documento, oggi)} giorni</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={esporta}><Download className="mr-1 h-4 w-4" />Esporta Excel</Button>
      </div>

      {senzaPrezzoMag > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          {senzaPrezzoMag} pezzi in magazzino senza prezzo previsto: la previsione è incompleta.
          <Button size="sm" variant="outline" className="ml-auto" onClick={onInserisciPrezzi}>Inserisci i prezzi</Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Blocco titolo="Previsto" t={tPrev} nota="Tutto il carico ai prezzi previsti (venduti: previsto al momento della vendita)" />
        <Blocco titolo="Realizzato" t={tReal} nota={`${vend.length} pezzi venduti, prezzi reali`} />
        <Blocco titolo="Residuo" t={tRes} nota={`${rimasti.length} pezzi da vendere ai prezzi previsti`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Avanzamento</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="flex justify-between"><span>Pezzi venduti</span><span className="tabular-nums">{pct(a.pezzi ? (vend.length / a.pezzi) * 100 : null)}</span></div><Progress className="h-2 mt-1" value={a.pezzi ? (vend.length / a.pezzi) * 100 : 0} /></div>
            <div><div className="flex justify-between"><span>Utile previsto già realizzato</span><span className="tabular-nums">{pct(tPrev.utile > 0 ? (tReal.utile / tPrev.utile) * 100 : null)}</span></div><Progress className="h-2 mt-1" value={tPrev.utile > 0 ? Math.min(100, Math.max(0, (tReal.utile / tPrev.utile) * 100)) : 0} /></div>
            <div className="rounded-md bg-muted/50 p-2">
              {rientro ? <>Capitale rientrato il <b>{fmtData(rientro)}</b></> : <>Mancano <b className="tabular-nums">{eur(a.costo - tReal.incasso)}</b> di incasso per rientrare</>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Da dove viene la differenza</CardTitle><p className="text-xs text-muted-foreground">Solo pezzi con prezzo previsto</p></CardHeader>
          <CardContent>
            <table className="w-full text-[13px]"><tbody>
              <tr><td className="py-0.5">Utile previsto sui pezzi venduti</td><td className="text-right tabular-nums">{eur(A)}</td></tr>
              <tr><td className="py-0.5">Sconti / maggiorazioni sul previsto</td><td className="text-right tabular-nums">{segnoEur(B)}</td></tr>
              <tr className="border-t border-border font-medium"><td className="py-0.5">= Utile realizzato</td><td className="text-right tabular-nums">{eur(A + B)}</td></tr>
              <tr><td className="py-0.5">+ Utile previsto sui pezzi ancora da vendere</td><td className="text-right tabular-nums">{eur(C)}</td></tr>
              <tr className="border-t border-border font-semibold"><td className="py-0.5">= Proiezione a fine documento</td><td className="text-right tabular-nums">{eur(A + B + C)}</td></tr>
              <tr className="text-muted-foreground"><td className="py-0.5">Utile previsto al carico</td><td className="text-right tabular-nums">{eur(A + C)} ({segnoEur(B)})</td></tr>
            </tbody></table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Utile realizzato nel tempo</CardTitle>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-primary" />Utile realizzato cumulato</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-muted-foreground" />Utile previsto ({eur(tPrev.utile)})</span>
          </div>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="data" tickFormatter={(v) => format(parseISO(v), "dd/MM")} minTickGap={30} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} domain={[0, (max: number) => Math.max(max, tPrev.utile) * 1.05]} />
              <Tooltip formatter={(v: number) => [eur(v), "Utile cumulato"]} labelFormatter={(l) => fmtData(String(l))} />
              <ReferenceLine y={tPrev.utile} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 4" />
              <Line type="stepAfter" dataKey="utile" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="tg-wrap">
        <table className="tg min-w-[1000px]">
          <thead><tr>
            <th>Articolo</th><th className="num">Caricati</th><th className="num">Venduti</th><th className="num">Rimasti</th><th className="num">Prezzo previsto</th>
            <th className="num">Prezzo medio venduto</th><th className="num">Utile previsto</th><th className="num">Utile realizzato</th><th className="num">Giacenza</th>
          </tr></thead>
          <tbody>
            {articoli.map((x) => (
              <Fragment key={x.art.id}>
                <tr className="cursor-pointer" onClick={() => setArtAperto(artAperto === x.art.id ? null : x.art.id)}>
                  <td>
                    <button type="button" className="text-left font-medium hover:underline" aria-expanded={artAperto === x.art.id}>{artAperto === x.art.id ? "▾" : "▸"} {x.art.descrizione}</button>
                    <div className="text-xs text-muted-foreground">{x.art.marca} · {x.art.codice_articolo} · {x.art.categoria}</div>
                  </td>
                  <td className="num">{x.caricati}</td><td className="num">{x.venduti}</td><td className="num">{x.rimasti}</td>
                  <td className="num">{x.art.prezzo_previsto === null ? <span className="text-muted-foreground">manca</span> : eur(x.art.prezzo_previsto)}</td>
                  <td className="num">{eur(x.medioVenduto)}</td><td className="num">{eur(x.utilePrev)}</td><td className="num">{eur(x.utileReal)}</td>
                  <td className="num">{x.giacenza} gg</td>
                </tr>
                {artAperto === x.art.id && (
                  <tr><td colSpan={9} className="bg-card">
                    {x.venduti === 0 ? <span className="text-muted-foreground">Nessuna vendita per questo articolo.</span> : (
                      <table className="w-full text-xs"><thead><tr className="text-muted-foreground">
                        <th className="text-left font-normal">Data</th><th className="text-right font-normal">Venduto</th><th className="text-right font-normal">Previsto</th><th className="text-right font-normal">Differenza</th><th className="text-right font-normal">Utile</th>
                      </tr></thead><tbody>
                        {x.righe.filter((r) => r.vendita).sort((p, q) => q.vendita!.data_vendita.localeCompare(p.vendita!.data_vendita)).map((r) => (
                          <tr key={r.pezzo.id}>
                            <td>{fmtData(r.vendita!.data_vendita)}</td><td className="text-right tabular-nums">{eur(r.venduto)}</td><td className="text-right tabular-nums">{eur(r.previsto)}</td>
                            <td className="text-right tabular-nums">{r.previsto === null ? "—" : segnoEur(r.venduto! - r.previsto)}</td><td className="text-right tabular-nums">{eur(r.venduto! - r.costo)}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    )}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot><tr>
            <td>Totale documento</td><td className="num">{a.pezzi}</td><td className="num">{vend.length}</td><td className="num">{rimasti.length}</td><td></td>
            <td className="num">{eur(vend.length ? tReal.incasso / vend.length : null)}</td><td className="num">{eur(tPrev.utile)}</td><td className="num">{eur(tReal.utile)}</td><td></td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}
