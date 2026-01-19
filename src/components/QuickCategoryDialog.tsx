import { useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCategory } from "@/hooks/useCategoryMutations";
import { toast } from "@/hooks/use-toast";

interface QuickCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  onCategoryCreated: (categoryId: string) => void;
}

export function QuickCategoryDialog({
  open,
  onOpenChange,
  type,
  onCategoryCreated,
}: QuickCategoryDialogProps) {
  const [name, setName] = useState("");
  const createMutation = useCreateCategory();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        title: "Errore",
        description: "Inserisci un nome per la categoria",
        variant: "destructive",
      });
      return;
    }

    try {
      const newCategory = await createMutation.mutateAsync({
        name: trimmedName,
        type,
      });
      
      // Attendere esplicitamente che la lista categorie sia aggiornata
      await queryClient.refetchQueries({ queryKey: ["categories"] });
      
      toast({ title: "Categoria creata" });
      onCategoryCreated(newCategory.id);
      setName("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile creare la categoria",
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle>
            Nuova categoria {type === "income" ? "entrata" : "uscita"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="categoryName">Nome categoria</Label>
            <Input
              id="categoryName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Spese mediche, Bonus..."
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              {createMutation.isPending ? "Creazione..." : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
