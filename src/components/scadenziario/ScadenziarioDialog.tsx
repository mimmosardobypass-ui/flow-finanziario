import { useState, useEffect } from "react";
import { format, addMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCreateScadenziario } from "@/hooks/useScadenziario";
import { toast } from "@/hooks/use-toast";

interface ScadenziarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RataPreview {
  numero_rata: number;
  importo: string;
  data_scadenza: string;
}

export function ScadenziarioDialog({ open, onOpenChange }: ScadenziarioDialogProps) {
  const [numeroContratto, setNumeroContratto] = useState("");
  const [societa, setSocieta] = useState("");
  const [tipo, setTipo] = useState("finanziamento");
  const [importoTotale, setImportoTotale] = useState("");
  const [numeroRate, setNumeroRate] = useState("");
  const [dataPrima, setDataPrima] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [modalita, setModalita] = useState<"automatico" | "manuale">("automatico");
  const [rate, setRate] = useState<RataPreview[]>([]);

  const createMutation = useCreateScadenziario();

  // Generate rate preview when relevant fields change
  useEffect(() => {
    const n = parseInt(numeroRate);
    if (!n || n < 1) {
      setRate([]);
      return;
    }

    const totale = parseFloat(importoTotale);
    const newRate: RataPreview[] = [];

    for (let i = 0; i < n; i++) {
      if (modalita === "automatico" && totale > 0) {
        const importoRata = Math.round((totale / n) * 100) / 100;
        const dataScadenza = addMonths(dataPrima, i);
        newRate.push({
          numero_rata: i + 1,
          importo: String(importoRata),
          data_scadenza: format(dataScadenza, "yyyy-MM-dd"),
        });
      } else {
        newRate.push({
          numero_rata: i + 1,
          importo: "",
          data_scadenza: "",
        });
      }
    }
    setRate(newRate);
  }, [numeroRate, importoTotale, dataPrima, modalita]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setNumeroContratto("");
      setSocieta("");
      setTipo("finanziamento");
      setImportoTotale("");
      setNumeroRate("");
      setDataPrima(new Date());
      setModalita("automatico");
      setRate([]);
    }
  }, [open]);

  const updateRata = (index: number, field: "importo" | "data_scadenza", value: string) => {
    setRate((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totale = parseFloat(importoTotale);
    const nRate = parseInt(numeroRate);

    if (!totale || totale <= 0 || !nRate || nRate < 1) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    try {
      await createMutation.mutateAsync({
        numero_contratto: numeroContratto.trim(),
        societa_finanziaria: societa.trim(),
        tipo,
        importo_totale: totale,
        numero_rate: nRate,
        data_prima_scadenza: format(dataPrima, "yyyy-MM-dd"),
        modalita_importo: modalita,
        rate: rate.map((r) => ({
          numero_rata: r.numero_rata,
          importo: r.importo ? parseFloat(r.importo) : null,
          data_scadenza: r.data_scadenza || null,
        })),
      });
      toast({ title: "Contratto creato" });
      onOpenChange(false);
    } catch {
      toast({ title: "Errore", description: "Impossibile creare il contratto", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Contratto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_contratto">Numero Contratto</Label>
              <Input id="numero_contratto" value={numeroContratto} onChange={(e) => setNumeroContratto(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="societa">Società Finanziaria</Label>
              <Input id="societa" value={societa} onChange={(e) => setSocieta(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="finanziamento">Finanziamento</SelectItem>
                  <SelectItem value="abbonamento">Abbonamento</SelectItem>
                  <SelectItem value="assicurazione">Assicurazione</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="importo_totale">Importo Totale (€)</Label>
              <Input id="importo_totale" type="number" step="0.01" min="0.01" value={importoTotale} onChange={(e) => setImportoTotale(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_rate">Numero Rate</Label>
              <Input id="numero_rate" type="number" min="1" value={numeroRate} onChange={(e) => setNumeroRate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Data Prima Scadenza</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataPrima && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataPrima, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataPrima} onSelect={(d) => { if (d) { setDataPrima(d); setCalendarOpen(false); } }} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Modalità Importo</Label>
            <RadioGroup value={modalita} onValueChange={(v) => setModalita(v as "automatico" | "manuale")} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="automatico" id="auto" />
                <Label htmlFor="auto" className="cursor-pointer">Automatico</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manuale" id="manuale" />
                <Label htmlFor="manuale" className="cursor-pointer">Manuale</Label>
              </div>
            </RadioGroup>
          </div>

          {rate.length > 0 && (
            <div className="space-y-2">
              <Label>Anteprima Rate</Label>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Importo (€)</TableHead>
                      <TableHead>Data Scadenza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rate.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.numero_rata}</TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" value={r.importo} onChange={(e) => updateRata(i, "importo", e.target.value)} className="w-28 h-8" placeholder="0.00" />
                        </TableCell>
                        <TableCell>
                          <Input type="date" value={r.data_scadenza} onChange={(e) => updateRata(i, "data_scadenza", e.target.value)} className="w-36 h-8" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvataggio..." : "Crea Contratto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
