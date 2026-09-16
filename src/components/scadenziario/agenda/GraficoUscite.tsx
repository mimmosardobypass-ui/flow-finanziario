import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtEur } from "@/components/finanziamenti/utils";
import type { MeseUscite } from "./calcoli";
import type { ContoFiltro } from "./FiltroConti";

interface Props { mesi: MeseUscite[]; conti: ContoFiltro[] }

export function GraficoUscite({ mesi, conti }: Props) {
  const [selezionato, setSelezionato] = useState(0);
  const massimo = Math.max(...mesi.map((m) => m.totale), 1); const mese = mesi[selezionato] ?? mesi[0];
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Uscite per rate, prossimi 6 mesi</CardTitle><p className="text-xs text-muted-foreground">Per conto di addebito</p></CardHeader>
    <CardContent className="space-y-4"><div className="relative flex h-[185px] items-end gap-2 border-b border-border px-1 pt-7">
      {mesi.map((m, i) => <button key={m.chiave} type="button" onMouseEnter={() => setSelezionato(i)} onFocus={() => setSelezionato(i)} onClick={() => setSelezionato(i)} className={cn("group flex h-full min-w-0 flex-1 flex-col items-center justify-end transition-opacity", i !== selezionato && "opacity-45")} aria-label={`${m.esteso}, totale ${fmtEur(m.totale)}`}>
        <span className="mb-1 text-[10px] font-medium tabular-nums text-muted-foreground">{Math.round(m.totale)}</span>
        <span className="flex w-full flex-col-reverse justify-start gap-0.5" style={{ height: `${Math.max((m.totale / massimo) * 140, m.totale ? 4 : 0)}px` }}>
          {conti.map((c) => { const valore = m.perConto[c.id] ?? 0; if (!valore) return null; return <span key={c.id} className={cn("block w-full first:rounded-b-sm last:rounded-t", `bg-account-${Math.min(c.indiceColore + 1, 5)}`)} style={{ height: `${(valore / Math.max(m.totale, 1)) * 100}%` }} />; })}
        </span><span className="mt-1 text-[11px] capitalize text-muted-foreground">{m.breve}</span>
      </button>)}
    </div>{mese && <div className="rounded-md bg-muted/50 p-3"><div className="flex justify-between gap-2 text-sm font-semibold capitalize"><span>{mese.esteso}</span><span className="tabular-nums">{fmtEur(mese.totale)}</span></div><div className="mt-2 space-y-1">{conti.filter((c) => (mese.perConto[c.id] ?? 0) > 0).map((c) => <div key={c.id} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", `bg-account-${Math.min(c.indiceColore + 1, 5)}`)} /><span className="truncate text-muted-foreground">{c.nome}</span></span><span className="tabular-nums">{fmtEur(mese.perConto[c.id])}</span></div>)}</div></div>}
    </CardContent></Card>;
}