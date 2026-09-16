import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtData, fmtEur } from "@/components/finanziamenti/utils";
import type { CoperturaConto } from "./calcoli";

const etichette = { contanti: "Contanti", da_confermare: "Saldo da confermare", non_coperto: "Non coperto", stretto: "Margine stretto", coperto: "Coperto" } as const;
const classi = { contanti: "border-border text-muted-foreground", da_confermare: "border-border text-muted-foreground", non_coperto: "border-destructive/40 text-destructive", stretto: "border-warning/40 text-warning", coperto: "border-success/40 text-success" } as const;

export function CoperturaConti({ coperture }: { coperture: CoperturaConto[] }) {
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">I conti coprono le rate?</CardTitle><p className="text-xs leading-relaxed text-muted-foreground">Saldo attuale meno gli addebiti dei prossimi 30 giorni, commissioni incluse. Non conta spese e bonifici non programmati.</p></CardHeader>
    <CardContent className="space-y-3">{coperture.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nessuna rata nei prossimi 30 giorni.</p> : coperture.map((c) => {
      const speciale = c.stato === "contanti" || c.stato === "da_confermare"; const ultima = c.righe[c.righe.length - 1]?.data;
      return <section key={c.conto.id} className={cn("rounded-md border p-3", c.stato === "non_coperto" && "border-destructive/40 bg-destructive/5", c.stato === "stretto" && "border-warning/40 bg-warning/5")}>
        <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">{c.conto.nome_conto}</h4><Badge variant="outline" className={classi[c.stato]}>{etichette[c.stato]}</Badge></div>
        {c.stato !== "contanti" && <div className="flex justify-between gap-2 text-xs"><span className="text-muted-foreground">Saldo al {fmtData(c.conto.saldo_riferimento_data ?? format(new Date(), "yyyy-MM-dd"))} ({c.conto.saldo_confermato ? "confermato" : "stimato"})</span><span className="tabular-nums">{fmtEur(c.conto.saldo_attuale)}</span></div>}
        <div className="my-2 space-y-1 border-y border-border py-2">{c.righe.map((r, i) => <div key={`${r.data}-${i}`} className="flex items-start justify-between gap-2 text-xs"><span className="min-w-0 truncate text-muted-foreground">{r.uscita ? fmtData(r.data).slice(0, 5) : `~${fmtData(r.data).slice(0, 5)}`} {r.etichetta}{r.stimata && r.uscita ? " (stimata)" : ""}</span><span className={cn("whitespace-nowrap tabular-nums", r.uscita ? "text-destructive" : "text-success")}>{r.importo > 0 ? "+" : "−"} {fmtEur(Math.abs(r.importo))}</span></div>)}</div>
        {c.stato === "contanti" ? <p className="text-xs text-muted-foreground">Saldo contanti non attendibile.</p> : c.stato === "da_confermare" ? <div className="text-xs text-muted-foreground">Saldo stimato {fmtEur(c.conto.saldo_attuale)} · <Link className="text-primary underline" to="/conti">Imposta il saldo reale</Link></div> : <>
          {c.dataMinimo && Math.abs(c.saldoMinimo - c.saldoFinale) >= 0.01 && <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>Minimo previsto il {fmtData(c.dataMinimo)}</span><span className="tabular-nums">{fmtEur(c.saldoMinimo)}</span></div>}
          <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2 text-sm font-semibold"><span>Saldo previsto al {fmtData(ultima)}</span><span className="tabular-nums">{fmtEur(c.saldoFinale)}</span></div>
        </>}
        {c.stato === "non_coperto" && c.primaDataNegativa && <div className="mt-2 flex gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /><span>Versa almeno {fmtEur(-c.saldoMinimo)} entro il {fmtData(format(addDays(parseISO(c.primaDataNegativa), -1), "yyyy-MM-dd"))} per evitare addebiti respinti.</span></div>}
        {c.stato === "coperto" && <div className="mt-2 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" />Le rate previste sono coperte.</div>}
      </section>;
    })}</CardContent></Card>;
}