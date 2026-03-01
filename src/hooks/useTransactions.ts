import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateSuggestionsForIds } from "./useReconciliationSuggestions";

export interface Transaction {
  id: string;
  user_id: string;
  description: string | null;
  amount: number;
  type: "income" | "expense";
  date: string;
  category_id: string | null;
  rata_id: string | null;
  conto_id: string;
  created_at: string;
  deleted_at: string | null;
  transfer_id: string | null;
  reconciliation_id: string | null;
  reconciliation_status: string;
  reconciliation_type: string | null;
}

export interface TransactionWithCategory extends Transaction {
  categories: {
    id: string;
    name: string;
    type: string;
  } | null;
  conti: {
    id: string;
    nome_conto: string;
    banca: string | null;
  } | null;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category_id: string | null;
  conto_id: string;
  rata_id?: string | null;
  transfer_id?: string | null;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string;
}

export interface CreateTransferInput {
  amount: number;
  date: string;
  description: string;
  contoOrigineId: string;
  contoDestinazioneId: string;
  commissione?: number;
}

export function useTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const PAGE_SIZE = 1000;
      let allData: TransactionWithCategory[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("transactions")
          .select(`
            *,
            categories (
              id,
              name,
              type
            ),
            conti (
              id,
              nome_conto,
              banca
            )
          `)
          .is("deleted_at", null)
          .order("date", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const batch = (data ?? []) as TransactionWithCategory[];
        allData = allData.concat(batch);
        hasMore = batch.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allData;
    },
    enabled: !!user,
  });
}

export function useCreateTransaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          description: input.description,
          amount: input.amount,
          type: input.type,
          date: input.date,
          category_id: input.category_id,
          conto_id: input.conto_id,
          rata_id: input.rata_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If linked to a rata, verify ownership then update status
      if (input.rata_id) {
        const { data: rata, error: rataError } = await supabase
          .from("scadenze_rate")
          .select("user_id")
          .eq("id", input.rata_id)
          .single();

        if (rataError || !rata || rata.user_id !== user.id) {
          throw new Error("Invalid rata_id");
        }

        await supabase
          .from("scadenze_rate")
          .update({ stato: "pagata", transaction_id: data.id })
          .eq("id", input.rata_id);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["scadenziario"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze_rate_unpaid"] });
      // Auto-generate suggestions for new transaction
      if (data?.id && user) {
        generateSuggestionsForIds([data.id], user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
        }).catch(console.error);
      }
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTransactionInput) => {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          description: input.description,
          amount: input.amount,
          type: input.type,
          date: input.date,
          category_id: input.category_id,
          conto_id: input.conto_id,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Re-generate suggestions for updated transaction
      if (data?.id) {
        generateSuggestionsForIds([data.id], data.user_id).then(() => {
          queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
        }).catch(console.error);
      }
    },
  });
}

export function useCreateTransfer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransferInput) => {
      if (!user) throw new Error("Not authenticated");

      const transfer_id = crypto.randomUUID();

      // Fetch conti names for descriptions
      const { data: conti } = await supabase
        .from("conti")
        .select("id, nome_conto")
        .in("id", [input.contoOrigineId, input.contoDestinazioneId]);

      const origineNome = conti?.find((c) => c.id === input.contoOrigineId)?.nome_conto || "Origine";
      const destNome = conti?.find((c) => c.id === input.contoDestinazioneId)?.nome_conto || "Destinazione";

      const rows: any[] = [
        {
          user_id: user.id,
          description: input.description || `Trasferimento verso ${destNome}`,
          amount: input.amount,
          type: "expense",
          date: input.date,
          category_id: null,
          conto_id: input.contoOrigineId,
          transfer_id,
        },
        {
          user_id: user.id,
          description: input.description || `Trasferimento da ${origineNome}`,
          amount: input.amount,
          type: "income",
          date: input.date,
          category_id: null,
          conto_id: input.contoDestinazioneId,
          transfer_id,
        },
      ];

      // Handle commission
      if (input.commissione && input.commissione > 0) {
        // Find or create "Commissioni" category
        let { data: existingCat } = await supabase
          .from("categories")
          .select("id")
          .eq("name", "Commissioni")
          .eq("type", "expense")
          .eq("user_id", user.id)
          .maybeSingle();

        let commissionCategoryId: string;
        if (existingCat) {
          commissionCategoryId = existingCat.id;
        } else {
          const { data: newCat, error: catError } = await supabase
            .from("categories")
            .insert({ name: "Commissioni", type: "expense", user_id: user.id })
            .select("id")
            .single();
          if (catError) throw catError;
          commissionCategoryId = newCat.id;
        }

        rows.push({
          user_id: user.id,
          description: "Commissione trasferimento",
          amount: input.commissione,
          type: "expense",
          date: input.date,
          category_id: commissionCategoryId,
          conto_id: input.contoOrigineId,
          transfer_id,
        });
      }

      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
    },
  });
}
