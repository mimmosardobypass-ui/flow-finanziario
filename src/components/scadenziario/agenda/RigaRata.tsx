import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ScadenzaAgenda } from "@/hooks/useScadenzeAgenda";
import { fmtEur } from "@/components/finanziamenti/utils";
import { classeColoreConto, isStimata } from "./calcoli";

interface Props { rata: ScadenzaAgenda; indiceColore: number; onApri: () => void; onCollega: () => void; onSegnaEnte: () => void }

export function RigaRata({ rata, indiceColore, onApri, onCollega, onSegnaEnte }: Props) {
  const d = parseISO(rata.data_addebito); const stimata = isStimata(rata); const scaduta = rata.stato_agenda === "scaduta";
  const meta = [rata.piano_stimato ? `Rata ${rata.numero_rata}` : `Rata ${rata.numero_rata} di ${rata.numero_rate}`, rata.beneficiario ? `per ${rata.beneficiario}` : null, rata.riferimento,
    rata.data_addebito !== rata.data_scadenza ? `scade ${format(parseISO(rata.data_scadenza), "EEE dd/MM", { locale: it })}, addebito ${format(d, "EEE dd/MM", { locale: it })}` : null].filter(Boolean).join(" · ");
  return (
    <div className="group relative grid grid-cols-[54px_minmax(0,1fr)_auto] gap-3 border-b border-border p-3 last:border-b-0 sm:grid-cols-[54px_minmax(0,1fr)_110px_116px_auto_36px] sm:items-center">
      <button type="button" onClick={onApri} className={cn("row-span-2 flex h-[54px] w-[54px] flex-col items-center justify-center rounded-md text-center", scaduta ? "bg-destructive/10 text-destructive" : stimata ? "border border-dashed border-warning bg-transparent text-foreground" : "bg-primary/10 text-primary") }>
        <span className="text-lg font-bold leading-none tabular-nums">{format(d, "d")}</span><span className="mt-0.5 text-[10px] font-semibold uppercase">{format(d, "MMM", { locale: it })}</span><span className="text-[9px]">{format(d, "EEE", { locale: it })}</span>
      </button>
      <button type="button" onClick={onApri} className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold text-foreground">{rata.nome_visualizzato} <span className="font-normal text-muted-foreground">{rata.ente}</span></p>
        <p className="truncate text-xs text-muted-foreground" title={meta}>{meta}</p>
      </button>
      <div className="col-start-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:col-start-auto">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", classeColoreConto(indiceColore))} /><span className="truncate">{rata.nome_conto ?? "Senza conto"}</span>
      </div>
      <div className="text-right sm:col-start-auto">
        <p className="whitespace-nowrap text-sm font-bold tabular-nums text-foreground">{fmtEur(rata.importo)}</p>
        {rata.spese_previste > 0 && <p className="whitespace-nowrap text-xs text-muted-foreground">+ {fmtEur(rata.spese_previste)} comm.</p>}
      </div>
      <div className="col-start-2 sm:col-start-auto">
        {scaduta ? <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">Scaduta da {rata.giorni_ritardo} gg</Badge> : stimata ? <Badge variant="outline" className="border-dashed border-warning text-warning">Data stimata</Badge> : <Badge variant="secondary">Da pagare</Badge>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="absolute right-2 top-2 h-8 w-8 sm:static" aria-label="Azioni sulla rata"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuItem onClick={onApri}>Apri contratto</DropdownMenuItem>{rata.tipo === "finanziamento" && <DropdownMenuItem onClick={onCollega}>Collega un movimento…</DropdownMenuItem>}{rata.tipo === "finanziamento" && scaduta && <DropdownMenuItem onClick={onSegnaEnte}>Segna pagata secondo l'ente</DropdownMenuItem>}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}