import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Receipt, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionDialog } from "@/components/TransactionDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
  useTransactions,
  useDeleteTransaction,
  TransactionWithCategory,
} from "@/hooks/useTransactions";
import { toast } from "@/hooks/use-toast";

export default function Transactions() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithCategory | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const { data: transactions = [], isLoading } = useTransactions();
  const deleteMutation = useDeleteTransaction();

  const filteredTransactions = transactions.filter((t) => {
    if (filter === "all") return true;
    return t.type === filter;
  });

  const handleEdit = (transaction: TransactionWithCategory) => {
    setSelectedTransaction(transaction);
    setDialogOpen(true);
  };

  const handleDelete = (transaction: TransactionWithCategory) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTransaction) return;
    try {
      await deleteMutation.mutateAsync(selectedTransaction.id);
      toast({ title: "Transazione eliminata" });
      setDeleteDialogOpen(false);
      setSelectedTransaction(null);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la transazione",
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    setSelectedTransaction(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Transazioni
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci le tue entrate e uscite
          </p>
        </div>
        <Button className="gap-2" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova Transazione</span>
        </Button>
      </div>

      {transactions.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nessuna transazione
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Non hai ancora registrato nessuna transazione. Inizia ad aggiungere
              le tue entrate e uscite.
            </p>
            <Button className="gap-2" onClick={handleAddNew}>
              <Plus className="h-4 w-4" />
              Aggiungi la prima transazione
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-4 md:p-6">
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
              className="mb-4"
            >
              <TabsList>
                <TabsTrigger value="all">Tutte</TabsTrigger>
                <TabsTrigger value="income">Entrate</TabsTrigger>
                <TabsTrigger value="expense">Uscite</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="hidden md:table-cell">Categoria</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="w-[100px]">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {format(new Date(transaction.date), "dd MMM", {
                          locale: it,
                        })}
                      </TableCell>
                      <TableCell>{transaction.description || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {transaction.categories ? (
                          <Badge variant="secondary">
                            {transaction.categories.name}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          transaction.type === "income"
                            ? "text-success"
                            : "text-destructive"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}€
                        {transaction.amount.toLocaleString("it-IT", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(transaction)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={selectedTransaction}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
