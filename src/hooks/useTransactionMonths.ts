import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Restituisce l'insieme dei mesi (formato "yyyy-MM") in cui esiste almeno
 * una transazione, usato per evidenziare i mesi vuoti nel filtro Data.
 */
export function useTransactionMonths() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", "months", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const months = new Set<string>();
      const PAGE = 1000;
      let offset = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("transactions")
          .select("date")
          .is("deleted_at", null)
          .order("date", { ascending: false })
          .range(offset, offset + PAGE - 1);

        if (error) throw error;
        const batch = data ?? [];
        for (const row of batch) {
          if (row.date) months.add(String(row.date).slice(0, 7));
        }
        if (batch.length < PAGE || offset > 20000) break;
        offset += PAGE;
      }

      return months;
    },
  });
}
