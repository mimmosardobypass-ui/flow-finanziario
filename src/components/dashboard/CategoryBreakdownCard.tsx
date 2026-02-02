import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CategoryBreakdown, DateRange } from "@/hooks/useDashboardStats";
import { format } from "date-fns";

interface CategoryBreakdownCardProps {
  title: string;
  periodLabel: string;
  categories: CategoryBreakdown[];
  total: number;
  type: "income" | "expense";
  emptyMessage: string;
  dateRange: DateRange;
}

export function CategoryBreakdownCard({
  title,
  periodLabel,
  categories,
  total,
  type,
  emptyMessage,
  dateRange,
}: CategoryBreakdownCardProps) {
  const navigate = useNavigate();

  const handleCategoryClick = (categoryId: string) => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (categoryId === "uncategorized") {
      params.set("categoryId", "uncategorized");
    } else {
      params.set("categoryId", categoryId);
    }
    params.set("dateFrom", format(dateRange.startDate, "yyyy-MM-dd"));
    params.set("dateTo", format(dateRange.endDate, "yyyy-MM-dd"));
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{periodLabel}</p>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {categories.map((item) => (
                <div
                  key={item.id}
                  className="space-y-1 cursor-pointer hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors"
                  onClick={() => handleCategoryClick(item.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.id === "uncategorized" && (
                        <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground truncate">
                        {item.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {item.percentage}%
                      </Badge>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium flex-shrink-0",
                        type === "income" ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      €{item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", item.color)}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Verifiable total */}
            <div className="pt-2 mt-2 border-t border-border">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-muted-foreground">Totale</span>
                <span className={type === "income" ? "text-success" : "text-destructive"}>
                  €{total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
