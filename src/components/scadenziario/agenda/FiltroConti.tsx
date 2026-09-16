import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ContoFiltro { id: string; nome: string; indiceColore: number }
interface Props { conti: ContoFiltro[]; valore: string; onChange: (id: string) => void }

export function FiltroConti({ conti, valore, onChange }: Props) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5" aria-label="Filtra per conto">
      <span className="mr-1 text-xs text-muted-foreground">Conto</span>
      <Button size="sm" variant={valore === "tutti" ? "default" : "outline"} onClick={() => onChange("tutti")} className="h-8">Tutti</Button>
      {conti.map((c) => (
        <Button key={c.id} size="sm" variant={valore === c.id ? "default" : "outline"} onClick={() => onChange(c.id)} className="h-8 gap-1.5">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", `bg-account-${Math.min(c.indiceColore + 1, 5)}`)} />
          {c.nome}
        </Button>
      ))}
    </div>
  );
}