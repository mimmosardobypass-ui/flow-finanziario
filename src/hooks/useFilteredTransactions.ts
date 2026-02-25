import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionWithCategory } from "./useTransactions";

export interface TransactionFilters {
  searchText?: string;
  categoryId?: string;
  contoId?: string;
  type?: "income" | "expense" | "all";
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  reconciliation?: "all" | "none" | "partial" | "complete";
  reconciliationType?: "all" | "transfer" | "payment" | "other";
}

export function useFilteredTransactions(filters: TransactionFilters) {
  const { user } = useAuth();

  // queryKey SENZA searchText - il filtro testuale è lato client e non deve causare refetch
  const serverFilters = {
    type: filters.type,
    categoryId: filters.categoryId,
    contoId: filters.contoId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
    reconciliation: filters.reconciliation,
    reconciliationType: filters.reconciliationType,
  };

  return useQuery({
    queryKey: ["transactions", "filtered", user?.id, serverFilters],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
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
        .is("deleted_at", null);

      if (filters.contoId) {
        query = query.eq("conto_id", filters.contoId);
      }

      if (filters.type && filters.type !== "all") {
        query = query.eq("type", filters.type);
      }

      if (filters.categoryId) {
        if (filters.categoryId === "uncategorized") {
          query = query.is("category_id", null);
        } else {
          query = query.eq("category_id", filters.categoryId);
        }
      }

      if (filters.dateFrom) {
        query = query.gte("date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("date", filters.dateTo);
      }

      if (filters.amountMin !== undefined && filters.amountMin > 0) {
        query = query.gte("amount", filters.amountMin);
      }
      if (filters.amountMax !== undefined && filters.amountMax > 0) {
        query = query.lte("amount", filters.amountMax);
      }

      if (filters.reconciliation && filters.reconciliation !== "all") {
        query = query.eq("reconciliation_status", filters.reconciliation);
      }

      if (filters.reconciliationType && filters.reconciliationType !== "all") {
        query = query.eq("reconciliation_type", filters.reconciliationType);
      }

      const { data, error } = await query.order("date", { ascending: false });

      if (error) throw error;

      return data as TransactionWithCategory[];
    },
    // Filtro testuale applicato lato client tramite select, senza cambiare la queryKey
    select: (data) => {
      if (!filters.searchText?.trim()) return data;
      const searchLower = filters.searchText.trim().toLowerCase();
      return data.filter(
        (t) =>
          t.description?.toLowerCase().includes(searchLower) ||
          t.categories?.name.toLowerCase().includes(searchLower)
      );
    },
    enabled: !!user,
  });
}
