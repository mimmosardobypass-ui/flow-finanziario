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

// Legacy computeStatus aligned to official state machine: always returns "reconciled"
function computeStatus(_transactions: { type: string; amount: number }[]): "reconciled" {
  return "reconciled";
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

      // Auto-assign "Giroconti" category for transfer reconciliations
      if (reconciliationType === "transfer") {
        // Find or create the "Giroconti" category
        const { data: existingCat } = await supabase
          .from("categories")
          .select("id")
          .eq("user_id", user.id)
          .eq("name", "Giroconti")
          .maybeSingle();

        let girocontiCatId = existingCat?.id;

        if (!girocontiCatId) {
          const { data: newCat, error: catError } = await supabase
            .from("categories")
            .insert({ user_id: user.id, name: "Giroconti", type: "expense" })
            .select("id")
            .single();
          if (catError) throw catError;
          girocontiCatId = newCat.id;
        }

        // Assign category only to transactions without one
        const uncategorizedIds = allTxns
          .filter((t) => !(t as any).category_id)
          .map((t) => t.id);

        if (uncategorizedIds.length > 0) {
          // Need to fetch full records to check category_id since our select didn't include it
          const { data: fullTxns } = await supabase
            .from("transactions")
            .select("id, category_id")
            .in("id", allIds)
            .is("category_id", null);

          const idsToUpdate = fullTxns?.map((t) => t.id) || [];
          if (idsToUpdate.length > 0) {
            await supabase
              .from("transactions")
              .update({ category_id: girocontiCatId })
              .in("id", idsToUpdate);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-group"] });
      queryClient.invalidateQueries({ queryKey: ["compatible-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUnreconcile() {
  const queryClient = useQueryClient();

  const { user } = useAuth();

  return useMutation({
    mutationFn: async (reconciliationId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Find "Giroconti" category to remove it from affected transactions
      const { data: girocontiCat } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Giroconti")
        .maybeSingle();

      if (girocontiCat) {
        // Reset category only for transactions that have "Giroconti"
        await supabase
          .from("transactions")
          .update({ category_id: null })
          .eq("reconciliation_id", reconciliationId)
          .eq("category_id", girocontiCat.id);
      }

      const { error } = await supabase
        .from("transactions")
        .update({ reconciliation_id: null, reconciliation_status: "none" as string, reconciliation_type: null } as any)
        .eq("reconciliation_id", reconciliationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-group"] });
      queryClient.invalidateQueries({ queryKey: ["compatible-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
