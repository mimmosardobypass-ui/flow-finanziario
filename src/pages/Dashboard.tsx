import React, { useState, useMemo } from "react";
import { 
  getYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  isSameDay,
  isSameMonth,
  differenceInDays,
  parseISO
} from "date-fns";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  CalendarIcon,
  FileDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions } from "@/hooks/useTransactions";
import { 
  useDashboardStats, 
  usePeriodComparison,
  getPeriodDateRange, 
  getPreviousPeriodRange,
  getPeriodLabel,
  PeriodType 
} from "@/hooks/useDashboardStats";
import { cn } from "@/lib/utils";
import { exportDashboardToPdf } from "@/utils/exportDashboardPdf";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/StatCard";
import { CategoryBreakdownCard } from "@/components/dashboard/CategoryBreakdownCard";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";
import { PeriodComparisonCard } from "@/components/dashboard/PeriodComparisonCard";
import { InsightsCard } from "@/components/dashboard/InsightsCard";

// Custom Tooltip for the chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const cumulativo = payload.find((p: any) => p.dataKey === "cumulativo");
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        <p className="text-success text-sm">
          Entrate: €{payload[0]?.value?.toLocaleString("it-IT", { minimumFractionDigits: 2 }) || "0,00"}
        </p>
        <p className="text-destructive text-sm">
          Uscite: €{payload[1]?.value?.toLocaleString("it-IT", { minimumFractionDigits: 2 }) || "0,00"}
        </p>
        <p className="text-primary text-sm font-medium">
          Saldo: €{payload[2]?.value?.toLocaleString("it-IT", { minimumFractionDigits: 2 }) || "0,00"}
        </p>
        {cumulativo && (
          <p className="text-muted-foreground text-sm mt-1 pt-1 border-t border-border">
            Cumulato: €{cumulativo.value?.toLocaleString("it-IT", { minimumFractionDigits: 2 }) || "0,00"}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { data: transactions = [], isLoading } = useTransactions();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [periodType, setPeriodType] = useState<PeriodType>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [showCumulative, setShowCumulative] = useState(false);

  // Get available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach((t) => {
      years.add(getYear(parseISO(t.date)));
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Calculate period date ranges
  const periodDateRange = useMemo(
    () => getPeriodDateRange(periodType, selectedYear, customDateRange),
    [periodType, selectedYear, customDateRange]
  );

  const previousPeriodRange = useMemo(
    () => getPreviousPeriodRange(periodType, periodDateRange, selectedYear),
    [periodType, periodDateRange, selectedYear]
  );

  const periodLabel = useMemo(
    () => getPeriodLabel(periodType, selectedYear, customDateRange),
    [periodType, selectedYear, customDateRange]
  );

  // Use the new hooks for stats calculation
  const stats = useDashboardStats(transactions, periodDateRange);
  const { incomeComparison, expensesComparison, netComparison } = usePeriodComparison(
    transactions,
    periodDateRange,
    previousPeriodRange
  );

  // Calculate chart data based on selected period
  const chartData = useMemo(() => {
    const { startDate, endDate } = periodDateRange;
    const now = new Date();
    let groupByDay = true;

    if (periodType === "custom" && (!customDateRange.from || !customDateRange.to)) {
      return [];
    }

    if (periodType === "year") {
      groupByDay = false;
    } else if (periodType === "custom") {
      const daysDiff = differenceInDays(endDate, startDate);
      groupByDay = daysDiff <= 60;
    }

    let cumulativeBalance = 0;

    if (groupByDay) {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      return days.map((day) => {
        let income = 0;
        let expenses = 0;

        transactions.forEach((t) => {
          const txDate = parseISO(t.date);
          if (isSameDay(txDate, day)) {
            if (t.type === "income") {
              income += t.amount;
            } else {
              expenses += t.amount;
            }
          }
        });

        cumulativeBalance += income - expenses;

        return {
          label: format(day, "dd MMM", { locale: it }),
          entrate: income,
          uscite: expenses,
          saldo: income - expenses,
          cumulativo: cumulativeBalance,
        };
      });
    } else {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      return months.map((month) => {
        let income = 0;
        let expenses = 0;

        transactions.forEach((t) => {
          const txDate = parseISO(t.date);
          if (isSameMonth(txDate, month) && getYear(txDate) === getYear(month)) {
            if (t.type === "income") {
              income += t.amount;
            } else {
              expenses += t.amount;
            }
          }
        });

        cumulativeBalance += income - expenses;

        return {
          label: format(month, "MMM yyyy", { locale: it }),
          entrate: income,
          uscite: expenses,
          saldo: income - expenses,
          cumulativo: cumulativeBalance,
        };
      });
    }
  }, [transactions, periodType, periodDateRange, customDateRange]);

  // Build navigation links
  const buildFilterUrl = (type?: "income" | "expense") => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    params.set("dateFrom", format(periodDateRange.startDate, "yyyy-MM-dd"));
    params.set("dateTo", format(periodDateRange.endDate, "yyyy-MM-dd"));
    return `/transactions?${params.toString()}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-40 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Panoramica delle tue finanze
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            exportDashboardToPdf({
              periodLabel,
              totalBalance: stats.totalBalance,
              periodIncome: stats.periodIncome,
              periodExpenses: stats.periodExpenses,
              netSavings: stats.netSavings,
              spendingByCategory: stats.spendingByCategory,
              incomeByCategory: stats.incomeByCategory,
              dateFrom: periodDateRange.startDate,
              dateTo: periodDateRange.endDate,
            });
            toast.success("Report Dashboard esportato in PDF!");
          }}
        >
          <FileDown className="h-4 w-4 mr-2" />
          Esporta PDF
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Saldo Totale"
          value={stats.totalBalance}
          subtitle="Bilancio complessivo"
          icon={<Wallet className="h-4 w-4 text-primary" />}
          variant="default"
        />
        <StatCard
          title="Entrate"
          value={stats.periodIncome}
          subtitle={periodLabel}
          icon={<TrendingUp className="h-4 w-4 text-success" />}
          variant="success"
          comparison={incomeComparison}
          linkTo={buildFilterUrl("income")}
        />
        <StatCard
          title="Uscite"
          value={stats.periodExpenses}
          subtitle={periodLabel}
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
          variant="destructive"
          comparison={expensesComparison}
          linkTo={buildFilterUrl("expense")}
        />
        <StatCard
          title="Netto"
          value={stats.netSavings}
          subtitle={`${stats.netSavings >= 0 ? "Risparmiato" : "Perdita"} - ${periodLabel}`}
          icon={
            <ArrowUpRight
              className={`h-4 w-4 ${
                stats.netSavings >= 0 ? "text-success" : "text-destructive"
              }`}
            />
          }
          variant="neutral"
          comparison={netComparison}
          linkTo={buildFilterUrl()}
        />
      </div>

      {/* Period Comparison Section */}
      <PeriodComparisonCard
        transactions={transactions}
        availableYears={availableYears}
      />

      {/* Middle Section: Category Breakdowns + Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <CategoryBreakdownCard
          title="Spese per Categoria"
          periodLabel={periodLabel}
          categories={stats.spendingByCategory}
          total={stats.periodExpenses}
          type="expense"
          emptyMessage="Nessuna spesa nel periodo selezionato"
          dateRange={periodDateRange}
        />
        <CategoryBreakdownCard
          title="Entrate per Categoria"
          periodLabel={periodLabel}
          categories={stats.incomeByCategory}
          total={stats.periodIncome}
          type="income"
          emptyMessage="Nessuna entrata nel periodo selezionato"
          dateRange={periodDateRange}
        />
        <InsightsCard
          topExpenseCategory={stats.topExpenseCategory}
          topIncomeCategory={stats.topIncomeCategory}
          savingsRate={stats.savingsRate}
          avgDailyExpense={stats.avgDailyExpense}
          periodLabel={periodLabel}
        />
      </div>

      {/* Recent Transactions */}
      <RecentTransactionsCard
        periodTransactions={stats.periodTransactions}
        allTransactions={transactions}
        dateRange={periodDateRange}
      />

      {/* Financial Trend Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground">Andamento Finanziario</CardTitle>
            
            <div className="flex items-center gap-4">
              {periodType === "year" && (
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Button
                variant={showCumulative ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCumulative(!showCumulative)}
              >
                Saldo cumulato
              </Button>
            </div>
          </div>
          
          {/* Period Selection Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              <Button
                variant={periodType === "thisMonth" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodType("thisMonth")}
              >
                Questo mese
              </Button>
              <Button
                variant={periodType === "threeMonths" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodType("threeMonths")}
              >
                3 mesi
              </Button>
              <Button
                variant={periodType === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodType("year")}
              >
                Anno
              </Button>
              <Button
                variant={periodType === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodType("custom")}
              >
                Personalizzato
              </Button>
            </div>
            
            {/* Custom Date Pickers */}
            {periodType === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {customDateRange.from 
                        ? format(customDateRange.from, "dd/MM/yyyy") 
                        : "Data inizio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateRange.from}
                      onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">→</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {customDateRange.to 
                        ? format(customDateRange.to, "dd/MM/yyyy") 
                        : "Data fine"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateRange.to}
                      onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-muted-foreground text-center py-16">
              {periodType === "custom" && (!customDateRange.from || !customDateRange.to)
                ? "Seleziona un periodo personalizzato"
                : "Nessun dato per il periodo selezionato"}
            </p>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `€${value}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="entrate"
                    name="Entrate"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--success))", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uscite"
                    name="Uscite"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--destructive))", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  {showCumulative && (
                    <Line
                      type="monotone"
                      dataKey="cumulativo"
                      name="Cumulato"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
