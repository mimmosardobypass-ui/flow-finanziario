import React, { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, Minus, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionWithCategory } from "@/hooks/useTransactions";
import { getMonthDateRange, usePeriodComparison, DateRange } from "@/hooks/useDashboardStats";

interface PeriodComparisonCardProps {
  transactions: TransactionWithCategory[];
  availableYears: number[];
}

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const formatCurrency = (value: number): string => {
  return `€${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDelta = (delta: number, prefix = true): string => {
  const sign = delta >= 0 ? "+" : "";
  const formatted = `€${Math.abs(delta).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return prefix ? `${sign}${formatted}` : formatted;
};

const formatPercent = (percent: number): string => {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent}%`;
};

export function PeriodComparisonCard({ transactions, availableYears }: PeriodComparisonCardProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const [periodA, setPeriodA] = useState({ month: currentMonth, year: currentYear });
  const [periodB, setPeriodB] = useState({ month: prevMonth, year: prevYear });

  const rangeA: DateRange = useMemo(
    () => getMonthDateRange(periodA.month, periodA.year),
    [periodA.month, periodA.year]
  );

  const rangeB: DateRange = useMemo(
    () => getMonthDateRange(periodB.month, periodB.year),
    [periodB.month, periodB.year]
  );

  // Use Period A as "current" and Period B as "previous" for comparison
  const { incomeComparison, expensesComparison, netComparison } = usePeriodComparison(
    transactions,
    rangeA,
    rangeB
  );

  const periodALabel = `${MONTHS[periodA.month]} ${periodA.year}`;
  const periodBLabel = `${MONTHS[periodB.month]} ${periodB.year}`;

  const rows = [
    {
      label: "Entrate",
      valueA: incomeComparison.current,
      valueB: incomeComparison.previous,
      delta: incomeComparison.delta,
      deltaPercent: incomeComparison.deltaPercent,
      isPositive: incomeComparison.isPositive,
    },
    {
      label: "Uscite",
      valueA: expensesComparison.current,
      valueB: expensesComparison.previous,
      delta: expensesComparison.delta,
      deltaPercent: expensesComparison.deltaPercent,
      isPositive: expensesComparison.isPositive,
    },
    {
      label: "Netto",
      valueA: netComparison.current,
      valueB: netComparison.previous,
      delta: netComparison.delta,
      deltaPercent: netComparison.deltaPercent,
      isPositive: netComparison.isPositive,
    },
  ];

  const TrendIcon = ({ isPositive, delta }: { isPositive: boolean; delta: number }) => {
    if (delta === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (isPositive) return <ArrowUp className="h-4 w-4 text-success" />;
    return <ArrowDown className="h-4 w-4 text-destructive" />;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Scale className="h-5 w-5 text-primary" />
          Comparazione Periodi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period A */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/50">
            <Label className="text-sm font-medium text-muted-foreground">Periodo A</Label>
            <div className="flex gap-2">
              <Select
                value={periodA.month.toString()}
                onValueChange={(v) => setPeriodA((p) => ({ ...p, month: parseInt(v) }))}
              >
                <SelectTrigger className="flex-1 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={periodA.year.toString()}
                onValueChange={(v) => setPeriodA((p) => ({ ...p, year: parseInt(v) }))}
              >
                <SelectTrigger className="w-[100px] bg-background">
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
            </div>
          </div>

          {/* Period B */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/50">
            <Label className="text-sm font-medium text-muted-foreground">Periodo B</Label>
            <div className="flex gap-2">
              <Select
                value={periodB.month.toString()}
                onValueChange={(v) => setPeriodB((p) => ({ ...p, month: parseInt(v) }))}
              >
                <SelectTrigger className="flex-1 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={periodB.year.toString()}
                onValueChange={(v) => setPeriodB((p) => ({ ...p, year: parseInt(v) }))}
              >
                <SelectTrigger className="w-[100px] bg-background">
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
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Metrica</TableHead>
                <TableHead className="text-right font-semibold">{periodALabel}</TableHead>
                <TableHead className="text-right font-semibold">{periodBLabel}</TableHead>
                <TableHead className="text-right font-semibold">Delta</TableHead>
                <TableHead className="text-right font-semibold">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.valueA)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(row.valueB)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 tabular-nums ${
                        row.isPositive ? "text-success" : "text-destructive"
                      }`}
                    >
                      <TrendIcon isPositive={row.isPositive} delta={row.delta} />
                      {formatDelta(row.delta)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`tabular-nums ${
                        row.isPositive ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatPercent(row.deltaPercent)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
