import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CategoryWithChildren } from "@/hooks/useCategories";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryWithChildren[];
  placeholder?: string;
  showAllOption?: boolean;
  className?: string;
}

export function CategorySelect({
  value,
  onChange,
  categories,
  placeholder = "Seleziona categoria",
  showAllOption = false,
  className,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Find the selected category name
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <ScrollArea className="max-h-60">
          <div className="py-1">
            {showAllOption && (
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
            {categories.map((parent) => {
              const hasChildren = parent.children.length > 0;
              const isExpanded = expanded.has(parent.id);

              return (
                <div key={parent.id}>
                  <div className="flex items-center">
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
                        hasChildren && "pr-3 font-medium",
                        value === parent.id && "bg-accent text-accent-foreground font-medium",
                      )}
                      onClick={() => select(parent.id)}
                    >
                      {parent.name}
                    </button>
                  </div>

                  {hasChildren && isExpanded && (
                    <div>
                      {parent.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={cn(
                            "w-full text-left pl-10 pr-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                            value === child.id && "bg-accent text-accent-foreground font-medium",
                          )}
                          onClick={() => select(child.id)}
                        >
                          ↳ {child.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {categories.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Nessuna categoria
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
