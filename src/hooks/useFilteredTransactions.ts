import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionWithCategory } from "./useTransactions";
import { useGetCategoryWithChildrenIds } from "./useCategories";

export interface TransactionFilters {
  searchText?: string;
  categoryId?: string;
  contoId?: string;
  type?: "income" | "expense" | "all";
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  reconciliation?: "all" | "none" | "suggested" | "reconciled" | "not_reconciled";
}

export function useFilteredTransactions(filters: TransactionFilters) {
  const { user } = useAuth();
  const getCategoryWithChildrenIds = useGetCategoryWithChildrenIds();

  // Resolve category filter to include subcategories
  const resolvedCategoryIds = filters.categoryId
    ? getCategoryWithChildrenIds(filters.categoryId)
    : undefined;

  const serverFilters = {
    type: filters.type,
    categoryIds: resolvedCategoryIds,
    contoId: filters.contoId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
    reconciliation: filters.reconciliation,
    searchText: filters.searchText?.trim() || undefined,
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

      // Filtro ricerca testuale server-side con ilike
      if (filters.searchText?.trim()) {
        const search = `%${filters.searchText.trim()}%`;
        query = query.ilike("description", search);
      }

      if (filters.contoId) {
        query = query.eq("conto_id", filters.contoId);
      }

      if (filters.type && filters.type !== "all") {
        query = query.eq("type", filters.type);
      }

      if (resolvedCategoryIds) {
        if (resolvedCategoryIds.includes("uncategorized")) {
          query = query.is("category_id", null);
        } else if (resolvedCategoryIds.length === 1) {
          query = query.eq("category_id", resolvedCategoryIds[0]);
        } else {
          query = query.in("category_id", resolvedCategoryIds);
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
        if (filters.reconciliation === "not_reconciled") {
          query = query.in("reconciliation_status", ["none", "suggested"]);
        } else {
          query = query.eq("reconciliation_status", filters.reconciliation);
        }
      }

      const PAGE_SIZE = 1000;
      let allData: TransactionWithCategory[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query
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
    placeholderData: (prev) => prev,
    enabled: !!user,
  });
}
