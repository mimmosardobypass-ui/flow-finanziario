import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
  reconciliation?:
    | "all"
    | "none"
    | "suggested"
    | "reconciled"
    | "not_reconciled"
    | "with_documents"
    | "partially_covered";
}

const PAGE_SIZE = 50;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applicaFiltri<Q extends Record<string, any>>(
  q: Q,
  filters: TransactionFilters,
  resolvedCategoryIds: string[] | undefined,
  trimmedSearchText: string | undefined,
): Q {
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

  // "with_documents" e "partially_covered" dipendono dalla vista di copertura
  // documentale e vengono applicati lato client nella pagina Transazioni.
  if (
    filters.reconciliation &&
    filters.reconciliation !== "all" &&
    filters.reconciliation !== "with_documents" &&
    filters.reconciliation !== "partially_covered"
  ) {
    if (filters.reconciliation === "not_reconciled") {
      q = q.in("reconciliation_status", ["none", "suggested"]).is("rata_id", null);
    } else {
      q = q.eq("reconciliation_status", filters.reconciliation);
    }
  }
  return q;
}


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

      q = applicaFiltri(q, filters, resolvedCategoryIds, trimmedSearchText);

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

export interface FilteredTotals {
  conteggio: number;
  entrate: number;
  uscite: number;
  saldo: number;
  entrateSenzaGiro: number;
  usciteSenzaGiro: number;
  saldoSenzaGiro: number;
  conteggioSenzaGiro: number;
  giroconti: number;
}

const TOTALS_CHUNK = 1000;

/** Totali calcolati su TUTTE le righe del filtro (stessi filtri server di useFilteredTransactions). */
export function useFilteredTotals(filters: TransactionFilters, enabled = true) {
  const { user } = useAuth();
  const getCategoryWithChildrenIds = useGetCategoryWithChildrenIds();
  const trimmedSearchText = filters.searchText?.trim() || undefined;
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
    // Sotto il prefisso "transactions": viene invalidata insieme ai movimenti.
    queryKey: ["transactions", "filtered-totals", user?.id, serverFilters],
    enabled: !!user && enabled,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<FilteredTotals> => {
      const t: FilteredTotals = {
        conteggio: 0, entrate: 0, uscite: 0, saldo: 0,
        entrateSenzaGiro: 0, usciteSenzaGiro: 0, saldoSenzaGiro: 0,
        conteggioSenzaGiro: 0, giroconti: 0,
      };
      if (!user) return t;
      let from = 0;
      for (;;) {
        let q = supabase
          .from("transactions")
          .select("id, amount, type, transfer_id, reconciliation_type")
          .is("deleted_at", null);
        q = applicaFiltri(q, filters, resolvedCategoryIds, trimmedSearchText);
        const { data, error } = await q
          .order("date", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + TOTALS_CHUNK - 1);
        if (error) throw error;
        const rows = data ?? [];
        for (const r of rows) {
          const amt = Number(r.amount) || 0;
          const giro = !!r.transfer_id || r.reconciliation_type === "transfer";
          t.conteggio++;
          if (r.type === "income") t.entrate += amt;
          else if (r.type === "expense") t.uscite += amt;
          if (giro) {
            t.giroconti++;
          } else {
            t.conteggioSenzaGiro++;
            if (r.type === "income") t.entrateSenzaGiro += amt;
            else if (r.type === "expense") t.usciteSenzaGiro += amt;
          }
        }
        if (rows.length < TOTALS_CHUNK) break;
        from += TOTALS_CHUNK;
      }
      t.saldo = t.entrate - t.uscite;
      t.saldoSenzaGiro = t.entrateSenzaGiro - t.usciteSenzaGiro;
      return t;
    },
  });
}
