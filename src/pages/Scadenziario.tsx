import { useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const tipoLabels: Record<string, string> = {
  finanziamento: "Finanziamento",
  abbonamento: "Abbonamento",
  assicurazione: "Assicurazione",
  altro: "Altro",
};

export default function Scadenziario() {
  const { data: contratti = [], isLoading } = useScadenziarioList();
  const deleteMutation = useDeleteScadenziario();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
        <CardHeader>
          <CardTitle>Contratti</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Caricamento...</p>
          ) : contratti.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessun contratto. Clicca "Nuovo Contratto" per iniziare.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>N. Contratto</TableHead>
                    <TableHead>Società</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Importo Totale</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratti.map((c) => {
                    const rate = c.scadenze_rate || [];
                    const pagate = rate.filter((r) => r.stato === "pagata").length;
                    const status = getContractStatus(c);
                    const isExpanded = expandedId === c.id;

                    return (
                      <>
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                          <TableCell>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">{c.numero_contratto}</TableCell>
                          <TableCell>{c.societa_finanziaria}</TableCell>
                          <TableCell>{tipoLabels[c.tipo] || c.tipo}</TableCell>
                          <TableCell className="text-right">€ {c.importo_totale.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{pagate}/{rate.length}</TableCell>
                          <TableCell>
                            <Badge className={status.className} variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(c.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${c.id}-detail`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-4">
                              <RateTable rate={rate} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ScadenziarioDialog open={dialogOpen} onOpenChange={setDialogOpen} />

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
