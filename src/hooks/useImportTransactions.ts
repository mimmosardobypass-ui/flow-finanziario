import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateSuggestionsForIds } from "./useReconciliationSuggestions";
import { matchesKeywords, matchesExcludeKeywords } from "./useCategorizationRules";

/** Normalize rule match_type to compare against transaction.type (income/expense) */
function normalizeMatchType(mt: string | null | undefined): "income" | "expense" | "both" {
  const v = (mt || "both").toLowerCase();
  if (v === "entrata" || v === "income") return "income";
  if (v === "uscita" || v === "expense") return "expense";
  return "both";
}

/** Auto-apply categorization rules to a set of newly imported transaction IDs */
async function applyRulesToImported(
  importedIds: string[],
  userId: string,
  classificationIds: { incomeId: string; expenseId: string }
) {
  console.log("[AUTO CAT] importedIds", importedIds);
  if (importedIds.length === 0) return { categorized: 0, perRule: {} as Record<string, number> };

  // 1. Load active rules ordered by priority
  const { data: rulesRaw, error: rulesErr } = await supabase
    .from("categorization_rules" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  if (rulesErr) throw rulesErr;
  const rules = (rulesRaw || []) as any[];
  console.log("[AUTO CAT] regole attive caricate:", rules.length);
  rules.forEach((r) => {
    console.log("[AUTO CAT] regola:", {
      name: r.name,
      keywords: r.keywords,
      exclude_keywords: r.exclude_keywords,
      match_type: r.match_type,
      conto_id: r.conto_id,
      category_id: r.category_id,
      priority: r.priority,
    });
  });
  if (rules.length === 0) {
    console.warn("[AUTO CAT] Nessuna regola attiva: nulla da applicare.");
    return { categorized: 0, perRule: {} };
  }

  // 2. Load only the freshly imported transactions
  const txs: any[] = [];
  const CHUNK = 200;
  for (let i = 0; i < importedIds.length; i += CHUNK) {
    const slice = importedIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("transactions")
      .select("id, description, type, conto_id, category_id")
      .in("id", slice);
    if (error) throw error;
    txs.push(...(data || []));
  }
  console.log("[AUTO CAT] transazioni ricaricate:", txs.length);
  txs.forEach((t) =>
    console.log("[AUTO CAT] tx iniziale:", {
      id: t.id,
      description: t.description,
      type: t.type,
      conto_id: t.conto_id,
      category_id: t.category_id,
    })
  );

  // Determine which category_ids are considered "overridable" (i.e. "Da classificare")
  // We use BOTH the IDs passed in AND we look up by name to be safe.
  const { data: classCats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name", "Da classificare");
  const overridable = new Set<string>([
    classificationIds.incomeId,
    classificationIds.expenseId,
    ...((classCats || []).map((c: any) => c.id)),
  ]);
  console.log("[AUTO CAT] category_id sovrascrivibili (Da classificare):", Array.from(overridable));

  const updates = new Map<string, string[]>(); // category_id -> tx ids
  const perRule: Record<string, number> = {};

  for (const tx of txs) {
    // Treat null OR "Da classificare" as overridable
    const isOverridable = !tx.category_id || overridable.has(tx.category_id);
    if (!isOverridable) {
      console.log("[AUTO CAT] SKIP (categoria reale già presente):", tx.id, tx.description);
      continue;
    }

    let matched = false;
    for (const rule of rules) {
      const ruleType = normalizeMatchType(rule.match_type);
      const desc = tx.description || "";
      const reasons: string[] = [];

      if (ruleType !== "both" && ruleType !== tx.type) {
        reasons.push(`tipo non compatibile (regola=${ruleType}, tx=${tx.type})`);
      }
      if (rule.conto_id && rule.conto_id !== tx.conto_id) {
        reasons.push(`conto non compatibile (regola=${rule.conto_id}, tx=${tx.conto_id})`);
      }
      if (!rule.category_id) {
        reasons.push("category_id mancante nella regola");
      }
      const kwOk = matchesKeywords(desc, rule.keywords || []);
      if (!kwOk) reasons.push(`nessuna keyword trovata (${JSON.stringify(rule.keywords)})`);
      const exclHit = matchesExcludeKeywords(desc, rule.exclude_keywords || []);
      if (exclHit) reasons.push(`exclude_keyword trovata (${JSON.stringify(rule.exclude_keywords)})`);

      if (reasons.length === 0) {
        console.log("[AUTO CAT] MATCH:", { tx: tx.description, rule: rule.name, →: rule.category_id });
        const arr = updates.get(rule.category_id) || [];
        arr.push(tx.id);
        updates.set(rule.category_id, arr);
        perRule[rule.name] = (perRule[rule.name] || 0) + 1;
        matched = true;
        break;
      } else {
        console.log("[AUTO CAT] NO MATCH:", {
          tx: tx.description,
          rule: rule.name,
          motivi: reasons,
        });
      }
    }
    if (!matched) {
      console.warn("[AUTO CAT] Nessuna regola applicabile per tx:", tx.id, tx.description);
    }
  }

  // 3. Batch update by category
  let categorized = 0;
  for (const [categoryId, ids] of updates.entries()) {
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error } = await supabase
        .from("transactions")
        .update({ category_id: categoryId } as any)
        .in("id", batch);
      if (error) {
        console.error("[AUTO CAT] Errore UPDATE batch:", error);
        throw error;
      }
      categorized += batch.length;
    }
  }

  // 4. Verifica finale: rilegge i movimenti aggiornati
  if (updates.size > 0) {
    const allUpdatedIds = Array.from(updates.values()).flat();
    const verify: any[] = [];
    for (let i = 0; i < allUpdatedIds.length; i += 200) {
      const slice = allUpdatedIds.slice(i, i + 200);
      const { data } = await supabase
        .from("transactions")
        .select("id, description, category_id")
        .in("id", slice);
      verify.push(...(data || []));
    }
    console.log("[AUTO CAT] Verifica post-update:");
    verify.forEach((t) =>
      console.log("[AUTO CAT] post:", { id: t.id, desc: t.description, category_id: t.category_id })
    );
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
      contoId,
    }: {
      transactions: ParsedTransaction[];
      categories: ClassificationCategories;
      contoId: string;
    }): Promise<ImportResult> => {
      if (!user) throw new Error("Utente non autenticato");

      const rows = transactions.map((t) => ({
        user_id: user.id,
        date: t.date,
        description: t.description || null,
        amount: Math.abs(t.amount),
        type: t.amount >= 0 ? "income" : "expense",
        category_id: t.amount >= 0 ? categories.incomeId : categories.expenseId,
        conto_id: contoId,
      }));

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
