import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionWithCategory } from "./useTransactions";

export interface TransactionFilters {
  searchText?: string;
  categoryId?: string;
  type?: "income" | "expense" | "all";
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
}

export function useFilteredTransactions(filters: TransactionFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", "filtered", user?.id, filters],
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
          )
        `)
        .is("deleted_at", null);

      // Filtro per tipo
      if (filters.type && filters.type !== "all") {
        query = query.eq("type", filters.type);
      }

      // Filtro per categoria
      if (filters.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }

      // Filtro per data
      if (filters.dateFrom) {
        query = query.gte("date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("date", filters.dateTo);
      }

      // Filtro per importo
      if (filters.amountMin !== undefined && filters.amountMin > 0) {
        query = query.gte("amount", filters.amountMin);
      }
      if (filters.amountMax !== undefined && filters.amountMax > 0) {
        query = query.lte("amount", filters.amountMax);
      }

      // Filtro per testo nella descrizione
      if (filters.searchText && filters.searchText.trim()) {
        query = query.ilike("description", `%${filters.searchText.trim()}%`);
      }

      const { data, error } = await query.order("date", { ascending: false });

      if (error) throw error;

      // Filtro aggiuntivo per ricerca nel nome categoria (lato client perché non possiamo fare ilike su join)
      let results = data as TransactionWithCategory[];
      
      if (filters.searchText && filters.searchText.trim()) {
        const searchLower = filters.searchText.trim().toLowerCase();
        results = results.filter(
          (t) =>
            t.description?.toLowerCase().includes(searchLower) ||
            t.categories?.name.toLowerCase().includes(searchLower)
        );
      }

      return results;
    },
    enabled: !!user,
  });
}
