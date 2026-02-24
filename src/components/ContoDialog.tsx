import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCreateConto, useUpdateConto, Conto } from "@/hooks/useConti";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conto?: Conto | null;
}

export function ContoDialog({ open, onOpenChange, conto }: Props) {
  const [nomeConto, setNomeConto] = useState("");
  const [banca, setBanca] = useState("");
  const [saldoIniziale, setSaldoIniziale] = useState("0");
  const [attivo, setAttivo] = useState(true);

  const createMutation = useCreateConto();
  const updateMutation = useUpdateConto();
  const isEditing = !!conto;

  useEffect(() => {
    if (conto) {
      setNomeConto(conto.nome_conto);
      setBanca(conto.banca || "");
      setSaldoIniziale(String(conto.saldo_iniziale));
      setAttivo(conto.attivo);
    } else {
      setNomeConto("");
      setBanca("");
      setSaldoIniziale("0");
      setAttivo(true);
    }
  }, [conto, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeConto.trim()) return;

    const saldo = parseFloat(saldoIniziale) || 0;

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: conto.id,
          nome_conto: nomeConto.trim(),
          banca: banca.trim() || undefined,
          saldo_iniziale: saldo,
          attivo,
        });
        toast({ title: "Conto aggiornato" });
      } else {
        await createMutation.mutateAsync({
          nome_conto: nomeConto.trim(),
          banca: banca.trim() || undefined,
          saldo_iniziale: saldo,
        });
        toast({ title: "Conto creato" });
      }
      onOpenChange(false);
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare il conto", variant: "destructive" });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica Conto" : "Nuovo Conto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_conto">Nome conto *</Label>
            <Input
              id="nome_conto"
              value={nomeConto}
              onChange={(e) => setNomeConto(e.target.value)}
              placeholder="Es. Conto Corrente"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banca">Banca</Label>
            <Input
              id="banca"
              value={banca}
              onChange={(e) => setBanca(e.target.value)}
              placeholder="Es. Intesa Sanpaolo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saldo_iniziale">Saldo iniziale (€)</Label>
            <Input
              id="saldo_iniziale"
              type="number"
              step="0.01"
              value={saldoIniziale}
              onChange={(e) => setSaldoIniziale(e.target.value)}
            />
          </div>
          {isEditing && (
            <div className="flex items-center justify-between">
              <Label htmlFor="attivo">Conto attivo</Label>
              <Switch id="attivo" checked={attivo} onCheckedChange={setAttivo} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvataggio..." : isEditing ? "Salva" : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
