import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, ChevronsUpDown, Search, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryDialog } from "@/components/CategoryDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useDeleteCategory } from "@/hooks/useCategoryMutations";
import { toast } from "@/hooks/use-toast";
import type { CategoryWithChildren, Category } from "@/hooks/useCategories";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryWithChildren[];
  placeholder?: string;
  showAllOption?: boolean;
  className?: string;
  allowManage?: boolean;
  /** Called when a new category is created, with the new category id */
  onCategoryCreated?: (id: string) => void;
}

export function CategorySelect({
  value,
  onChange,
  categories,
  placeholder = "Seleziona categoria",
  showAllOption = false,
  className,
  allowManage = false,
  onCategoryCreated,
}: CategorySelectProps) {
  const allParentIds = useMemo(
    () => new Set(categories.filter(c => c.children.length > 0).map(c => c.id)),
    [categories]
  );
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(allParentIds);
  const [searchQuery, setSearchQuery] = useState("");

  // Management state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [addSubcategoryParentId, setAddSubcategoryParentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCategory, setDeleteCategory] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useDeleteCategory();

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setExpanded(new Set(allParentIds));
      setSearchQuery("");
    }
    setOpen(isOpen);
  };

  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categories;
    return categories
      .map((parent) => {
        if (parent.name.toLowerCase().includes(q)) return parent;
        const matchedChildren = parent.children.filter((c) =>
          c.name.toLowerCase().includes(q)
        );
        if (matchedChildren.length > 0)
          return { ...parent, children: matchedChildren };
        return null;
      })
      .filter(Boolean) as CategoryWithChildren[];
  }, [categories, searchQuery]);

  const selectedLabel = useMemo(() => {
    if (showAllOption && value === "all") return "Tutte le categorie";
    for (const parent of categories) {
      if (parent.id === value) return parent.name;
      for (const child of parent.children) {
        if (child.id === value) return `${parent.name} › ${child.name}`;
      }
    }
    return "";
  }, [value, categories, showAllOption]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  // Management handlers
  const handleEdit = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCategory(cat);
    setAddSubcategoryParentId(null);
    setCategoryDialogOpen(true);
  };

  const handleAddSub = (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCategory(null);
    setAddSubcategoryParentId(parentId);
    setCategoryDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditCategory(null);
    setAddSubcategoryParentId(null);
    setCategoryDialogOpen(true);
  };

  const handleDelete = (cat: { id: string; name: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteCategory(cat);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCategory) return;
    try {
      await deleteMutation.mutateAsync(deleteCategory.id);
      toast({ title: "Categoria eliminata" });
      if (value === deleteCategory.id) onChange("");
      setDeleteDialogOpen(false);
      setDeleteCategory(null);
    } catch {
      toast({ title: "Errore", description: "Impossibile eliminare la categoria", variant: "destructive" });
    }
  };

  const actionIcons = (cat: Category, isParent: boolean) => {
    if (!allowManage) return null;
    return (
      <span className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 ml-auto">
        <button
          type="button"
          className="p-1 rounded hover:bg-muted transition-colors"
          onClick={(e) => handleEdit(cat, e)}
          title="Modifica"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {isParent && (
          <button
            type="button"
            className="p-1 rounded hover:bg-muted transition-colors"
            onClick={(e) => handleAddSub(cat.id, e)}
            title="Aggiungi sottocategoria"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          className="p-1 rounded hover:bg-destructive/10 transition-colors"
          onClick={(e) => handleDelete({ id: cat.id, name: cat.name }, e)}
          title="Elimina"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </span>
    );
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">
              {selectedLabel || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={allowManage ? "Cerca o gestisci..." : "Cerca categoria..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            {allowManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-2 shrink-0"
                onClick={handleAddNew}
                title="Nuova categoria"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-60">
            <div className="py-1">
              {showAllOption && !searchQuery && (
                <button
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    value === "all" && "bg-accent text-accent-foreground font-medium",
                  )}
                  onClick={() => select("all")}
                >
                  Tutte le categorie
                </button>
              )}
              {filteredCategories.map((parent) => {
                const hasChildren = parent.children.length > 0;
                const isExpanded = expanded.has(parent.id);

                return (
                  <div key={parent.id}>
                    <div className="flex items-center group/row">
                      {hasChildren && (
                        <button
                          type="button"
                          className="flex items-center justify-center w-7 h-8 hover:bg-accent/60 transition-colors shrink-0"
                          onClick={(e) => toggleExpand(parent.id, e)}
                          tabIndex={-1}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className={cn(
                          "flex-1 text-left py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                          !hasChildren && "px-3",
                          hasChildren && "pr-1 font-medium",
                          value === parent.id && "bg-accent text-accent-foreground font-medium",
                        )}
                        onClick={() => select(parent.id)}
                      >
                        {parent.name}
                      </button>
                      {actionIcons(parent as Category, true)}
                    </div>

                    {hasChildren && isExpanded && (
                      <div>
                        {parent.children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center group/row"
                          >
                            <button
                              type="button"
                              className={cn(
                                "flex-1 text-left pl-10 pr-1 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                                value === child.id && "bg-accent text-accent-foreground font-medium",
                              )}
                              onClick={() => select(child.id)}
                            >
                              ↳ {child.name}
                            </button>
                            {actionIcons(child as Category, false)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredCategories.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {searchQuery ? "Nessun risultato" : "Nessuna categoria"}
                </p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Management dialogs rendered outside popover */}
      {allowManage && (
        <>
          <CategoryDialog
            open={categoryDialogOpen}
            onOpenChange={setCategoryDialogOpen}
            category={editCategory}
            defaultParentId={addSubcategoryParentId}
          />
          <DeleteConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={confirmDelete}
            isLoading={deleteMutation.isPending}
            title={`Eliminare "${deleteCategory?.name}"?`}
            description="La categoria verrà eliminata definitivamente. Le transazioni associate non verranno rimosse."
          />
        </>
      )}
    </>
  );
}
