import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Transaction {
  id: string;
  user_id: string;
  description: string | null;
  amount: number;
  type: "income" | "expense";
  date: string;
  category_id: string | null;
  rata_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface TransactionWithCategory extends Transaction {
  categories: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category_id: string | null;
  rata_id?: string | null;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string;
}

export function useTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          categories (
            id,
            name,
            type
          )
        `)
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as TransactionWithCategory[];
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
          rata_id: input.rata_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If linked to a rata, update the rata status
      if (input.rata_id) {
        await supabase
          .from("scadenze_rate")
          .update({ stato: "pagata", transaction_id: data.id })
          .eq("id", input.rata_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["scadenziario"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze_rate_unpaid"] });
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
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
    },
  });
}
