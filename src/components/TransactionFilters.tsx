import { useState, useEffect, useMemo } from "react";
import { Search, Filter, X, Calendar, DollarSign, Tag, Landmark, Link2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { useCategories, Category, useCategoryTree } from "@/hooks/useCategories";
import { useContiAttivi } from "@/hooks/useConti";
import { TransactionFilters as FiltersType } from "@/hooks/useFilteredTransactions";

interface Props {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
}

export function TransactionFilters({ filters, onFiltersChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.searchText || "");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [amountPopoverOpen, setAmountPopoverOpen] = useState(false);
  const [amountMinInput, setAmountMinInput] = useState(filters.amountMin?.toString() || "");
  const [amountMaxInput, setAmountMaxInput] = useState(filters.amountMax?.toString() || "");

  const { data: categories = [] } = useCategories();
  const categoryTree = useCategoryTree();
  const { data: contiAttivi = [] } = useContiAttivi();

  // Filtra l'albero categorie in base al tipo selezionato
  const filteredTree = useMemo(() => {
    if (!filters.type || filters.type === "all") {
      return categoryTree;
    }
    return categoryTree.filter((cat) => cat.type === filters.type);
  }, [categoryTree, filters.type]);

  // Debounce per la ricerca
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, searchText: searchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleTypeChange = (value: string) => {
    const newType = value as "all" | "income" | "expense";

    // Reset categoria se non è più valida per il nuovo tipo
    let newCategoryId = filters.categoryId;
    if (newCategoryId && newType !== "all") {
      const currentCategory = categories.find((c) => c.id === newCategoryId);
      if (currentCategory && currentCategory.type !== newType) {
        newCategoryId = undefined; // Reset a "Tutte le categorie"
      }
    }

    onFiltersChange({
      ...filters,
      type: newType,
      categoryId: newCategoryId,
    });
  };

  const handleCategoryChange = (value: string) => {
    onFiltersChange({
      ...filters,
      categoryId: value === "all" ? undefined : value,
    });
  };

  const handleDateFromSelect = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateFrom: date ? format(date, "yyyy-MM-dd") : undefined,
    });
  };

  const handleDateToSelect = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateTo: date ? format(date, "yyyy-MM-dd") : undefined,
    });
  };

  const applyAmountFilter = () => {
    onFiltersChange({
      ...filters,
      amountMin: amountMinInput ? parseFloat(amountMinInput) : undefined,
      amountMax: amountMaxInput ? parseFloat(amountMaxInput) : undefined,
    });
    setAmountPopoverOpen(false);
  };

  const clearFilters = () => {
    setSearchInput("");
    setAmountMinInput("");
    setAmountMaxInput("");
    onFiltersChange({
      searchText: "",
      categoryId: undefined,
      contoId: undefined,
      type: "all",
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: undefined,
      amountMax: undefined,
      reconciliation: "all",
    });
  };

  const activeFiltersCount = [
    filters.searchText,
    filters.categoryId,
    filters.contoId,
    filters.type && filters.type !== "all",
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
    filters.reconciliation && filters.reconciliation !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div className="space-y-4 print:hidden">
      {/* Barra ricerca principale */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per descrizione o categoria..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Tipo */}
        <Select value={filters.type || "all"} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[130px] bg-secondary border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="income">Entrate</SelectItem>
            <SelectItem value="expense">Uscite</SelectItem>
          </SelectContent>
        </Select>

        {/* Conto */}
        <Select
          value={filters.contoId || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, contoId: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[160px] bg-secondary border-border">
            <Landmark className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Conto" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">Tutti i conti</SelectItem>
            {contiAttivi.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome_conto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Categoria */}
        <Select
          value={filters.categoryId || "all"}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-[160px] bg-secondary border-border">
            <Tag className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {filteredTree.map((parent) =>
              parent.children.length > 0 ? (
                <div key={parent.id}>
                  <SelectItem value={parent.id} className="font-semibold">
                    {parent.name}
                  </SelectItem>
                  {parent.children.map((child) => (
                    <SelectItem key={child.id} value={child.id} className="pl-8">
                      ↳ {child.name}
                    </SelectItem>
                  ))}
                </div>
              ) : (
                <SelectItem key={parent.id} value={parent.id}>
                  {parent.name}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* Data */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`gap-2 bg-secondary border-border ${
                filters.dateFrom || filters.dateTo
                  ? "border-primary text-primary"
                  : ""
              }`}
            >
              <Calendar className="h-4 w-4" />
              {filters.dateFrom || filters.dateTo ? (
                <span className="text-sm">
                  {filters.dateFrom
                    ? format(new Date(filters.dateFrom), "dd/MM", { locale: it })
                    : "..."}
                  {" - "}
                  {filters.dateTo
                    ? format(new Date(filters.dateTo), "dd/MM", { locale: it })
                    : "..."}
                </span>
              ) : (
                "Data"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 bg-popover border-border" align="start">
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Da</Label>
                <CalendarComponent
                  mode="single"
                  selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                  onSelect={handleDateFromSelect}
                  locale={it}
                  className="rounded-md border border-border"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">A</Label>
                <CalendarComponent
                  mode="single"
                  selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                  onSelect={handleDateToSelect}
                  locale={it}
                  className="rounded-md border border-border"
                />
              </div>
              {(filters.dateFrom || filters.dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onFiltersChange({
                      ...filters,
                      dateFrom: undefined,
                      dateTo: undefined,
                    });
                  }}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Pulisci date
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Importo */}
        <Popover open={amountPopoverOpen} onOpenChange={setAmountPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`gap-2 bg-secondary border-border ${
                filters.amountMin || filters.amountMax
                  ? "border-primary text-primary"
                  : ""
              }`}
            >
              <DollarSign className="h-4 w-4" />
              {filters.amountMin || filters.amountMax ? (
                <span className="text-sm">
                  €{filters.amountMin || 0} - €{filters.amountMax || "∞"}
                </span>
              ) : (
                "Importo"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 bg-popover border-border" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Importo minimo (€)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amountMinInput}
                  onChange={(e) => setAmountMinInput(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Importo massimo (€)</Label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={amountMaxInput}
                  onChange={(e) => setAmountMaxInput(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={applyAmountFilter} className="flex-1">
                  Applica
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAmountMinInput("");
                    setAmountMaxInput("");
                    onFiltersChange({
                      ...filters,
                      amountMin: undefined,
                      amountMax: undefined,
                    });
                    setAmountPopoverOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Riconciliazione */}
        <Select
          value={filters.reconciliation || "all"}
          onValueChange={(v) =>
            onFiltersChange({
              ...filters,
              reconciliation: v as "all" | "none" | "suggested" | "reconciled" | "not_reconciled",
            })
          }
        >
          <SelectTrigger className="w-[170px] bg-secondary border-border">
            <Link2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Riconciliazione" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="suggested">Con proposte</SelectItem>
            <SelectItem value="not_reconciled">Non riconciliati</SelectItem>
            <SelectItem value="reconciled">Riconciliati</SelectItem>
          </SelectContent>
        </Select>

        {/* Pulisci filtri */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Pulisci ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Badge filtri attivi */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.searchText && (
            <Badge variant="secondary" className="gap-1">
              Ricerca: "{filters.searchText}"
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  setSearchInput("");
                  onFiltersChange({ ...filters, searchText: "" });
                }}
              />
            </Badge>
          )}
          {filters.type && filters.type !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {filters.type === "income" ? "Entrate" : "Uscite"}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, type: "all" })}
              />
            </Badge>
          )}
          {filters.contoId && (
            <Badge variant="secondary" className="gap-1">
              {contiAttivi.find((c) => c.id === filters.contoId)?.nome_conto}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, contoId: undefined })}
              />
            </Badge>
          )}
          {filters.categoryId && (
            <Badge variant="secondary" className="gap-1">
              {categories.find((c) => c.id === filters.categoryId)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  onFiltersChange({ ...filters, categoryId: undefined })
                }
              />
            </Badge>
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="secondary" className="gap-1">
              {filters.dateFrom
                ? format(new Date(filters.dateFrom), "dd/MM/yyyy", { locale: it })
                : "..."}{" "}
              -{" "}
              {filters.dateTo
                ? format(new Date(filters.dateTo), "dd/MM/yyyy", { locale: it })
                : "..."}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    dateFrom: undefined,
                    dateTo: undefined,
                  })
                }
              />
            </Badge>
          )}
          {(filters.amountMin || filters.amountMax) && (
            <Badge variant="secondary" className="gap-1">
              €{filters.amountMin || 0} - €{filters.amountMax || "∞"}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  setAmountMinInput("");
                  setAmountMaxInput("");
                  onFiltersChange({
                    ...filters,
                    amountMin: undefined,
                    amountMax: undefined,
                  });
                }}
              />
            </Badge>
          )}
          {filters.reconciliation && filters.reconciliation !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {filters.reconciliation === "suggested"
                ? "Con proposte"
                : filters.reconciliation === "not_reconciled"
                ? "Non riconciliati"
                : filters.reconciliation === "reconciled"
                ? "Riconciliati"
                : filters.reconciliation}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  onFiltersChange({ ...filters, reconciliation: "all" })
                }
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
