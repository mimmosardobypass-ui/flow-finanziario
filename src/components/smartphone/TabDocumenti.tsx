import { useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { righePezzi, type RigaPezzo, type SpDati, type SpDocumento } from "@/hooks/useSmartphone";
import { totali, giorniTra } from "@/lib/smartphone/calcoli";
import { eur, pct } from "@/lib/smartphone/formato";
import { fmtData, oggiISO } from "@/components/finanziamenti/utils";
import { Segmentato } from "./ui";
import { DettaglioDocumento } from "./DettaglioDocumento";

export interface AnalisiDoc {
  doc: SpDocumento; righe: RigaPezzo[]; pezzi: number; venduti: number; costo: number;
  utilePrevisto: number; costoPrev: number; incassoPrev: number; prezziIncompleti: boolean;
  utileReal: number; costoVend: number; incassoReal: number; valoreMag: number; aperto: boolean;
}

export function analizza(doc: SpDocumento, righe: RigaPezzo[]): AnalisiDoc {
  const vend = righe.filter((r) => r.vendita);
  const conPrev = righe.filter((r) => r.previsto !== null);
  const costoPrev = conPrev.reduce((s, r) => s + r.costo, 0);
  const incassoPrev = conPrev.reduce((s, r) => s + r.previsto!, 0);
  const costoVend = vend.reduce((s, r) => s + r.costo, 0);
  const incassoReal = vend.reduce((s, r) => s + r.venduto!, 0);
  return {
    doc, righe, pezzi: righe.length, venduti: vend.length, costo: righe.reduce((s, r) => s + r.costo, 0),
    utilePrevisto: incassoPrev - costoPrev, costoPrev, incassoPrev, prezziIncompleti: conPrev.length < righe.length,
    utileReal: incassoReal - costoVend, costoVend, incassoReal,
    valoreMag: righe.filter((r) => !r.vendita).reduce((s, r) => s + r.costo, 0),
    aperto: vend.length < righe.length,
  };
}

type Filtro = "tutti" | "aperti" | "chiusi";

export function TabDocumenti({ dati, onInserisciPrezzi }: { dati: SpDati; onInserisciPrezzi: (docId: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [aperto, setAperto] = useState<string | null>(null);
  const oggi = oggiISO();
  const analisi = useMemo(() => {
    const per = new Map<string, RigaPezzo[]>();
    for (const r of righePezzi(dati)) { const l = per.get(r.documento.id) ?? []; l.push(r); per.set(r.documento.id, l); }
    return dati.documenti.map((d) => analizza(d, per.get(d.id) ?? []))
      .sort((a, b) => b.doc.data_documento.localeCompare(a.doc.data_documento) || b.doc.numero.localeCompare(a.doc.numero));
  }, [dati]);

  const sel = analisi.find((a) => a.doc.id === aperto);
  if (sel) return <DettaglioDocumento a={sel} onIndietro={() => setAperto(null)} onInserisciPrezzi={() => onInserisciPrezzi(sel.doc.id)} />;

  const righe = analisi.filter((a) => filtro === "tutti" || (filtro === "aperti" ? a.aperto : !a.aperto));
  const tp = totali(righe.map((a) => ({ costo: a.costoPrev, incasso: a.incassoPrev })));
  const tr = totali(righe.map((a) => ({ costo: a.costoVend, incasso: a.incassoReal })));
  const pezzi = righe.reduce((s, a) => s + a.pezzi, 0);
  const venduti = righe.reduce((s, a) => s + a.venduti, 0);

  return (
    <div className="space-y-4">
      <Segmentato<Filtro> valore={filtro} onChange={setFiltro} opzioni={[{ v: "tutti", l: "Tutti" }, { v: "aperti", l: "Aperti" }, { v: "chiusi", l: "Chiusi" }]} />
      <div className="tg-wrap">
        <table className="tg min-w-[1000px]">
          <thead><tr>
            <th>Documento</th><th className="num">Pezzi</th><th className="num">Costo carico</th><th className="num">Utile previsto</th>
            <th className="num">Utile realizzato</th><th>Avanzamento</th><th className="num">Giorni dal carico</th><th>Stato</th>
          </tr></thead>
          <tbody>
            {righe.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nessun documento</td></tr>}
            {righe.map((a) => (
              <tr key={a.doc.id} className="cursor-pointer" onClick={() => setAperto(a.doc.id)}>
                <td>
                  <button type="button" className="text-left font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setAperto(a.doc.id); }}>
                    {a.doc.tipo} n. {a.doc.numero}
                  </button>
                  <div className="text-xs text-muted-foreground">{fmtData(a.doc.data_documento)}</div>
                </td>
                <td className="num">{a.pezzi}</td>
                <td className="num">{eur(a.costo)}</td>
                <td className="num">{eur(a.utilePrevisto)}{a.prezziIncompleti && <div className="text-xs text-muted-foreground">prezzi incompleti</div>}</td>
                <td className="num">{eur(a.utileReal)}</td>
                <td className="min-w-[160px]">
                  <Progress value={a.pezzi ? (a.venduti / a.pezzi) * 100 : 0} className="h-2" />
                  <div className="mt-0.5 text-xs text-muted-foreground">{a.venduti} su {a.pezzi} venduti</div>
                </td>
                <td className="num">{giorniTra(a.doc.data_documento, oggi)}</td>
                <td>{a.aperto ? <Badge variant="outline">Aperto</Badge> : <Badge variant="secondary">Chiuso</Badge>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td>Totale {righe.length} documenti</td>
            <td className="num">{pezzi}</td>
            <td className="num">{eur(righe.reduce((s, a) => s + a.costo, 0))}</td>
            <td className="num">{eur(tp.utile)}<div className="text-xs font-normal">ric. {pct(tp.ricarico)} · marg. {pct(tp.margine)}</div></td>
            <td className="num">{eur(tr.utile)}<div className="text-xs font-normal">ric. {pct(tr.ricarico)} · marg. {pct(tr.margine)}</div></td>
            <td>{venduti} su {pezzi} venduti ({pct(pezzi ? (venduti / pezzi) * 100 : null)})</td>
            <td colSpan={2}>In magazzino: {eur(righe.reduce((s, a) => s + a.valoreMag, 0))}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}
