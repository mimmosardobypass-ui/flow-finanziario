import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CategorizationRule {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  exclude_keywords: string[];
  match_type: "income" | "expense" | "both";
  conto_id: string | null;
  category_id: string;
  priority: number;
  apply_to_categorized: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RuleInsert = Omit<CategorizationRule, "id" | "created_at" | "updated_at">;
export type RuleUpdate = Partial<Omit<CategorizationRule, "id" | "user_id" | "created_at" | "updated_at">>;

const QUERY_KEY = ["categorization_rules"];

/* ─── Normalize text for keyword matching ─── */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Build a prefix stem for an Italian word to handle singular/plural variations.
 * Words ≥ 5 chars: drop last char (incassi→incass, pagamento→pagament)
 * Words 4 chars: drop last char (conto→cont)
 * Words ≤ 3 chars: use as-is (pos→pos)
 */
function stemWord(word: string): string {
  if (word.length >= 4) return word.slice(0, -1);
  return word;
}

/**
 * Check if a description matches a keyword phrase using flexible stem-based matching.
 * Each word in the keyword is stemmed and checked as a substring of the description.
 * All words in the keyword must match (AND logic within a single keyword phrase).
 */
function keywordMatchesDesc(desc: string, keyword: string): boolean {
  const nkw = normalize(keyword);
  if (nkw.length === 0) return false;
  
  // First try exact substring match (fastest path)
  if (desc.includes(nkw)) return true;
  
  // Then try stem-based matching: all words in the keyword must appear as stems
  const kwWords = nkw.split(" ").filter(w => w.length > 0);
  return kwWords.every(word => {
    const stem = stemWord(word);
    return desc.includes(stem);
  });
}

function matchesKeywords(description: string, keywords: string[]): boolean {
  const desc = normalize(description || "");
  return keywords.some((kw) => keywordMatchesDesc(desc, kw));
}

function matchesExcludeKeywords(description: string, excludeKeywords: string[]): boolean {
  if (!excludeKeywords || excludeKeywords.length === 0) return false;
  const desc = normalize(description || "");
  return excludeKeywords.some((kw) => keywordMatchesDesc(desc, kw));
}

function isUnclassifiedCategory(categoryId: string | null | undefined, classifIds: Set<string>): boolean {
  return !categoryId || classifIds.has(categoryId);
}

function ruleMatchesTransaction(rule: CategorizationRule, t: any, classifIds: Set<string>): boolean {
  const isUnclassified = isUnclassifiedCategory(t.category_id, classifIds);
  if (rule.match_type !== "both" && t.type !== rule.match_type) return false;
  if (!rule.apply_to_categorized && !isUnclassified) return false;
  if (t.category_id === rule.category_id) return false;
  if (!matchesKeywords(t.description, rule.keywords) || matchesExcludeKeywords(t.description, rule.exclude_keywords)) return false;

  // Il conto resta vincolante solo per movimenti già realmente categorizzati.
  // I movimenti "Da classificare" importati spesso arrivano da un conto diverso
  // da quello scelto nella regola: in quel caso la keyword deve poterli classificare.
  if (rule.conto_id && t.conto_id !== rule.conto_id && !isUnclassified) return false;
  return true;
}

export { normalize, matchesKeywords, matchesExcludeKeywords };

export function useCategorizationRules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorization_rules")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true }); // stable tiebreak: oldest first
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (rule: Omit<RuleInsert, "user_id">) => {
      const { data, error } = await supabase
        .from("categorization_rules")
        .insert({ ...rule, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["rule_match_counts"] });
    },
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: RuleUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("categorization_rules")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["rule_match_counts"] });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categorization_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["rule_match_counts"] });
    },
  });
}

export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("categorization_rules")
        .update({ active, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Preview: find transactions matching a rule's criteria */
export function useRulePreview(keywords: string[], matchType: string, contoId: string | null, excludeKeywords: string[] = []) {
  return useQuery({
    queryKey: ["rule_preview", keywords, matchType, contoId, excludeKeywords],
    enabled: keywords.length > 0 && keywords.some((k) => k.trim().length > 0),
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const allMatched: any[] = [];

      while (true) {
        let query = supabase
          .from("transactions")
          .select("id, description, date, amount, type, conto_id, category_id")
          .is("deleted_at", null)
          .order("date", { ascending: false })
          .range(from, from + PAGE - 1);

        if (matchType !== "both") {
          query = query.eq("type", matchType);
        }
        if (contoId) {
          query = query.eq("conto_id", contoId);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        const matched = data.filter((t: any) =>
          matchesKeywords(t.description, keywords) &&
          !matchesExcludeKeywords(t.description, excludeKeywords)
        );
        allMatched.push(...matched);

        if (data.length < PAGE) break;
        from += PAGE;
      }

      return allMatched;
    },
  });
}

/** Count how many transactions each rule currently matches */
export function useRuleMatchCounts(rules: CategorizationRule[]) {
  return useQuery({
    queryKey: ["rule_match_counts", rules.map((r) => r.id).join(",")],
    enabled: rules.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: classCats } = await supabase
        .from("categories")
        .select("id")
        .eq("name", "Da classificare");
      const classifIds = new Set<string>((classCats || []).map((c: any) => c.id));

      // Fetch all active transactions in pages
      const PAGE = 1000;
      let from = 0;
      const allTxs: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, description, type, conto_id, category_id")
          .is("deleted_at", null)
          .is("transfer_id", null)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allTxs.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // Count matches per rule
      const counts: Record<string, number> = {};
      for (const rule of rules) {
        if (!rule.active) {
          counts[rule.id] = 0;
          continue;
        }
        let count = 0;
        for (const t of allTxs) {
          if (ruleMatchesTransaction(rule, t, classifIds)) count++;
        }
        counts[rule.id] = count;
      }
      return counts;
    },
  });
}

/** Count matching transactions for a rule (for confirmation dialog) */
export async function countRuleMatches(rule: CategorizationRule): Promise<number> {
  const { data: classCats } = await supabase
    .from("categories")
    .select("id")
    .eq("name", "Da classificare");
  const classifIds = new Set<string>((classCats || []).map((c: any) => c.id));

  const PAGE = 1000;
  let from = 0;
  let total = 0;

  while (true) {
    let query = supabase
      .from("transactions")
      .select("id, description, type, conto_id, category_id")
      .is("deleted_at", null)
      .is("transfer_id", null)
      .range(from, from + PAGE - 1);

    if (rule.match_type !== "both") query = query.eq("type", rule.match_type);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    total += data.filter((t: any) => {
      return ruleMatchesTransaction(rule, t, classifIds);
    }).length;

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return total;
}

/** Apply a single rule to existing transactions */
export function useApplyRuleToExisting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: CategorizationRule) => {
      if (!rule.active) throw new Error("Cannot apply inactive rule");

      // Load IDs of "Da classificare" categories — these count as "uncategorized"
      // so rules can overwrite them even when apply_to_categorized=false
      const { data: classCats } = await supabase
        .from("categories")
        .select("id")
        .eq("name", "Da classificare");
      const classifIds = new Set<string>((classCats || []).map((c: any) => c.id));

      const PAGE = 1000;
      let from = 0;
      let allIds: string[] = [];

      while (true) {
        let query = supabase
          .from("transactions")
          .select("id, description, type, conto_id, category_id")
          .is("deleted_at", null)
          .is("transfer_id", null)
          .range(from, from + PAGE - 1);

        if (rule.match_type !== "both") query = query.eq("type", rule.match_type);
        // NOTE: do NOT filter category_id at SQL level — we need to include
        // transactions whose category_id points to "Da classificare"

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        const matched = data.filter((t: any) => {
          return ruleMatchesTransaction(rule, t, classifIds);
        });
        allIds.push(...matched.map((t: any) => t.id));

        if (data.length < PAGE) break;
        from += PAGE;
      }

      console.log(`[ApplyRule] "${rule.name}" → ${allIds.length} movimenti da aggiornare`);
      if (allIds.length === 0) return 0;

      const BATCH = 100;
      for (let i = 0; i < allIds.length; i += BATCH) {
        const batch = allIds.slice(i, i + BATCH);
        const { error } = await supabase
          .from("transactions")
          .update({ category_id: rule.category_id } as any)
          .in("id", batch);
        if (error) throw error;
      }

      return allIds.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["filtered-transactions"] });
      qc.invalidateQueries({ queryKey: ["rule_match_counts"] });
    },
  });
}
