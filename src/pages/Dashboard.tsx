import React, { useMemo, useState } from "react";
import { 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  getMonth, 
  getYear,
  subMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  isSameDay,
  isSameMonth,
  differenceInDays
} from "date-fns";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
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
import { cn } from "@/lib/utils";
import { exportDashboardToPdf } from "@/utils/exportDashboardPdf";
import { toast } from "sonner";

type PeriodType = "thisMonth" | "threeMonths" | "year" | "custom";

// Custom Tooltip for the chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
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

  // Get available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach((t) => {
      years.add(getYear(new Date(t.date)));
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Calculate chart data based on selected period
  const chartData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let groupByDay = true;

    switch (periodType) {
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        groupByDay = true;
        break;
      case "threeMonths":
        startDate = startOfMonth(subMonths(now, 2));
        endDate = endOfMonth(now);
        groupByDay = true;
        break;
      case "year":
        startDate = startOfYear(new Date(selectedYear, 0, 1));
        endDate = endOfYear(new Date(selectedYear, 0, 1));
        groupByDay = false;
        break;
      case "custom":
        if (!customDateRange.from || !customDateRange.to) {
          return [];
        }
        startDate = customDateRange.from;
        endDate = customDateRange.to;
        const daysDiff = differenceInDays(endDate, startDate);
        groupByDay = daysDiff <= 60;
        break;
      default:
        return [];
    }

    if (groupByDay) {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      return days.map((day) => {
        let income = 0;
        let expenses = 0;

        transactions.forEach((t) => {
          const txDate = new Date(t.date);
          if (isSameDay(txDate, day)) {
            if (t.type === "income") {
              income += t.amount;
            } else {
              expenses += t.amount;
            }
          }
        });

        return {
          label: format(day, "dd MMM", { locale: it }),
          entrate: income,
          uscite: expenses,
          saldo: income - expenses,
        };
      });
    } else {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      return months.map((month) => {
        let income = 0;
        let expenses = 0;

        transactions.forEach((t) => {
          const txDate = new Date(t.date);
          if (isSameMonth(txDate, month) && getYear(txDate) === getYear(month)) {
            if (t.type === "income") {
              income += t.amount;
            } else {
              expenses += t.amount;
            }
          }
        });

        return {
          label: format(month, "MMM yyyy", { locale: it }),
          entrate: income,
          uscite: expenses,
          saldo: income - expenses,
        };
      });
    }
  }, [transactions, periodType, selectedYear, customDateRange]);

  // Calculate period date range based on periodType
  const periodDateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodType) {
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "threeMonths":
        startDate = startOfMonth(subMonths(now, 2));
        endDate = endOfMonth(now);
        break;
      case "year":
        startDate = startOfYear(new Date(selectedYear, 0, 1));
        endDate = endOfYear(new Date(selectedYear, 0, 1));
        break;
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          startDate = customDateRange.from;
          endDate = customDateRange.to;
        } else {
          startDate = new Date(0);
          endDate = new Date(0);
        }
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    return { startDate, endDate };
  }, [periodType, selectedYear, customDateRange]);

  // Get period label for display
  const periodLabel = useMemo(() => {
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
  }, [periodType, selectedYear, customDateRange]);

  const stats = useMemo(() => {
    const { startDate, endDate } = periodDateRange;

    let totalBalance = 0;
    let periodIncome = 0;
    let periodExpenses = 0;
    const categoryTotals: Record<string, { name: string; amount: number }> = {};
    const incomeCategoryTotals: Record<string, { name: string; amount: number }> = {};

    transactions.forEach((t) => {
      const amount = t.type === "income" ? t.amount : -t.amount;
      totalBalance += amount;

      const txDate = new Date(t.date);
      const isInPeriod = isWithinInterval(txDate, {
        start: startDate,
        end: endDate,
      });

      if (isInPeriod) {
        if (t.type === "income") {
          periodIncome += t.amount;

          if (t.categories) {
            const catId = t.categories.id;
            if (!incomeCategoryTotals[catId]) {
              incomeCategoryTotals[catId] = { name: t.categories.name, amount: 0 };
            }
            incomeCategoryTotals[catId].amount += t.amount;
          }
        } else {
          periodExpenses += t.amount;

          if (t.categories) {
            const catId = t.categories.id;
            if (!categoryTotals[catId]) {
              categoryTotals[catId] = { name: t.categories.name, amount: 0 };
            }
            categoryTotals[catId].amount += t.amount;
          }
        }
      }
    });

    const expenseColors = [
      "bg-primary",
      "bg-warning", 
      "bg-destructive",
      "bg-accent",
      "bg-muted-foreground",
      "bg-primary/70",
      "bg-warning/70",
      "bg-destructive/70",
    ];

    const incomeColors = [
      "bg-success",
      "bg-primary",
      "bg-success/70",
      "bg-primary/70",
      "bg-accent",
      "bg-success/50",
      "bg-primary/50",
      "bg-accent/70",
    ];

    const sortedCategories = Object.values(categoryTotals)
      .sort((a, b) => b.amount - a.amount)
      .map((cat, index) => ({
        ...cat,
        percentage:
          periodExpenses > 0
            ? Math.round((cat.amount / periodExpenses) * 100)
            : 0,
        color: expenseColors[index % expenseColors.length],
      }));

    const sortedIncomeCategories = Object.values(incomeCategoryTotals)
      .sort((a, b) => b.amount - a.amount)
      .map((cat, index) => ({
        ...cat,
        percentage:
          periodIncome > 0
            ? Math.round((cat.amount / periodIncome) * 100)
            : 0,
        color: incomeColors[index % incomeColors.length],
      }));

    return {
      totalBalance,
      periodIncome,
      periodExpenses,
      netSavings: periodIncome - periodExpenses,
      spendingByCategory: sortedCategories,
      incomeByCategory: sortedIncomeCategories,
      recentTransactions: transactions.slice(0, 5),
    };
  }, [transactions, periodDateRange]);

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
        {/* Total Balance */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Totale
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              €{stats.totalBalance.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bilancio complessivo
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entrate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              €{stats.periodIncome.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Uscite
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              €{stats.periodExpenses.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          </CardContent>
        </Card>

        {/* Net */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Netto
            </CardTitle>
            <ArrowUpRight
              className={`h-4 w-4 ${
                stats.netSavings >= 0 ? "text-success" : "text-destructive"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.netSavings >= 0 ? "text-foreground" : "text-destructive"
              }`}
            >
              €{stats.netSavings.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.netSavings >= 0 ? "Risparmiato" : "Perdita"} - {periodLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Transazioni Recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentTransactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nessuna transazione ancora
              </p>
            ) : (
              <div className="space-y-4">
                {stats.recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center ${
                          transaction.type === "income"
                            ? "bg-success/20"
                            : "bg-destructive/20"
                        }`}
                      >
                        {transaction.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {transaction.description || "Senza descrizione"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transaction.date), "dd MMM", {
                            locale: it,
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        transaction.type === "income"
                          ? "text-success"
                          : "text-destructive"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}€
                      {transaction.amount.toLocaleString("it-IT", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Spese per Categoria</CardTitle>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardHeader>
          <CardContent>
            {stats.spendingByCategory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nessuna spesa nel periodo selezionato
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.spendingByCategory.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate max-w-[60%]">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        €{item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income by Category */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Entrate per Categoria</CardTitle>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardHeader>
          <CardContent>
            {stats.incomeByCategory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nessuna entrata nel periodo selezionato
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.incomeByCategory.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate max-w-[60%]">
                        {item.name}
                      </span>
                      <span className="text-xs text-success">
                        €{item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Trend Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground">Andamento Finanziario</CardTitle>
            
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
