import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockTransactions = [
  { id: 1, description: "Stipendio", amount: 2500, type: "income", date: "15 Dic" },
  { id: 2, description: "Affitto", amount: -800, type: "expense", date: "14 Dic" },
  { id: 3, description: "Spesa alimentare", amount: -120, type: "expense", date: "13 Dic" },
  { id: 4, description: "Freelance", amount: 450, type: "income", date: "12 Dic" },
  { id: 5, description: "Bollette", amount: -95, type: "expense", date: "11 Dic" },
];

const spendingByCategory = [
  { category: "Abitazione", amount: 800, percentage: 45, color: "bg-primary" },
  { category: "Alimentari", amount: 320, percentage: 25, color: "bg-warning" },
  { category: "Trasporti", amount: 180, percentage: 15, color: "bg-destructive" },
  { category: "Altro", amount: 120, percentage: 15, color: "bg-muted-foreground" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Panoramica delle tue finanze</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Balance */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Totale</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">€12.450,00</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-success">+2.5%</span> rispetto al mese scorso
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entrate</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">€2.950,00</div>
            <p className="text-xs text-muted-foreground mt-1">Questo mese</p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uscite</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">€1.420,00</div>
            <p className="text-xs text-muted-foreground mt-1">Questo mese</p>
          </CardContent>
        </Card>

        {/* Net */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Netto</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">€1.530,00</div>
            <p className="text-xs text-muted-foreground mt-1">Risparmiato questo mese</p>
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
            <div className="space-y-4">
              {mockTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                      transaction.type === "income" ? "bg-success/20" : "bg-destructive/20"
                    }`}>
                      {transaction.type === "income" ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">{transaction.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    transaction.type === "income" ? "text-success" : "text-destructive"
                  }`}>
                    {transaction.type === "income" ? "+" : ""}€{Math.abs(transaction.amount).toLocaleString("it-IT")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Spese per Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {spendingByCategory.map((item) => (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{item.category}</span>
                    <span className="text-sm text-muted-foreground">€{item.amount.toLocaleString("it-IT")}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
