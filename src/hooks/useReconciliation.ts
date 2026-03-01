import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionWithCategory } from "./useTransactions";

// Helper: find or create "Giroconti" category for a user
async function getOrCreateGirocontiCategory(userId: string): Promise<string> {
  const { data: existingCat } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Giroconti")
    .maybeSingle();

  if (existingCat?.id) return existingCat.id;

  const { data: newCat, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: "Giroconti", type: "expense" })
    .select("id")
    .single();
  if (error) throw error;
  return newCat.id;
}

// Helper: get IDs of "Da classificare" categories for a user
async function getDaClassificareIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Da classificare");
  return new Set(data?.map((c) => c.id) || []);
}

export { getOrCreateGirocontiCategory, getDaClassificareIds };

export function useCompatibleTransactions(transaction: TransactionWithCategory | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["compatible-transactions", transaction?.id],
    queryFn: async () => {
      if (!user || !transaction) return [];

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

      const { data: txns, error: fetchError } = await supabase
        .from("transactions")
        .select("id, type, amount, reconciliation_id")
        .in("id", transactionIds)
        .is("deleted_at", null);

      if (fetchError) throw fetchError;

      const existingGroupId = txns?.find((t) => t.reconciliation_id)?.reconciliation_id;
      const finalId = existingGroupId || reconciliation_id;

      let allTxns = txns || [];
      if (existingGroupId) {
        const { data: groupTxns } = await supabase
          .from("transactions")
          .select("id, type, amount, reconciliation_id")
          .eq("reconciliation_id", existingGroupId)
          .is("deleted_at", null);

        const existingIds = new Set(allTxns.map((t) => t.id));
        groupTxns?.forEach((t) => {
          if (!existingIds.has(t.id)) allTxns.push(t);
        });
      }

      const status = computeStatus(allTxns);
      const allIds = allTxns.map((t) => t.id);

      const { error } = await supabase
        .from("transactions")
        .update({ reconciliation_id: finalId, reconciliation_status: status, reconciliation_type: reconciliationType } as any)
        .in("id", allIds);

      if (error) throw error;

      // Auto-assign "Giroconti" category for transfer reconciliations
      if (reconciliationType === "transfer") {
        const girocontiCatId = await getOrCreateGirocontiCategory(user.id);
        const daClassificareIds = await getDaClassificareIds(user.id);

        // Fetch full records to check category_id
        const { data: fullTxns } = await supabase
          .from("transactions")
          .select("id, category_id")
          .in("id", allIds);

        const idsToUpdate = fullTxns
          ?.filter((t) => !t.category_id || daClassificareIds.has(t.category_id))
          .map((t) => t.id) || [];

        if (idsToUpdate.length > 0) {
          await supabase
            .from("transactions")
            .update({ category_id: girocontiCatId })
            .in("id", idsToUpdate);
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

      const { data: girocontiCat } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Giroconti")
        .maybeSingle();

      if (girocontiCat) {
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
