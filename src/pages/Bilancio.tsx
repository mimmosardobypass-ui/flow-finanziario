import { useMemo, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, useCategoryTree } from "@/hooks/useCategories";
import { useConti } from "@/hooks/useConti";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format, parseISO, isWithinInterval } from "date-fns";
import { it } from "date-fns/locale";
import { Scale } from "lucide-react";

type PeriodType = "month" | "quarter" | "year";

function getPeriodRange(period: PeriodType, now: Date) {
  switch (period) {
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
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

  const [period, setPeriod] = useState<PeriodType>("month");
  const [contoId, setContoId] = useState<string>("all");

  const now = new Date();
  const range = getPeriodRange(period, now);

  const periodLabel = useMemo(() => {
    switch (period) {
      case "month":
        return format(now, "MMMM yyyy", { locale: it });
      case "quarter":
        return `${format(range.start, "MMM", { locale: it })} - ${format(range.end, "MMM yyyy", { locale: it })}`;
      case "year":
        return format(now, "yyyy");
    }
  }, [period, now]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.transfer_id) return false;
      const date = parseISO(t.date);
      if (!isWithinInterval(date, { start: range.start, end: range.end })) return false;
      if (contoId !== "all" && t.conto_id !== contoId) return false;
      return true;
    });
  }, [transactions, range.start, range.end, contoId]);

  const { expenseCategories, incomeCategories, totalExpenses, totalIncome } = useMemo(() => {
    const expenseMap = new Map<string, number>();
    const incomeMap = new Map<string, number>();

    filteredTransactions.forEach((t) => {
      const catId = t.category_id || "uncategorized";
      const map = t.type === "expense" ? expenseMap : incomeMap;
      map.set(catId, (map.get(catId) || 0) + t.amount);
    });

    const buildAggregates = (type: "expense" | "income", map: Map<string, number>): CategoryAggregate[] => {
      const result: CategoryAggregate[] = [];
      const roots = categoryTree.filter((c) => c.type === type);

      roots.forEach((root) => {
        const childrenAgg: { id: string; name: string; total: number }[] = [];
        let rootDirectTotal = map.get(root.id) || 0;

        root.children.forEach((child) => {
          const childTotal = map.get(child.id) || 0;
          if (childTotal > 0) {
            childrenAgg.push({ id: child.id, name: child.name, total: childTotal });
          }
        });

        const parentTotal = rootDirectTotal + childrenAgg.reduce((s, c) => s + c.total, 0);
        if (parentTotal > 0) {
          result.push({ id: root.id, name: root.name, total: parentTotal, children: childrenAgg });
        }
      });

      // Handle uncategorized
      const uncatTotal = map.get("uncategorized") || 0;
      if (uncatTotal > 0) {
        result.push({ id: "uncategorized", name: "Senza Categoria", total: uncatTotal, children: [] });
      }

      // Handle categories assigned to children whose parent is a different type or missing
      const accountedIds = new Set<string>();
      roots.forEach((r) => {
        accountedIds.add(r.id);
        r.children.forEach((c) => accountedIds.add(c.id));
      });
      accountedIds.add("uncategorized");

      map.forEach((total, catId) => {
        if (!accountedIds.has(catId) && total > 0) {
          const cat = categories.find((c) => c.id === catId);
          result.push({ id: catId, name: cat?.name || "Altro", total, children: [] });
        }
      });

      result.sort((a, b) => b.total - a.total);
      return result;
    };

    const expenseCategories = buildAggregates("expense", expenseMap);
    const incomeCategories = buildAggregates("income", incomeMap);
    const totalExpenses = expenseCategories.reduce((s, c) => s + c.total, 0);
    const totalIncome = incomeCategories.reduce((s, c) => s + c.total, 0);

    return { expenseCategories, incomeCategories, totalExpenses, totalIncome };
  }, [filteredTransactions, categoryTree, categories]);

  const netResult = totalIncome - totalExpenses;

  const renderColumn = (title: string, items: CategoryAggregate[], total: number, colorClass: string) => (
    <div className="flex-1 min-w-0">
      <div className={`text-center font-bold text-lg mb-4 pb-2 border-b border-border ${colorClass}`}>
        {title}
      </div>
      <div className="space-y-1 px-2">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-4">Nessun movimento</p>
        )}
        {items.map((cat) => (
          <div key={cat.id} className="mb-3">
            <div className="flex justify-between items-center font-semibold text-foreground">
              <span className="truncate">{cat.name}</span>
              <span className="ml-2 whitespace-nowrap">{formatCurrency(cat.total)}</span>
            </div>
            {cat.children.map((child) => (
              <div key={child.id} className="flex justify-between items-center pl-4 text-sm text-muted-foreground">
                <span className="truncate">{child.name}</span>
                <span className="ml-2 whitespace-nowrap">{formatCurrency(child.total)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={`mt-4 pt-3 border-t-2 border-border flex justify-between items-center font-bold text-base px-2 ${colorClass}`}>
        <span>Totale {title}</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Scale className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bilancio</h1>
            <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mese</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Anno</SelectItem>
            </SelectContent>
          </Select>
          <Select value={contoId} onValueChange={setContoId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tutti i conti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i conti</SelectItem>
              {conti.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome_conto}</SelectItem>
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
                {netResult >= 0 ? "+" : ""}{formatCurrency(netResult)}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
