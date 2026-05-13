import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateSuggestionsForIds } from "./useReconciliationSuggestions";
import { CategorizationRule } from "./useCategorizationRules";

/** Auto-apply categorization rules to a set of newly imported transaction IDs */
async function applyRulesToImported(
  importedIds: string[],
  userId: string,
  classificationIds: { incomeId: string; expenseId: string }
) {
  if (importedIds.length === 0) return { categorized: 0, perRule: {} as Record<string, number> };

  const { data: rulesRaw, error: rulesErr } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  if (rulesErr) throw rulesErr;
  const rules = (rulesRaw || []) as CategorizationRule[];
  if (rules.length === 0) return { categorized: 0, perRule: {} };

  let categorized = 0;
  const perRule: Record<string, number> = {};

  for (const rule of rules) {
    const { data, error } = await supabase.rpc("apply_categorization_rule", {
      p_rule_id: rule.id,
      p_user_id: userId,
    });
    if (!error && data) {
      categorized += data;
      if (data > 0) perRule[rule.name] = data;
    }
  }

  return { categorized, perRule };
}

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
  amount: number; // raw value, sign determines type if `type` is omitted
  type?: "income" | "expense"; // explicit type from parser (PDF) wins over sign
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
      contoId,
    }: {
      transactions: ParsedTransaction[];
      categories: ClassificationCategories;
      contoId: string;
    }): Promise<ImportResult> => {
      if (!user) throw new Error("Utente non autenticato");

      const rows = transactions.map((t) => {
        const finalType: "income" | "expense" = t.type ?? (t.amount >= 0 ? "income" : "expense");
        return {
          user_id: user.id,
          date: t.date,
          description: t.description || null,
          amount: Math.abs(t.amount),
          type: finalType,
          category_id: finalType === "income" ? categories.incomeId : categories.expenseId,
          conto_id: contoId,
        };
      });

      let imported = 0;
      const chunkSize = 100;
      const importedIds: string[] = [];

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error, data } = await supabase
          .from("transactions")
          .insert(chunk)
          .select("id");
        if (error) throw error;
        imported += data?.length ?? chunk.length;
        importedIds.push(...(data || []).map((t) => t.id));
      }

      // Auto-apply categorization rules ONLY to newly imported movements
      if (importedIds.length > 0) {
        try {
          const { categorized, perRule } = await applyRulesToImported(importedIds, user.id, categories);
          console.log("[Import] Movimenti importati:", importedIds.length);
          console.log("[Import] Movimenti auto-categorizzati:", categorized);
          console.log("[Import] Regole applicate:", perRule);
        } catch (e) {
          console.error("[Import] Errore auto-categorizzazione:", e);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["filtered-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });

      // Auto-generate reconciliation suggestions for imported transactions
      if (importedIds.length > 0) {
        try {
          await generateSuggestionsForIds(importedIds, user.id);
          await queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
        } catch (e) {
          console.error("Error generating reconciliation suggestions:", e);
        }
      }

      return {
        imported,
        skipped: transactions.length - imported,
        classificationCategoryId: categories.expenseId,
      };
    },
  });
}
