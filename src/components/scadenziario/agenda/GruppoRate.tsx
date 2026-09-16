import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScadenzaAgenda } from "@/hooks/useScadenzeAgenda";
import { fmtEur, fmtData } from "@/components/finanziamenti/utils";
import { sommaRate } from "./calcoli";
import { RigaRata } from "./RigaRata";

interface Props { titolo: string; sottotitolo: string; rate: ScadenzaAgenda[]; colore?: "rosso" | "blu" | "normale"; comprimibile?: boolean; indiceColore: (id: string | null) => number; onApri: (r: ScadenzaAgenda) => void; onCollega: (r: ScadenzaAgenda) => void; onSegnaEnte: (r: ScadenzaAgenda) => void }

export function GruppoRate({ titolo, sottotitolo, rate, colore = "normale", comprimibile, indiceColore, onApri, onCollega, onSegnaEnte }: Props) {
  const [aperto, setAperto] = useState(!comprimibile);
  if (!rate.length) return null;
  const periodo = `${fmtData(rate[0]?.data_addebito)} – ${fmtData(rate[rate.length - 1]?.data_addebito)}`;
  return <Card className="overflow-hidden"><CardHeader className={cn("flex-row items-center justify-between space-y-0 p-4", colore === "rosso" && "bg-destructive/10", colore === "blu" && "bg-primary/10")}>
    <div className="min-w-0"><div className="flex items-center gap-2">{comprimibile && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAperto((v) => !v)} aria-label={aperto ? "Chiudi mese" : "Apri mese"}>{aperto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>}<div><h3 className="font-semibold text-foreground capitalize">{titolo}</h3><p className="text-xs text-muted-foreground">{rate.length} rate · {sottotitolo || periodo}</p></div></div></div>
    <span className="whitespace-nowrap font-bold tabular-nums">{fmtEur(sommaRate(rate))}</span>
  </CardHeader>{aperto && <CardContent className="p-0">{rate.map((r) => <RigaRata key={r.rata_id} rata={r} indiceColore={indiceColore(r.conto_id)} onApri={() => onApri(r)} onCollega={() => onCollega(r)} onSegnaEnte={() => onSegnaEnte(r)} />)}</CardContent>}</Card>;
}