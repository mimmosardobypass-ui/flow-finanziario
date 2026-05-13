import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

const PAGE_SIZE = 50;

export function useFilteredTransactions(filters: TransactionFilters) {
  const { user } = useAuth();
  const getCategoryWithChildrenIds = useGetCategoryWithChildrenIds();
  const trimmedSearchText = filters.searchText?.trim() || undefined;

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

  const query = useInfiniteQuery({
    queryKey: ["transactions", "filtered", user?.id, serverFilters],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!user) return { data: [] as TransactionWithCategory[], nextOffset: null as number | null };

      let q = supabase
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

      if (trimmedSearchText) {
        q = q.ilike("description", `%${trimmedSearchText}%`);
      }

      if (filters.contoId) q = q.eq("conto_id", filters.contoId);
      if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);

      if (resolvedCategoryIds) {
        if (resolvedCategoryIds.includes("uncategorized")) {
          q = q.is("category_id", null);
        } else if (resolvedCategoryIds.length === 1) {
          q = q.eq("category_id", resolvedCategoryIds[0]);
        } else {
          q = q.in("category_id", resolvedCategoryIds);
        }
      }

      if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
      if (filters.dateTo) q = q.lte("date", filters.dateTo);
      if (filters.amountMin !== undefined && filters.amountMin > 0) q = q.gte("amount", filters.amountMin);
      if (filters.amountMax !== undefined && filters.amountMax > 0) q = q.lte("amount", filters.amountMax);

      if (filters.reconciliation && filters.reconciliation !== "all") {
        if (filters.reconciliation === "not_reconciled") {
          q = q.in("reconciliation_status", ["none", "suggested"]);
        } else {
          q = q.eq("reconciliation_status", filters.reconciliation);
        }
      }

      const { data, error } = await q
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;

      const batch = (data ?? []) as TransactionWithCategory[];
      return {
        data: batch,
        nextOffset: batch.length < PAGE_SIZE ? null : pageParam + PAGE_SIZE,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    placeholderData: (prev) => prev,
    enabled: !!user,
  });

  const allTransactions = useMemo(() => {
    const seen = new Set<string>();
    const out: TransactionWithCategory[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const t of page.data) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          out.push(t);
        }
      }
    }
    return out;
  }, [query.data]);

  return {
    ...query,
    allTransactions,
    data: allTransactions,
  };
}
