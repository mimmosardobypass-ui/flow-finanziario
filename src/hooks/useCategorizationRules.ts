import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CategorizationRule {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
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

function matchesKeywords(description: string, keywords: string[]): boolean {
  const desc = normalize(description || "");
  return keywords.some((kw) => {
    const nkw = normalize(kw);
    return nkw.length > 0 && desc.includes(nkw);
  });
}

export { normalize, matchesKeywords };

export function useCategorizationRules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorization_rules" as any)
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true }); // stable tiebreak: oldest first
      if (error) throw error;
      return (data || []) as unknown as CategorizationRule[];
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (rule: Omit<RuleInsert, "user_id">) => {
      const { data, error } = await supabase
        .from("categorization_rules" as any)
        .insert({ ...rule, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CategorizationRule;
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
        .from("categorization_rules" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CategorizationRule;
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
        .from("categorization_rules" as any)
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
        .from("categorization_rules" as any)
        .update({ active, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Preview: find transactions matching a rule's criteria */
export function useRulePreview(keywords: string[], matchType: string, contoId: string | null) {
  return useQuery({
    queryKey: ["rule_preview", keywords, matchType, contoId],
    enabled: keywords.length > 0 && keywords.some((k) => k.trim().length > 0),
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("id, description, date, amount, type, conto_id, category_id")
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(200);

      if (matchType !== "both") {
        query = query.eq("type", matchType);
      }
      if (contoId) {
        query = query.eq("conto_id", contoId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).filter((t: any) => matchesKeywords(t.description, keywords));
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
      // Fetch all active transactions in pages
      const PAGE = 1000;
      let from = 0;
      const allTxs: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, description, type, conto_id, category_id")
          .is("deleted_at", null)
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
          if (rule.match_type !== "both" && t.type !== rule.match_type) continue;
          if (rule.conto_id && t.conto_id !== rule.conto_id) continue;
          if (!rule.apply_to_categorized && t.category_id != null) continue;
          if (matchesKeywords(t.description, rule.keywords)) count++;
        }
        counts[rule.id] = count;
      }
      return counts;
    },
  });
}

/** Count matching transactions for a rule (for confirmation dialog) */
export async function countRuleMatches(rule: CategorizationRule): Promise<number> {
  const PAGE = 1000;
  let from = 0;
  let total = 0;

  while (true) {
    let query = supabase
      .from("transactions")
      .select("id, description, type, conto_id, category_id")
      .is("deleted_at", null)
      .range(from, from + PAGE - 1);

    if (rule.match_type !== "both") query = query.eq("type", rule.match_type);
    if (rule.conto_id) query = query.eq("conto_id", rule.conto_id);
    if (!rule.apply_to_categorized) query = query.is("category_id", null);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    total += data.filter((t: any) => matchesKeywords(t.description, rule.keywords)).length;

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

      const PAGE = 1000;
      let from = 0;
      let allIds: string[] = [];

      while (true) {
        let query = supabase
          .from("transactions")
          .select("id, description, type, conto_id, category_id")
          .is("deleted_at", null)
          .range(from, from + PAGE - 1);

        if (rule.match_type !== "both") query = query.eq("type", rule.match_type);
        if (rule.conto_id) query = query.eq("conto_id", rule.conto_id);
        if (!rule.apply_to_categorized) query = query.is("category_id", null);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        const matched = data.filter((t: any) => matchesKeywords(t.description, rule.keywords));
        allIds.push(...matched.map((t: any) => t.id));

        if (data.length < PAGE) break;
        from += PAGE;
      }

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
