import { useState } from "react";
import { Landmark, Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContoDialog } from "@/components/ContoDialog";
import { useConti, useToggleContoAttivo, Conto } from "@/hooks/useConti";
import { toast } from "@/hooks/use-toast";

export default function Conti() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConto, setSelectedConto] = useState<Conto | null>(null);
  const { data: conti = [], isLoading } = useConti();
  const toggleMutation = useToggleContoAttivo();

  const handleEdit = (conto: Conto) => {
    setSelectedConto(conto);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedConto(null);
    setDialogOpen(true);
  };

  const handleToggle = async (conto: Conto) => {
    try {
      await toggleMutation.mutateAsync({ id: conto.id, attivo: !conto.attivo });
      toast({ title: conto.attivo ? "Conto disattivato" : "Conto attivato" });
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Conti</h1>
          <p className="text-muted-foreground mt-1">Gestisci i tuoi conti bancari</p>
        </div>
        <Button className="gap-2" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuovo Conto</span>
        </Button>
      </div>

      {conti.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Landmark className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nessun conto</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Crea il tuo primo conto per iniziare a gestire le tue finanze.
            </p>
            <Button className="gap-2" onClick={handleAddNew}>
              <Plus className="h-4 w-4" />
              Crea il primo conto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {conti.map((conto) => (
            <Card key={conto.id} className={`bg-card border-border ${!conto.attivo ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{conto.nome_conto}</h3>
                  </div>
                  <Badge variant={conto.attivo ? "default" : "secondary"}>
                    {conto.attivo ? "Attivo" : "Inattivo"}
                  </Badge>
                </div>
                {conto.banca && (
                  <p className="text-sm text-muted-foreground mb-2">{conto.banca}</p>
                )}
                <p className="text-lg font-bold text-foreground">
                  €{conto.saldo_iniziale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-muted-foreground ml-1">saldo iniziale</span>
                </p>
                <div className="flex gap-1 mt-4">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(conto)}>
                    <Pencil className="h-4 w-4 mr-1" /> Modifica
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(conto)}>
                    {conto.attivo ? (
                      <><ToggleRight className="h-4 w-4 mr-1" /> Disattiva</>
                    ) : (
                      <><ToggleLeft className="h-4 w-4 mr-1" /> Attiva</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContoDialog open={dialogOpen} onOpenChange={setDialogOpen} conto={selectedConto} />
    </div>
  );
}
