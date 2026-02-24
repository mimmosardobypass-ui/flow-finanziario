import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Link } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useCategories } from "@/hooks/useCategories";
import {
  useCreateTransaction,
  useUpdateTransaction,
  TransactionWithCategory,
} from "@/hooks/useTransactions";
import { useContiAttivi } from "@/hooks/useConti";
import { useUnpaidRateByContract } from "@/hooks/useScadenziario";
import { toast } from "@/hooks/use-toast";
import { QuickCategoryDialog } from "@/components/QuickCategoryDialog";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionWithCategory | null;
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
}: TransactionDialogProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [contoId, setContoId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [linkRata, setLinkRata] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedRataId, setSelectedRataId] = useState("");

  const { data: categories = [] } = useCategories();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const { data: contiAttivi = [] } = useContiAttivi();
  const { data: contractsWithUnpaid = [] } = useUnpaidRateByContract();

  const isEditing = !!transaction;
  const filteredCategories = categories.filter((c) => c.type === type);

  const selectedContract = contractsWithUnpaid.find((c) => c.id === selectedContractId);
  const availableRate = selectedContract?.scadenze_rate || [];

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || "");
      setAmount(String(transaction.amount));
      setType(transaction.type as "income" | "expense");
      setCategoryId(transaction.category_id || "");
      setContoId(transaction.conto_id || "");
      setDate(new Date(transaction.date));
      setLinkRata(false);
      setSelectedContractId("");
      setSelectedRataId("");
    } else {
      setDescription("");
      setAmount("");
      setType("expense");
      setCategoryId("");
      setContoId(contiAttivi.length === 1 ? contiAttivi[0].id : "");
      setDate(new Date());
      setLinkRata(false);
      setSelectedContractId("");
      setSelectedRataId("");
    }
  }, [transaction, open]);

  // Reset category when type changes
  useEffect(() => {
    if (!isEditing) {
      setCategoryId("");
    }
  }, [type, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Errore",
        description: "Inserisci un importo valido",
        variant: "destructive",
      });
      return;
    }

    const input = {
      description: description.trim(),
      amount: parsedAmount,
      type,
      date: format(date, "yyyy-MM-dd"),
      category_id: categoryId || null,
      conto_id: contoId,
      rata_id: linkRata && selectedRataId ? selectedRataId : null,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ ...input, id: transaction.id });
        toast({ title: "Transazione aggiornata" });
      } else {
        await createMutation.mutateAsync(input);
        toast({ title: "Transazione aggiunta" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare la transazione",
        variant: "destructive",
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica Transazione" : "Nuova Transazione"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as "income" | "expense")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="income" />
                <Label htmlFor="income" className="text-success cursor-pointer">
                  Entrata
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expense" id="expense" />
                <Label htmlFor="expense" className="text-destructive cursor-pointer">
                  Uscita
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Es. Stipendio, Affitto..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Importo (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={() => setQuickCategoryOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nuova
              </Button>
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={filteredCategories.length === 0 ? "Nessuna categoria" : "Seleziona categoria"} />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Conto *</Label>
            <Select value={contoId} onValueChange={setContoId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona conto" />
              </SelectTrigger>
              <SelectContent>
                {contiAttivi.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_conto}{c.banca ? ` (${c.banca})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isEditing && contractsWithUnpaid.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="link-rata"
                  checked={linkRata}
                  onCheckedChange={(v) => {
                    setLinkRata(!!v);
                    if (!v) { setSelectedContractId(""); setSelectedRataId(""); }
                  }}
                />
                <Label htmlFor="link-rata" className="cursor-pointer flex items-center gap-1">
                  <Link className="h-3.5 w-3.5" />
                  Collega a scadenza
                </Label>
              </div>
              {linkRata && (
                <div className="space-y-2 pl-6">
                  <Select value={selectedContractId} onValueChange={(v) => { setSelectedContractId(v); setSelectedRataId(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona contratto" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractsWithUnpaid.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero_contratto} — {c.societa_finanziaria}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedContractId && availableRate.length > 0 && (
                    <Select value={selectedRataId} onValueChange={setSelectedRataId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona rata" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRate.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            Rata {r.numero_rata}{r.importo ? ` — € ${r.importo.toFixed(2)}` : ""}{r.data_scadenza ? ` (${format(new Date(r.data_scadenza), "dd/MM/yyyy")})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Data</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy") : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvataggio..." : isEditing ? "Salva" : "Aggiungi"}
            </Button>
          </div>
        </form>

        <QuickCategoryDialog
          open={quickCategoryOpen}
          onOpenChange={setQuickCategoryOpen}
          type={type}
          onCategoryCreated={(newId) => setCategoryId(newId)}
        />
      </DialogContent>
    </Dialog>
  );
}
