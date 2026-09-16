import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScadenzaAgenda } from "@/hooks/useScadenzeAgenda";
import { fmtData, fmtEur } from "@/components/finanziamenti/utils";

export function TabPagate({ rate }: { rate: ScadenzaAgenda[] }) {
  const gruppi = new Map<string, ScadenzaAgenda[]>();
  [...rate].filter((r) => r.stato_agenda === "pagata").sort((a, b) => (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? "")).forEach((r) => { const k = (r.data_pagamento ?? r.data_addebito).slice(0, 7); gruppi.set(k, [...(gruppi.get(k) ?? []), r]); });
  if (!gruppi.size) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nessuna rata pagata negli ultimi 90 giorni.</CardContent></Card>;
  return <div className="space-y-4">{[...gruppi.entries()].map(([mese, elenco]) => <Card key={mese}><CardHeader className="pb-2"><CardTitle className="text-base capitalize">{format(parseISO(`${mese}-01`), "MMMM yyyy", { locale: it })}</CardTitle></CardHeader><CardContent className="divide-y divide-border p-0">{elenco.map((r) => <div key={r.rata_id} className="grid gap-2 p-4 sm:grid-cols-[90px_minmax(0,1fr)_140px_auto] sm:items-center"><span className="text-sm tabular-nums">{fmtData(r.data_pagamento)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{r.nome_visualizzato} <span className="font-normal text-muted-foreground">{r.ente}</span></p><p className="text-xs text-muted-foreground">Rata {r.numero_rata} di {r.numero_rate} · {r.nome_conto ?? "Senza conto"}</p></div><div className="text-sm font-semibold tabular-nums sm:text-right">{fmtEur(r.importo_pagato ?? r.importo)}{r.spese > 0 && <p className="text-xs font-normal text-muted-foreground">incl. {fmtEur(r.spese)} commissioni</p>}</div><Badge variant="outline" className={r.transaction_id ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}>{r.transaction_id ? "Collegata al movimento" : "Pagata secondo l'ente"}</Badge></div>)}</CardContent></Card>)}</div>;
}