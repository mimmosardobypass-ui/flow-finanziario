import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props { titolo: string; valore: string; dettaglio: string; allarme?: boolean }

export function Kpi({ titolo, valore, dettaglio, allarme }: Props) {
  return (
    <Card className={cn(allarme && "border-destructive/50 bg-destructive/5")}>
      <CardContent className="p-5">
        <p className={cn("text-sm font-medium text-muted-foreground", allarme && "text-destructive")}>{titolo}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{valore}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dettaglio}</p>
      </CardContent>
    </Card>
  );
}