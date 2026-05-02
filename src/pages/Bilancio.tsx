import { useMemo, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, useCategoryTree } from "@/hooks/useCategories";
import { useConti } from "@/hooks/useConti";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { it } from "date-fns/locale";
import { Scale } from "lucide-react";

type PeriodType = "month" | "quarter" | "year";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const QUARTERS = [
  { value: 1, label: "1° Trimestre (Gen - Mar)" },
  { value: 2, label: "2° Trimestre (Apr - Giu)" },
  { value: 3, label: "3° Trimestre (Lug - Set)" },
  { value: 4, label: "4° Trimestre (Ott - Dic)" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

interface CategoryAggregate {
  id: string;
  name: string;
  total: number;
  children: { id: string; name: string; total: number }[];
}

export default function Bilancio() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: conti = [] } = useConti();
  const categoryTree = useCategoryTree();

  const now = new Date();
  const currentYear = now.getFullYear();

  const [period, setPeriod] = useState<PeriodType>("month");
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(now.getMonth()); // 0-11
  const [quarter, setQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1); // 1-4
  const [contoId, setContoId] = useState<string>("all");

  // Available years: from min transaction year to current year
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    transactions.forEach((t) => {
      if (t.date) years.add(parseISO(t.date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  const range = useMemo(() => {
    if (period === "year") {
      const d = new Date(year, 0, 1);
      return { start: startOfYear(d), end: endOfYear(d) };
    }
    if (period === "quarter") {
      const startMonth = (quarter - 1) * 3;
      const start = new Date(year, startMonth, 1);
      const end = endOfMonth(new Date(year, startMonth + 2, 1));
      return { start, end };
    }
    // month
    const d = new Date(year, month, 1);
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [period, year, month, quarter]);

  const periodLabel = useMemo(() => {
    if (period === "year") return `Anno ${year}`;
    if (period === "quarter") {
      return `${QUARTERS.find((q) => q.value === quarter)?.label} ${year}`;
    }
    return `${MONTHS[month]} ${year}`;
  }, [period, year, month, quarter]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.deleted_at) return false;
      if (t.transfer_id) return false;
      const date = parseISO(t.date);
      if (!isWithinInterval(date, { start: range.start, end: range.end })) return false;
      if (contoId !== "all" && t.conto_id !== contoId) return false;
      return true;
    });
  }, [transactions, range.start, range.end, contoId]);

  const { expenseCategories, incomeCategories, totalExpenses, totalIncome } = useMemo(() => {
    // Map per-category absolute totals, separated by transaction type
    const expenseMap = new Map<string, number>();
    const incomeMap = new Map<string, number>();

    filteredTransactions.forEach((t) => {
      const catId = t.category_id || "uncategorized";
      const amt = Math.abs(Number(t.amount) || 0);
      const map = t.type === "expense" ? expenseMap : incomeMap;
      map.set(catId, (map.get(catId) || 0) + amt);
    });

    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const buildAggregates = (
      type: "expense" | "income",
      map: Map<string, number>,
    ): CategoryAggregate[] => {
      // Group: parentId -> { total (direct on parent), children: Map<childId, total> }
      const groups = new Map<
        string,
        { total: number; children: Map<string, number> }
      >();

      const ensureGroup = (id: string) => {
        if (!groups.has(id)) groups.set(id, { total: 0, children: new Map() });
        return groups.get(id)!;
      };

      map.forEach((total, catId) => {
        if (catId === "uncategorized") {
          ensureGroup("uncategorized").total += total;
          return;
        }
        const cat = categoryById.get(catId);
        if (!cat) {
          // Category not found at all — show standalone using its id as bucket
          ensureGroup(catId).total += total;
          return;
        }
        if (cat.parent_id) {
          const parent = categoryById.get(cat.parent_id);
          if (parent) {
            const g = ensureGroup(parent.id);
            g.children.set(catId, (g.children.get(catId) || 0) + total);
          } else {
            // Parent missing -> use this category itself as the group label
            ensureGroup(catId).total += total;
          }
        } else {
          // Root category — sum on itself
          ensureGroup(catId).total += total;
        }
      });

      // Build display list, filtered by requested type when category is known
      const result: CategoryAggregate[] = [];
      groups.forEach((g, id) => {
        let name = "Senza Categoria";
        if (id !== "uncategorized") {
          const cat = categoryById.get(id);
          if (cat) {
            // If the bucket category has a type and it doesn't match, still show it
            // because the transaction itself is of `type`. The user wants grouping by parent.
            name = cat.name;
          } else {
            name = "Altro";
          }
        }

        const childrenList = Array.from(g.children.entries())
          .map(([cid, total]) => ({
            id: cid,
            name: categoryById.get(cid)?.name || "Altro",
            total,
          }))
          .sort((a, b) => b.total - a.total);

        const grandTotal = g.total + childrenList.reduce((s, c) => s + c.total, 0);
        if (grandTotal <= 0) return;

        result.push({ id, name, total: grandTotal, children: childrenList });
      });

      result.sort((a, b) => b.total - a.total);
      return result;
    };

    const expenseCategories = buildAggregates("expense", expenseMap);
    const incomeCategories = buildAggregates("income", incomeMap);
    const totalExpenses = expenseCategories.reduce((s, c) => s + c.total, 0);
    const totalIncome = incomeCategories.reduce((s, c) => s + c.total, 0);

    return { expenseCategories, incomeCategories, totalExpenses, totalIncome };
  }, [filteredTransactions, categories]);

  const netResult = totalIncome - totalExpenses;

  const renderColumn = (
    title: string,
    items: CategoryAggregate[],
    total: number,
    colorClass: string,
  ) => (
    <div className="flex-1 min-w-0">
      <div className={`text-center font-bold text-lg mb-4 pb-2 border-b border-border ${colorClass}`}>
        {title}
      </div>
      <div className="space-y-1 px-2">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nessun movimento
          </p>
        )}
        {items.map((cat) => (
          <div key={cat.id} className="mb-3">
            <div className="flex justify-between items-center font-semibold text-foreground">
              <span className="truncate">{cat.name}</span>
              <span className="ml-2 whitespace-nowrap">{formatCurrency(cat.total)}</span>
            </div>
            {cat.children.map((child) => (
              <div
                key={child.id}
                className="flex justify-between items-center pl-4 text-sm text-muted-foreground"
              >
                <span className="truncate">{child.name}</span>
                <span className="ml-2 whitespace-nowrap">{formatCurrency(child.total)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        className={`mt-4 pt-3 border-t-2 border-border flex justify-between items-center font-bold text-base px-2 ${colorClass}`}
      >
        <span>Totale {title}</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Scale className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bilancio</h1>
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mese</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Anno</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === "month" && (
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {period === "quarter" && (
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q) => (
                  <SelectItem key={q.value} value={String(q.value)}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={contoId} onValueChange={setContoId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tutti i conti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i conti</SelectItem>
              {conti.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_conto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {renderColumn("Uscite", expenseCategories, totalExpenses, "text-destructive")}
            <div className="hidden md:block w-px bg-border" />
            <div className="md:hidden h-px bg-border" />
            {renderColumn("Entrate", incomeCategories, totalIncome, "text-emerald-600")}
          </div>

          <div className="mt-6 pt-4 border-t-2 border-border text-center">
            <span className="text-lg font-bold text-foreground">
              Utile/Perdita:{" "}
              <span className={netResult >= 0 ? "text-emerald-600" : "text-destructive"}>
                {netResult >= 0 ? "+" : ""}
                {formatCurrency(netResult)}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
