import { useMemo } from "react";
import { useCategories } from "./useCategories";
import { 
  parseISO, 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  subMonths, 
  isWithinInterval,
  differenceInDays,
  format
} from "date-fns";
import { TransactionWithCategory } from "./useTransactions";

/** A transaction is an internal transfer (giroconto) if it was created via
 *  the transfer function OR manually reconciled as a transfer. These must be
 *  excluded from income/expense statistics (but NOT from balance calculations). */
export function isInternalTransfer(t: TransactionWithCategory): boolean {
  return (
    !!t.transfer_id ||
    (t.reconciliation_type === "transfer" && t.reconciliation_status === "reconciled")
  );
}

export type PeriodType = "thisMonth" | "threeMonths" | "year" | "custom";

export interface CategoryBreakdown {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  children?: CategoryBreakdown[];
}

export interface PeriodComparison {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  isPositive: boolean;
}

export interface DashboardStats {
  totalBalance: number;
  periodIncome: number;
  periodExpenses: number;
  netSavings: number;
  spendingByCategory: CategoryBreakdown[];
  incomeByCategory: CategoryBreakdown[];
  recentTransactions: TransactionWithCategory[];
  periodTransactions: TransactionWithCategory[];
  uncategorizedIncome: number;
  uncategorizedExpenses: number;
  uncategorizedIncomeCount: number;
  uncategorizedExpensesCount: number;
  // Insights
  topExpenseCategory: CategoryBreakdown | null;
  topIncomeCategory: CategoryBreakdown | null;
  savingsRate: number;
  avgDailyExpense: number;
  // Period comparison
  incomeComparison: PeriodComparison;
  expensesComparison: PeriodComparison;
  netComparison: PeriodComparison;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

const EXPENSE_COLORS = [
  "bg-primary",
  "bg-warning", 
  "bg-destructive",
  "bg-accent",
  "bg-muted-foreground",
  "bg-primary/70",
  "bg-warning/70",
  "bg-destructive/70",
];

const INCOME_COLORS = [
  "bg-success",
  "bg-primary",
  "bg-success/70",
  "bg-primary/70",
  "bg-accent",
  "bg-success/50",
  "bg-primary/50",
  "bg-accent/70",
];

export function getMonthDateRange(month: number, year: number): DateRange {
  const date = new Date(year, month, 1);
  return {
    startDate: startOfDay(startOfMonth(date)),
    endDate: endOfDay(endOfMonth(date)),
  };
}

export function getPeriodDateRange(
  periodType: PeriodType,
  selectedYear: number,
  customDateRange: { from: Date | undefined; to: Date | undefined }
): DateRange {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (periodType) {
    case "thisMonth":
      startDate = startOfDay(startOfMonth(now));
      endDate = endOfDay(endOfMonth(now));
      break;
    case "threeMonths":
      startDate = startOfDay(startOfMonth(subMonths(now, 2)));
      endDate = endOfDay(endOfMonth(now));
      break;
    case "year":
      startDate = startOfDay(startOfYear(new Date(selectedYear, 0, 1)));
      endDate = endOfDay(endOfYear(new Date(selectedYear, 0, 1)));
      break;
    case "custom":
      if (customDateRange.from && customDateRange.to) {
        startDate = startOfDay(customDateRange.from);
        endDate = endOfDay(customDateRange.to);
      } else {
        startDate = new Date(0);
        endDate = new Date(0);
      }
      break;
    default:
      startDate = startOfDay(startOfMonth(now));
      endDate = endOfDay(endOfMonth(now));
  }

  return { startDate, endDate };
}

export function getPreviousPeriodRange(
  periodType: PeriodType,
  currentRange: DateRange,
  selectedYear: number
): DateRange {
  const { startDate, endDate } = currentRange;
  const periodDays = differenceInDays(endDate, startDate) + 1;

  switch (periodType) {
    case "thisMonth":
      return {
        startDate: startOfDay(startOfMonth(subMonths(startDate, 1))),
        endDate: endOfDay(endOfMonth(subMonths(startDate, 1))),
      };
    case "threeMonths":
      return {
        startDate: startOfDay(startOfMonth(subMonths(startDate, 3))),
        endDate: endOfDay(endOfMonth(subMonths(endDate, 3))),
      };
    case "year":
      return {
        startDate: startOfDay(startOfYear(new Date(selectedYear - 1, 0, 1))),
        endDate: endOfDay(endOfYear(new Date(selectedYear - 1, 0, 1))),
      };
    case "custom":
      // Previous period of the same length
      const prevEnd = new Date(startDate.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - periodDays * 24 * 60 * 60 * 1000 + 1);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    default:
      return { startDate: new Date(0), endDate: new Date(0) };
  }
}

export function getPeriodLabel(
  periodType: PeriodType,
  selectedYear: number,
  customDateRange: { from: Date | undefined; to: Date | undefined }
): string {
  switch (periodType) {
    case "thisMonth":
      return "Questo mese";
    case "threeMonths":
      return "Ultimi 3 mesi";
    case "year":
      return `Anno ${selectedYear}`;
    case "custom":
      if (customDateRange.from && customDateRange.to) {
        return `${format(customDateRange.from, "dd/MM")} - ${format(customDateRange.to, "dd/MM/yyyy")}`;
      }
      return "Periodo personalizzato";
    default:
      return "";
  }
}

export function useDashboardStats(
  transactions: TransactionWithCategory[],
  periodDateRange: DateRange
): DashboardStats {
  const { data: allCategories = [] } = useCategories();

  return useMemo(() => {
    const { startDate, endDate } = periodDateRange;

    const isInPeriod = (dateStr: string): boolean => {
      const txDate = parseISO(dateStr);
      return isWithinInterval(txDate, { start: startDate, end: endDate });
    };

    const periodTransactions = transactions.filter((t) => isInPeriod(t.date));

    let totalBalance = 0;
    let periodIncome = 0;
    let periodExpenses = 0;
    let uncategorizedIncome = 0;
    let uncategorizedExpenses = 0;
    let uncategorizedIncomeCount = 0;
    let uncategorizedExpensesCount = 0;

    // Build parent lookup
    const parentMap = new Map<string, string>();
    allCategories.forEach((c) => {
      if (c.parent_id) parentMap.set(c.id, c.parent_id);
    });

    const categoryTotals: Record<string, { id: string; name: string; amount: number; children: Record<string, { id: string; name: string; amount: number }> }> = {};
    const incomeCategoryTotals: Record<string, { id: string; name: string; amount: number; children: Record<string, { id: string; name: string; amount: number }> }> = {};

    transactions.forEach((t) => {
      const amount = t.type === "income" ? t.amount : -t.amount;
      totalBalance += amount;
    });

    periodTransactions.forEach((t) => {
      if (isInternalTransfer(t)) return;

      if (t.type === "income") {
        periodIncome += t.amount;

        if (t.categories) {
          const catId = t.categories.id;
          const parentId = parentMap.get(catId);
          const rootId = parentId || catId;
          const rootName = parentId
            ? allCategories.find((c) => c.id === parentId)?.name || t.categories.name
            : t.categories.name;

          if (!incomeCategoryTotals[rootId]) {
            incomeCategoryTotals[rootId] = { id: rootId, name: rootName, amount: 0, children: {} };
          }
          incomeCategoryTotals[rootId].amount += t.amount;

          if (parentId) {
            if (!incomeCategoryTotals[rootId].children[catId]) {
              incomeCategoryTotals[rootId].children[catId] = { id: catId, name: t.categories.name, amount: 0 };
            }
            incomeCategoryTotals[rootId].children[catId].amount += t.amount;
          }
        } else {
          uncategorizedIncome += t.amount;
          uncategorizedIncomeCount++;
        }
      } else {
        periodExpenses += t.amount;

        if (t.categories) {
          const catId = t.categories.id;
          const parentId = parentMap.get(catId);
          const rootId = parentId || catId;
          const rootName = parentId
            ? allCategories.find((c) => c.id === parentId)?.name || t.categories.name
            : t.categories.name;

          if (!categoryTotals[rootId]) {
            categoryTotals[rootId] = { id: rootId, name: rootName, amount: 0, children: {} };
          }
          categoryTotals[rootId].amount += t.amount;

          if (parentId) {
            if (!categoryTotals[rootId].children[catId]) {
              categoryTotals[rootId].children[catId] = { id: catId, name: t.categories.name, amount: 0 };
            }
            categoryTotals[rootId].children[catId].amount += t.amount;
          }
        } else {
          uncategorizedExpenses += t.amount;
          uncategorizedExpensesCount++;
        }
      }
    });

    const buildBreakdown = (
      totals: typeof categoryTotals,
      total: number,
      colors: string[]
    ): CategoryBreakdown[] => {
      const sorted = Object.values(totals)
        .sort((a, b) => b.amount - a.amount)
        .map((cat, index) => ({
          id: cat.id,
          name: cat.name,
          amount: cat.amount,
          percentage: total > 0 ? Math.round((cat.amount / total) * 100) : 0,
          color: colors[index % colors.length],
          children: Object.values(cat.children)
            .sort((a, b) => b.amount - a.amount)
            .map((child, ci) => ({
              id: child.id,
              name: child.name,
              amount: child.amount,
              percentage: cat.amount > 0 ? Math.round((child.amount / cat.amount) * 100) : 0,
              color: colors[(index + ci + 1) % colors.length],
            })),
        }));
      return sorted;
    };

    const sortedCategories = buildBreakdown(categoryTotals, periodExpenses, EXPENSE_COLORS);

    if (uncategorizedExpenses > 0) {
      sortedCategories.push({
        id: "uncategorized",
        name: "Senza Categoria",
        amount: uncategorizedExpenses,
        percentage: periodExpenses > 0 ? Math.round((uncategorizedExpenses / periodExpenses) * 100) : 0,
        color: "bg-muted",
      });
    }

    const sortedIncomeCategories = buildBreakdown(incomeCategoryTotals, periodIncome, INCOME_COLORS);

    if (uncategorizedIncome > 0) {
      sortedIncomeCategories.push({
        id: "uncategorized",
        name: "Senza Categoria",
        amount: uncategorizedIncome,
        percentage: periodIncome > 0 ? Math.round((uncategorizedIncome / periodIncome) * 100) : 0,
        color: "bg-muted",
      });
    }

    const topExpenseCategory = sortedCategories.length > 0 ? sortedCategories[0] : null;
    const topIncomeCategory = sortedIncomeCategories.length > 0 ? sortedIncomeCategories[0] : null;
    const savingsRate = periodIncome > 0 ? Math.round(((periodIncome - periodExpenses) / periodIncome) * 100) : 0;
    const periodDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
    const avgDailyExpense = periodExpenses / periodDays;

    const recentTransactions = periodTransactions.length > 0
      ? periodTransactions.slice(0, 5)
      : transactions.slice(0, 5);

    return {
      totalBalance,
      periodIncome,
      periodExpenses,
      netSavings: periodIncome - periodExpenses,
      spendingByCategory: sortedCategories,
      incomeByCategory: sortedIncomeCategories,
      recentTransactions,
      periodTransactions,
      uncategorizedIncome,
      uncategorizedExpenses,
      uncategorizedIncomeCount,
      uncategorizedExpensesCount,
      topExpenseCategory,
      topIncomeCategory,
      savingsRate,
      avgDailyExpense,
      incomeComparison: { current: periodIncome, previous: 0, delta: 0, deltaPercent: 0, isPositive: true },
      expensesComparison: { current: periodExpenses, previous: 0, delta: 0, deltaPercent: 0, isPositive: true },
      netComparison: { current: periodIncome - periodExpenses, previous: 0, delta: 0, deltaPercent: 0, isPositive: true },
    };
  }, [transactions, periodDateRange, allCategories]);
}

export function usePeriodComparison(
  transactions: TransactionWithCategory[],
  currentRange: DateRange,
  previousRange: DateRange
): { incomeComparison: PeriodComparison; expensesComparison: PeriodComparison; netComparison: PeriodComparison } {
  return useMemo(() => {
    const isInRange = (dateStr: string, range: DateRange): boolean => {
      const txDate = parseISO(dateStr);
      return isWithinInterval(txDate, { start: range.startDate, end: range.endDate });
    };

    let currentIncome = 0;
    let currentExpenses = 0;
    let previousIncome = 0;
    let previousExpenses = 0;

    transactions.forEach((t) => {
      if (isInternalTransfer(t)) return; // Skip giroconti

      if (isInRange(t.date, currentRange)) {
        if (t.type === "income") {
          currentIncome += t.amount;
        } else {
          currentExpenses += t.amount;
        }
      }
      if (isInRange(t.date, previousRange)) {
        if (t.type === "income") {
          previousIncome += t.amount;
        } else {
          previousExpenses += t.amount;
        }
      }
    });

    const calcComparison = (current: number, previous: number, higherIsBetter = true): PeriodComparison => {
      const delta = current - previous;
      const deltaPercent = previous > 0 ? Math.round((delta / previous) * 100) : (current > 0 ? 100 : 0);
      const isPositive = higherIsBetter ? delta >= 0 : delta <= 0;
      return { current, previous, delta, deltaPercent, isPositive };
    };

    const currentNet = currentIncome - currentExpenses;
    const previousNet = previousIncome - previousExpenses;

    return {
      incomeComparison: calcComparison(currentIncome, previousIncome, true),
      expensesComparison: calcComparison(currentExpenses, previousExpenses, false),
      netComparison: calcComparison(currentNet, previousNet, true),
    };
  }, [transactions, currentRange, previousRange]);
}
