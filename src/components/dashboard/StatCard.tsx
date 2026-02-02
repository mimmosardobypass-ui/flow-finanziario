import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PeriodComparison } from "@/hooks/useDashboardStats";

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
  variant?: "default" | "success" | "destructive" | "neutral";
  comparison?: PeriodComparison;
  linkTo?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  comparison,
  linkTo,
}: StatCardProps) {
  const navigate = useNavigate();

  const valueColorClass = {
    default: "text-foreground",
    success: "text-success",
    destructive: "text-destructive",
    neutral: value >= 0 ? "text-foreground" : "text-destructive",
  }[variant];

  const handleClick = () => {
    if (linkTo) {
      navigate(linkTo);
    }
  };

  return (
    <Card
      className={cn(
        "bg-card border-border transition-all",
        linkTo && "cursor-pointer hover:border-primary/50 hover:shadow-md"
      )}
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueColorClass)}>
          €{value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {comparison && comparison.previous > 0 && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                comparison.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {comparison.delta >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {comparison.delta >= 0 ? "+" : ""}
                {comparison.deltaPercent}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
