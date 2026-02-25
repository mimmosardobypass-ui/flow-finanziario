import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionWithCategory } from "./useTransactions";

export function useCompatibleTransactions(transaction: TransactionWithCategory | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["compatible-transactions", transaction?.id],
    queryFn: async () => {
      if (!user || !transaction) return [];

      // Get transactions from OTHER accounts with similar amount or date (±3 days)
      const dateObj = new Date(transaction.date);
      const dateFrom = new Date(dateObj);
      dateFrom.setDate(dateFrom.getDate() - 3);
      const dateTo = new Date(dateObj);
      dateTo.setDate(dateTo.getDate() + 3);

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          categories ( id, name, type ),
          conti ( id, nome_conto, banca )
        `)
        .is("deleted_at", null)
        .neq("conto_id", transaction.conto_id)
        .neq("id", transaction.id)
        .or(
          `amount.eq.${transaction.amount},and(date.gte.${dateFrom.toISOString().split("T")[0]},date.lte.${dateTo.toISOString().split("T")[0]})`
        )
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as TransactionWithCategory[];
    },
    enabled: !!user && !!transaction,
  });
}

export function useReconciliationGroup(reconciliationId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["reconciliation-group", reconciliationId],
    queryFn: async () => {
      if (!user || !reconciliationId) return [];

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          categories ( id, name, type ),
          conti ( id, nome_conto, banca )
        `)
        .eq("reconciliation_id", reconciliationId)
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as TransactionWithCategory[];
    },
    enabled: !!user && !!reconciliationId,
  });
}

function computeStatus(transactions: { type: string; amount: number }[]): "partial" | "complete" {
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return Math.abs(totalIncome - totalExpense) < 0.01 ? "complete" : "partial";
}

export function useReconcile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionIds, reconciliationType = "transfer" }: { transactionIds: string[]; reconciliationType?: string }) => {
      if (!user || transactionIds.length < 2) throw new Error("Seleziona almeno 2 transazioni");

      const reconciliation_id = crypto.randomUUID();

      // Fetch selected transactions to compute status
      const { data: txns, error: fetchError } = await supabase
        .from("transactions")
        .select("id, type, amount, reconciliation_id")
        .in("id", transactionIds)
        .is("deleted_at", null);

      if (fetchError) throw fetchError;

      // Check if any already have a reconciliation_id — merge into existing group
      const existingGroupId = txns?.find((t) => t.reconciliation_id)?.reconciliation_id;
      const finalId = existingGroupId || reconciliation_id;

      // If merging, also fetch existing group members
      let allTxns = txns || [];
      if (existingGroupId) {
        const { data: groupTxns } = await supabase
          .from("transactions")
          .select("id, type, amount, reconciliation_id")
          .eq("reconciliation_id", existingGroupId)
          .is("deleted_at", null);
        
        // Merge unique
        const existingIds = new Set(allTxns.map((t) => t.id));
        groupTxns?.forEach((t) => {
          if (!existingIds.has(t.id)) allTxns.push(t);
        });
      }

      const status = computeStatus(allTxns);

      // Update all transactions in the group
      const allIds = allTxns.map((t) => t.id);
      const { error } = await supabase
        .from("transactions")
        .update({ reconciliation_id: finalId, reconciliation_status: status, reconciliation_type: reconciliationType } as any)
        .in("id", allIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-group"] });
      queryClient.invalidateQueries({ queryKey: ["compatible-transactions"] });
    },
  });
}

export function useUnreconcile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reconciliationId: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ reconciliation_id: null, reconciliation_status: "none", reconciliation_type: null } as any)
        .eq("reconciliation_id", reconciliationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-group"] });
      queryClient.invalidateQueries({ queryKey: ["compatible-transactions"] });
    },
  });
}
