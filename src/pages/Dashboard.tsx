import { useMemo } from "react";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "@/hooks/useTransactions";

export default function Dashboard() {
  const { data: transactions = [], isLoading } = useTransactions();

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let totalBalance = 0;
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const categoryTotals: Record<string, { name: string; amount: number }> = {};

    transactions.forEach((t) => {
      const amount = t.type === "income" ? t.amount : -t.amount;
      totalBalance += amount;

      const txDate = new Date(t.date);
      const isThisMonth = isWithinInterval(txDate, {
        start: monthStart,
        end: monthEnd,
      });

      if (isThisMonth) {
        if (t.type === "income") {
          monthlyIncome += t.amount;
        } else {
          monthlyExpenses += t.amount;

          // Track category spending
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

    // Convert category totals to sorted array with percentages
    const colors = [
      "bg-primary",
      "bg-warning", 
      "bg-destructive",
      "bg-success",
      "bg-accent",
      "bg-muted-foreground",
      "bg-primary/70",
      "bg-warning/70",
    ];
    const sortedCategories = Object.values(categoryTotals)
      .sort((a, b) => b.amount - a.amount)
      .map((cat, index) => ({
        ...cat,
        percentage:
          monthlyExpenses > 0
            ? Math.round((cat.amount / monthlyExpenses) * 100)
            : 0,
        color: colors[index % colors.length],
      }));

    return {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      netSavings: monthlyIncome - monthlyExpenses,
      spendingByCategory: sortedCategories,
      recentTransactions: transactions.slice(0, 5),
    };
  }, [transactions]);

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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Panoramica delle tue finanze
        </p>
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
              €{stats.monthlyIncome.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Questo mese</p>
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
              €{stats.monthlyExpenses.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Questo mese</p>
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
              {stats.netSavings >= 0 ? "Risparmiato" : "Perdita"} questo mese
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
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
          </CardHeader>
          <CardContent>
            {stats.spendingByCategory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nessuna spesa questo mese
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
      </div>
    </div>
  );
}
