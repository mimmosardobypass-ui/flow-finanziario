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
  const trimmedSearchText = filters.searchText?.trim() || undefined;
  const normalizedSearchText = trimmedSearchText?.toLowerCase();

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
    searchText: trimmedSearchText,
  };

  return useQuery({
    queryKey: ["transactions", "filtered", user?.id, serverFilters],
    queryFn: async () => {
      if (!user) return [];
      const shouldDebugSearch = !!trimmedSearchText;

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
      if (trimmedSearchText) {
        const search = `%${trimmedSearchText}%`;
        query = query.ilike("description", search);
      }

      if (shouldDebugSearch) {
        console.log("[TX_SEARCH_SERVER_DEBUG] fields", ["description"]);
        console.log("[TX_SEARCH_SERVER_DEBUG] filters", {
          searchText: trimmedSearchText,
          contoId: filters.contoId ?? null,
          categoryIds: resolvedCategoryIds ?? null,
          type: filters.type ?? "all",
          dateFrom: filters.dateFrom ?? null,
          dateTo: filters.dateTo ?? null,
          amountMin: filters.amountMin ?? null,
          amountMax: filters.amountMax ?? null,
          reconciliation: filters.reconciliation ?? "all",
        });
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
        const pagedQuery = query
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (shouldDebugSearch && from === 0) {
          console.log(
            "[TX_SEARCH_SERVER_DEBUG] finalQuery",
            (pagedQuery as any)?.url?.toString?.() ?? "URL non disponibile"
          );
        }

        const { data, error } = await pagedQuery;

        if (error) throw error;

        const batch = (data ?? []) as TransactionWithCategory[];
        allData = allData.concat(batch);
        hasMore = batch.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      const seenIds = new Set<string>();
      const dedupedData = allData.filter((transaction) => {
        if (seenIds.has(transaction.id)) {
          return false;
        }

        seenIds.add(transaction.id);
        return true;
      });

      const strictlyFilteredData = normalizedSearchText
        ? dedupedData.filter((transaction) =>
            (transaction.description ?? "").toLowerCase().includes(normalizedSearchText)
          )
        : dedupedData;

      if (shouldDebugSearch) {
        console.log("[TX_SEARCH_SERVER_DEBUG] records", {
          fetchedRows: allData.length,
          duplicatesRemoved: allData.length - dedupedData.length,
          serverRowsAfterFilter: dedupedData.length,
          finalRowsAfterStrictDescriptionCheck: strictlyFilteredData.length,
        });
      }

      return strictlyFilteredData;
    },
    placeholderData: (prev) => prev,
    enabled: !!user,
  });
}
