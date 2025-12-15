import { Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Transactions() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Transazioni</h1>
          <p className="text-muted-foreground mt-1">Gestisci le tue entrate e uscite</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova Transazione</span>
        </Button>
      </div>

      {/* Empty State */}
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Receipt className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessuna transazione</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-6">
            Non hai ancora registrato nessuna transazione. Inizia ad aggiungere le tue entrate e uscite per monitorare le tue finanze.
          </p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Aggiungi la prima transazione
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
