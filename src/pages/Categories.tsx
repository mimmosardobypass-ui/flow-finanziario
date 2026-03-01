import { useState } from "react";
import { Plus, Pencil, Trash2, Tag, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCategories, Category, useCategoryTree, CategoryWithChildren } from "@/hooks/useCategories";
import { useDeleteCategory } from "@/hooks/useCategoryMutations";
import { CategoryDialog } from "@/components/CategoryDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Categories() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const { data: categories, isLoading } = useCategories();
  const categoryTree = useCategoryTree();
  const deleteMutation = useDeleteCategory();

  const incomeTree = categoryTree.filter((c) => c.type === "income");
  const expenseTree = categoryTree.filter((c) => c.type === "expense");

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
    } catch (error) {
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
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const CategoryItem = ({ category }: { category: Category }) => (
    <li className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{category.name}</span>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => handleDelete(category.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );

  const ParentCategoryItem = ({ category }: { category: CategoryWithChildren }) => {
    const hasChildren = category.children.length > 0;

    if (!hasChildren) {
      return (
        <li className="space-y-1">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{category.name}</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary hover:text-primary"
                onClick={() => handleAddSubcategory(category.id)}
                title="Aggiungi sottocategoria"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(category.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </li>
      );
    }

    return (
      <li>
        <Collapsible defaultOpen>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <CollapsibleTrigger className="flex items-center gap-2 group cursor-pointer">
              <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=closed]:hidden" />
              <ChevronRight className="h-4 w-4 text-muted-foreground group-data-[state=open]:hidden" />
              <span className="font-medium">{category.name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {category.children.length}
              </Badge>
            </CollapsibleTrigger>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary hover:text-primary"
                onClick={() => handleAddSubcategory(category.id)}
                title="Aggiungi sottocategoria"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(category.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CollapsibleContent>
            <ul className="pl-6 mt-1 space-y-1">
              {category.children.map((child) => (
                <CategoryItem key={child.id} category={child} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    );
  };

  const CategoryList = ({
    title,
    icon: Icon,
    items,
    type,
  }: {
    title: string;
    icon: typeof TrendingUp;
    items: CategoryWithChildren[];
    type: "income" | "expense";
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon
            className={`h-5 w-5 ${type === "income" ? "text-success" : "text-destructive"}`}
          />
          {title}
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nessuna categoria {type === "income" ? "di entrata" : "di uscita"}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((category) => (
              <ParentCategoryItem key={category.id} category={category} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Categorie</h1>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nuova Categoria
        </Button>
      </div>

      {categories?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessuna categoria</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crea le tue prime categorie per organizzare le transazioni
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Crea la prima categoria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <CategoryList title="Entrate" icon={TrendingUp} items={incomeTree} type="income" />
          <CategoryList title="Uscite" icon={TrendingDown} items={expenseTree} type="expense" />
        </div>
      )}

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
