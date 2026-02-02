import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TransactionWithCategory } from "@/hooks/useTransactions";
import { DateRange } from "@/hooks/useDashboardStats";

interface RecentTransactionsCardProps {
  periodTransactions: TransactionWithCategory[];
  allTransactions: TransactionWithCategory[];
  dateRange: DateRange;
}

export function RecentTransactionsCard({
  periodTransactions,
  allTransactions,
  dateRange,
}: RecentTransactionsCardProps) {
  const navigate = useNavigate();
  const [showPeriodOnly, setShowPeriodOnly] = useState(true);

  const transactions = showPeriodOnly
    ? periodTransactions.slice(0, 5)
    : allTransactions.slice(0, 5);

  const handleTransactionClick = (transaction: TransactionWithCategory) => {
    const params = new URLSearchParams();
    if (transaction.category_id) {
      params.set("categoryId", transaction.category_id);
    } else {
      params.set("categoryId", "uncategorized");
    }
    params.set("type", transaction.type);
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Transazioni Recenti</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="period-toggle" className="text-xs text-muted-foreground">
              Solo periodo
            </Label>
            <Switch
              id="period-toggle"
              checked={showPeriodOnly}
              onCheckedChange={setShowPeriodOnly}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {showPeriodOnly
              ? "Nessuna transazione nel periodo"
              : "Nessuna transazione ancora"}
          </p>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors"
                onClick={() => handleTransactionClick(transaction)}
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {transaction.description || "Senza descrizione"}
                      </p>
                      {!transaction.categories && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-warning border-warning/50">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          No cat.
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(transaction.date), "dd MMM", {
                        locale: it,
                      })}
                      {transaction.categories && (
                        <span className="ml-1.5">• {transaction.categories.name}</span>
                      )}
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
  );
}
