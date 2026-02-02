import { Lightbulb, TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBreakdown } from "@/hooks/useDashboardStats";

interface InsightsCardProps {
  topExpenseCategory: CategoryBreakdown | null;
  topIncomeCategory: CategoryBreakdown | null;
  savingsRate: number;
  avgDailyExpense: number;
  periodLabel: string;
}

export function InsightsCard({
  topExpenseCategory,
  topIncomeCategory,
  savingsRate,
  avgDailyExpense,
  periodLabel,
}: InsightsCardProps) {
  const insights = [
    topExpenseCategory && {
      icon: <TrendingDown className="h-4 w-4 text-destructive" />,
      label: "Spesa principale",
      value: topExpenseCategory.name,
      subValue: `€${topExpenseCategory.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })} (${topExpenseCategory.percentage}%)`,
    },
    topIncomeCategory && {
      icon: <TrendingUp className="h-4 w-4 text-success" />,
      label: "Entrata principale",
      value: topIncomeCategory.name,
      subValue: `€${topIncomeCategory.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })} (${topIncomeCategory.percentage}%)`,
    },
    {
      icon: <PiggyBank className="h-4 w-4 text-primary" />,
      label: "Tasso di risparmio",
      value: `${savingsRate}%`,
      subValue: savingsRate >= 20 ? "Ottimo!" : savingsRate >= 10 ? "Buono" : "Da migliorare",
    },
    {
      icon: <Wallet className="h-4 w-4 text-muted-foreground" />,
      label: "Spesa media giornaliera",
      value: `€${avgDailyExpense.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
      subValue: periodLabel,
    },
  ].filter(Boolean);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-warning" />
          Insight
        </CardTitle>
        <p className="text-xs text-muted-foreground">{periodLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-2 rounded-md bg-muted/30"
            >
              <div className="mt-0.5">{insight!.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{insight!.label}</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {insight!.value}
                </p>
                <p className="text-xs text-muted-foreground">{insight!.subValue}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
