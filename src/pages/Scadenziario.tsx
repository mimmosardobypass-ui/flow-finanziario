import { useState, useMemo } from "react";
import { format, isBefore, isAfter, startOfDay, addDays, differenceInCalendarDays } from "date-fns";
import { Plus, ChevronDown, ChevronUp, Trash2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScadenziarioList, useDeleteScadenziario, ScadenziarioWithRate } from "@/hooks/useScadenziario";
import { ScadenziarioDialog } from "@/components/scadenziario/ScadenziarioDialog";
import { RateTable } from "@/components/scadenziario/RateTable";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";


function getContractStatus(contract: ScadenziarioWithRate) {
  const rate = contract.scadenze_rate || [];
  const pagate = rate.filter((r) => r.stato === "pagata").length;
  const scadute = rate.filter(
    (r) => r.stato !== "pagata" && r.data_scadenza && isBefore(new Date(r.data_scadenza), startOfDay(new Date()))
  ).length;

  if (pagate === rate.length && rate.length > 0) return { label: "Completato", variant: "default" as const, className: "bg-green-600 hover:bg-green-700" };
  if (scadute > 0) return { label: "Scaduto", variant: "destructive" as const, className: "" };
  return { label: "In corso", variant: "secondary" as const, className: "bg-yellow-500 hover:bg-yellow-600 text-white" };
}

const tipoLabelsMap: Record<string, string> = {
  finanziamento: "Finanziamento",
  abbonamento: "Abbonamento",
  assicurazione: "Assicurazione",
};

function getTipoLabel(tipo: string) {
  return tipoLabelsMap[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

const eur = (n: number) =>
  `€ ${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Scadenziario() {
  const { data: contratti = [], isLoading } = useScadenziarioList();
  const deleteMutation = useDeleteScadenziario();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const prossime = useMemo(() => {
    const oggi = startOfDay(new Date());
    const limite = addDays(oggi, 30);
    let totale = 0;
    let stimato = 0;
    let count = 0;
    for (const c of contratti) {
      for (const r of c.scadenze_rate || []) {
        if (r.stato === "pagata" || !r.data_scadenza) continue;
        const d = new Date(r.data_scadenza);
        if (isBefore(d, oggi) || isAfter(d, limite)) continue;
        count++;
        totale += Number(r.importo || 0);
        if (r.stimata) stimato += Number(r.importo || 0);
      }
    }
    return { totale, stimato, count };
  }, [contratti]);


  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast({ title: "Contratto eliminato" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Errore", description: "Impossibile eliminare il contratto", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scadenziario</h1>
          <p className="text-muted-foreground">Gestisci i tuoi contratti e le relative rate</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Contratto
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">In scadenza nei prossimi 30 giorni</div>
          <div className="text-2xl font-bold">{eur(prossime.totale)}</div>
          <div className="text-xs text-muted-foreground">
            {prossime.count} rate
            {prossime.stimato > 0 && <> · di cui {eur(prossime.stimato)} stimati</>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="in_corso">
        <TabsList>
          <TabsTrigger value="in_corso">In corso ({inCorso.length})</TabsTrigger>
          <TabsTrigger value="cronologia">Cronologia ({cronologia.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="in_corso" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Piani in corso</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Caricamento...</p>
              ) : inCorso.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nessun piano in corso.</p>
              ) : (
                renderTable(inCorso, "in_corso")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cronologia" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Piani completati</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Caricamento...</p>
              ) : cronologia.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nessun piano completato.</p>
              ) : (
                renderTable(cronologia, "cronologia")
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      <ScadenziarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={(id) => setExpandedId(id)} />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Elimina Contratto"
        description="Sei sicuro di voler eliminare questo contratto? Tutte le rate associate verranno eliminate. Questa azione non può essere annullata."
      />
    </div>
  );
}
