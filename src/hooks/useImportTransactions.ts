import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ClassificationCategories {
  incomeId: string;
  expenseId: string;
}

export function useEnsureClassificationCategories() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (): Promise<ClassificationCategories> => {
      if (!user) throw new Error("Utente non autenticato");

      const { data: existing, error: fetchErr } = await supabase
        .from("categories")
        .select("id, type")
        .eq("user_id", user.id)
        .eq("name", "Da classificare");

      if (fetchErr) throw fetchErr;

      const incomeCategory = existing?.find((c) => c.type === "income");
      const expenseCategory = existing?.find((c) => c.type === "expense");

      let incomeId = incomeCategory?.id;
      let expenseId = expenseCategory?.id;

      if (!incomeId) {
        const { data, error } = await supabase
          .from("categories")
          .insert({ name: "Da classificare", type: "income", user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        incomeId = data.id;
      }

      if (!expenseId) {
        const { data, error } = await supabase
          .from("categories")
          .insert({ name: "Da classificare", type: "expense", user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        expenseId = data.id;
      }

      return { incomeId: incomeId!, expenseId: expenseId! };
    },
  });
}

export interface ParsedTransaction {
  date: string; // yyyy-MM-dd
  description: string;
  amount: number; // raw value, sign determines type
}

interface ImportResult {
  imported: number;
  skipped: number;
  classificationCategoryId: string;
}

export function useImportTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactions,
      categories,
    }: {
      transactions: ParsedTransaction[];
      categories: ClassificationCategories;
    }): Promise<ImportResult> => {
      if (!user) throw new Error("Utente non autenticato");

      const rows = transactions.map((t) => ({
        user_id: user.id,
        date: t.date,
        description: t.description || null,
        amount: Math.abs(t.amount),
        type: t.amount >= 0 ? "income" : "expense",
        category_id: t.amount >= 0 ? categories.incomeId : categories.expenseId,
      }));

      let imported = 0;
      const chunkSize = 100;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error, data } = await supabase
          .from("transactions")
          .insert(chunk)
          .select("id");
        if (error) throw error;
        imported += data?.length ?? chunk.length;
      }

      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });

      return {
        imported,
        skipped: transactions.length - imported,
        classificationCategoryId: categories.expenseId,
      };
    },
  });
}
