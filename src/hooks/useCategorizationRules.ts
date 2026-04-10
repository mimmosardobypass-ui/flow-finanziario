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

export function useCategorizationRules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorization_rules" as any)
        .select("*")
        .order("priority", { ascending: false });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
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
        .select("id, description, date, amount, type, conto_id")
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(50);

      if (matchType !== "both") {
        query = query.eq("type", matchType);
      }
      if (contoId) {
        query = query.eq("conto_id", contoId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Client-side keyword filter (case-insensitive, any keyword matches)
      const lowerKeywords = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
      if (lowerKeywords.length === 0) return [];

      return (data || []).filter((t: any) => {
        const desc = (t.description || "").toLowerCase();
        return lowerKeywords.some((kw) => desc.includes(kw));
      });
    },
  });
}

/** Apply a single rule to existing transactions */
export function useApplyRuleToExisting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: CategorizationRule) => {
      // Fetch all matching transactions
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

        const lowerKw = rule.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
        const matched = data.filter((t: any) => {
          const desc = (t.description || "").toLowerCase();
          return lowerKw.some((kw) => desc.includes(kw));
        });
        allIds.push(...matched.map((t: any) => t.id));

        if (data.length < PAGE) break;
        from += PAGE;
      }

      if (allIds.length === 0) return 0;

      // Update in batches
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
    },
  });
}
