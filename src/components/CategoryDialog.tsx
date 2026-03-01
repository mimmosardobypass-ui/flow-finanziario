import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/hooks/useCategoryMutations";
import { Category, useRootCategories } from "@/hooks/useCategories";
import { toast } from "@/hooks/use-toast";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  /** Pre-select a parent when creating a subcategory */
  defaultParentId?: string | null;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  defaultParentId,
}: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [parentId, setParentId] = useState<string>("");

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const rootCategories = useRootCategories();

  const isEditing = !!category;

  // Filter parents by selected type (only root categories of same type)
  const availableParents = rootCategories.filter(
    (c) => c.type === type && (!isEditing || c.id !== category?.id)
  );

  useEffect(() => {
    if (category) {
      setName(category.name);
      setType(category.type);
      setParentId(category.parent_id || "");
    } else {
      setName("");
      setType(defaultParentId ? rootCategories.find(c => c.id === defaultParentId)?.type || "expense" : "expense");
      setParentId(defaultParentId || "");
    }
  }, [category, open, defaultParentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome per la categoria",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: category.id,
          name: name.trim(),
          type,
          parent_id: parentId || null,
        });
        toast({ title: "Categoria aggiornata" });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          type,
          parent_id: parentId || null,
        });
        toast({ title: "Categoria creata" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare la categoria",
        variant: "destructive",
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica Categoria" : parentId ? "Nuova Sottocategoria" : "Nuova Categoria"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Stipendio, Affitto..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => {
                setType(v as "income" | "expense");
                // Reset parent if type changed
                if (parentId) {
                  const parent = rootCategories.find((c) => c.id === parentId);
                  if (parent && parent.type !== v) setParentId("");
                }
              }}
              className="flex gap-4"
              disabled={!!defaultParentId}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="cat-income" />
                <Label htmlFor="cat-income" className="text-success cursor-pointer">
                  Entrata
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expense" id="cat-expense" />
                <Label htmlFor="cat-expense" className="text-destructive cursor-pointer">
                  Uscita
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Categoria padre (opzionale)</Label>
            <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Nessuna (categoria principale)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna (categoria principale)</SelectItem>
                {availableParents.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {isLoading ? "Salvataggio..." : isEditing ? "Salva" : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
