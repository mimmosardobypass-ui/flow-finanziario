import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, Category, useCategoryTree, CategoryWithChildren } from "@/hooks/useCategories";
import { useDeleteCategory } from "@/hooks/useCategoryMutations";
import { CategoryDialog } from "@/components/CategoryDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";

function stringToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 65%)`;
}

export default function Categories() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: categories, isLoading } = useCategories();
  const categoryTree = useCategoryTree();
  const deleteMutation = useDeleteCategory();

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return categoryTree;
    const q = searchQuery.toLowerCase();
    return categoryTree
      .map((parent) => {
        const childrenMatch = parent.children.filter((c) =>
          c.name.toLowerCase().includes(q)
        );
        const parentMatches = parent.name.toLowerCase().includes(q);
        if (parentMatches) return parent;
        if (childrenMatch.length > 0) return { ...parent, children: childrenMatch };
        return null;
      })
      .filter(Boolean) as CategoryWithChildren[];
  }, [categoryTree, searchQuery]);

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setDefaultParentId(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setCategoryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteMutation.mutateAsync(categoryToDelete);
      toast({ title: "Categoria eliminata" });
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la categoria. Potrebbe essere in uso.",
        variant: "destructive",
      });
    }
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleAddNew = () => {
    setSelectedCategory(null);
    setDefaultParentId(null);
    setDialogOpen(true);
  };

  const handleAddSubcategory = (parentId: string) => {
    setSelectedCategory(null);
    setDefaultParentId(parentId);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Categorie</h1>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nuova Categoria
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca o crea una categoria"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredTree.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {categories?.length === 0
                ? "Nessuna categoria. Creane una nuova!"
                : "Nessun risultato per la ricerca."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filteredTree.map((parent) => (
                <li key={parent.id}>
                  {/* Parent row */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="inline-block w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: stringToColor(parent.name) }}
                      />
                      <span className="font-medium truncate">{parent.name}</span>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(parent)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary"
                        onClick={() => handleAddSubcategory(parent.id)}
                        title="Aggiungi sottocategoria"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(parent.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Children */}
                  {parent.children.length > 0 && (
                    <ul>
                      {parent.children.map((child) => (
                        <li
                          key={child.id}
                          className="flex items-center justify-between pl-10 pr-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <span className="text-sm text-muted-foreground truncate">
                            / {child.name}
                          </span>
                          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(child)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(child.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={selectedCategory}
        defaultParentId={defaultParentId}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Elimina Categoria"
        description="Sei sicuro di voler eliminare questa categoria? Le transazioni associate non verranno eliminate, ma perderanno il riferimento alla categoria."
      />
    </div>
  );
}
