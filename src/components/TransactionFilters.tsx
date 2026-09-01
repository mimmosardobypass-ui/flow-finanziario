import { useState, useEffect, useMemo } from "react";
import { Search, Filter, X, Calendar, DollarSign, Tag, Landmark, Link2 } from "lucide-react";
import { CategorySelect } from "@/components/CategorySelect";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { useTransactionMonths } from "@/hooks/useTransactionMonths";
import { TransactionFilters as FiltersType } from "@/hooks/useFilteredTransactions";

interface Props {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
}

type DateMode = "range" | "month" | "year";

const MESI_ABBR = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MESI_FULL = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const pad = (n: number) => String(n).padStart(2, "0");
const monthStart = (y: number, m: number) => `${y}-${pad(m + 1)}-01`;
const monthEnd = (y: number, m: number) => `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
const fmtIt = (iso: string) => format(new Date(iso), "dd/MM/yyyy", { locale: it });

export function TransactionFilters({ filters, onFiltersChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.searchText || "");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>("range");
  const [monthYear, setMonthYear] = useState(new Date().getFullYear());
  const [amountPopoverOpen, setAmountPopoverOpen] = useState(false);
  const [amountMinInput, setAmountMinInput] = useState(filters.amountMin?.toString() || "");
  const [amountMaxInput, setAmountMaxInput] = useState(filters.amountMax?.toString() || "");

  const { data: categories = [] } = useCategories();
  const categoryTree = useCategoryTree();
  const { data: contiAttivi = [] } = useContiAttivi();
  const { data: mesiConDati } = useTransactionMonths();

  const anniDisponibili = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - i);
  }, []);

  const applyRange = (from?: string, to?: string, mode: DateMode = "range") => {
    setDateMode(mode);
    onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
    setDatePopoverOpen(false);
  };

  const selectMonth = (y: number, m: number) => applyRange(monthStart(y, m), monthEnd(y, m), "month");
  const selectYear = (y: number) => applyRange(`${y}-01-01`, `${y}-12-31`, "year");

  const shortcuts = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return [
      { label: "Questo mese", run: () => { setMonthYear(y); selectMonth(y, m); } },
      {
        label: "Mese scorso",
        run: () => {
          const d = new Date(y, m - 1, 1);
          setMonthYear(d.getFullYear());
          selectMonth(d.getFullYear(), d.getMonth());
        },
      },
      {
        label: "Ultimi 3 mesi",
        run: () => {
          const start = new Date(y, m - 2, 1);
          applyRange(monthStart(start.getFullYear(), start.getMonth()), monthEnd(y, m), "range");
        },
      },
      { label: "Quest'anno", run: () => selectYear(y) },
      { label: "Anno scorso", run: () => selectYear(y - 1) },
    ];
  };

  const dateLabel = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) return null;
    if (dateMode === "month" && filters.dateFrom) {
      const d = new Date(filters.dateFrom);
      return `${MESI_FULL[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (dateMode === "year" && filters.dateFrom) {
      return String(new Date(filters.dateFrom).getFullYear());
    }
    if (filters.dateFrom && filters.dateTo) return `${fmtIt(filters.dateFrom)} → ${fmtIt(filters.dateTo)}`;
    if (filters.dateFrom) return `dal ${fmtIt(filters.dateFrom)}`;
    return `fino al ${fmtIt(filters.dateTo!)}`;
  }, [filters.dateFrom, filters.dateTo, dateMode]);

  const clearDates = () => {
    setDateMode("range");
    onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined });
  };

  const selectedMonthKey =
    dateMode === "month" && filters.dateFrom ? filters.dateFrom.slice(0, 7) : null;
  const selectedYearValue =
    dateMode === "year" && filters.dateFrom ? Number(filters.dateFrom.slice(0, 4)) : null;

  // Filtra l'albero categorie in base al tipo selezionato
  const filteredTree = useMemo(() => {
    if (!filters.type || filters.type === "all") {
      return categoryTree;
    }
    return categoryTree.filter((cat) => cat.type === filters.type);
  }, [categoryTree, filters.type]);

  useEffect(() => {
    setSearchInput(filters.searchText || "");
  }, [filters.searchText]);

  // Debounce per la ricerca
  useEffect(() => {
    if (searchInput === (filters.searchText || "")) return;

    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, searchText: searchInput });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

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
    setDateMode("range");
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
            placeholder="Cerca nella descrizione..."
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
        <CategorySelect
          value={filters.categoryId || "all"}
          onChange={handleCategoryChange}
          categories={filteredTree}
          showAllOption
          className="w-[160px] bg-secondary border-border"
        />

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
              {dateLabel ? <span className="text-sm">{dateLabel}</span> : "Data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 bg-popover border-border" align="start">
            <div className="space-y-4">
              {/* Selettore modalità */}
              <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary p-1">
                {([
                  { key: "range", label: "Intervallo" },
                  { key: "month", label: "Mese" },
                  { key: "year", label: "Anno" },
                ] as { key: DateMode; label: string }[]).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setDateMode(m.key)}
                    className={`rounded px-3 py-1.5 text-sm transition-colors ${
                      dateMode === m.key
                        ? "bg-background text-foreground shadow-sm font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Scorciatoie */}
              <div className="flex flex-wrap gap-1.5">
                {shortcuts().map((s) => (
                  <Button
                    key={s.label}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs bg-secondary border-border"
                    onClick={s.run}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>

              {dateMode === "range" && (
                <>
                  <div>
                    <Label className="text-sm text-muted-foreground">Da</Label>
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                      onSelect={handleDateFromSelect}
                      locale={it}
                      className="rounded-md border border-border pointer-events-auto"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">A</Label>
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                      onSelect={handleDateToSelect}
                      locale={it}
                      className="rounded-md border border-border pointer-events-auto"
                    />
                  </div>
                </>
              )}

              {dateMode === "month" && (
                <div className="w-[280px] space-y-3">
                  <Select value={String(monthYear)} onValueChange={(v) => setMonthYear(Number(v))}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {anniDisponibili.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-4 gap-2">
                    {MESI_ABBR.map((label, idx) => {
                      const key = `${monthYear}-${pad(idx + 1)}`;
                      const hasData = !mesiConDati || mesiConDati.has(key);
                      const selected = selectedMonthKey === key;
                      return (
                        <Button
                          key={key}
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          onClick={() => selectMonth(monthYear, idx)}
                          className={`${selected ? "" : "bg-secondary border-border"} ${
                            !selected && !hasData ? "text-muted-foreground/50" : ""
                          }`}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {dateMode === "year" && (
                <div className="grid w-[280px] grid-cols-3 gap-2">
                  {anniDisponibili.map((y) => (
                    <Button
                      key={y}
                      variant={selectedYearValue === y ? "default" : "outline"}
                      size="sm"
                      onClick={() => selectYear(y)}
                      className={selectedYearValue === y ? "" : "bg-secondary border-border"}
                    >
                      {y}
                    </Button>
                  ))}
                </div>
              )}

              {(filters.dateFrom || filters.dateTo) && (
                <Button variant="ghost" size="sm" onClick={clearDates} className="w-full">
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
              reconciliation: v as FiltersType["reconciliation"],
            })
          }
        >
          <SelectTrigger className="w-[230px] bg-secondary border-border">
            <Link2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Riconciliazione" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="reconciled">Riconciliati con un movimento</SelectItem>
            <SelectItem value="with_documents">Con documenti collegati</SelectItem>
            <SelectItem value="partially_covered">Parzialmente coperti</SelectItem>
            <SelectItem value="not_reconciled">Non riconciliati</SelectItem>
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
          {dateLabel && (
            <Badge variant="secondary" className="gap-1">
              {dateLabel}
              <X className="h-3 w-3 cursor-pointer" onClick={clearDates} />
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
                ? "Riconciliati con un movimento"
                : filters.reconciliation === "with_documents"
                ? "Con documenti collegati"
                : filters.reconciliation === "partially_covered"
                ? "Parzialmente coperti"
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
