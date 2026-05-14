import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ReconciliationRule {
  id: string;
  user_id: string;
  name: string;
  conto_origine_id: string | null;
  keywords_origine: string[];
  type_origine: "income" | "expense" | "any" | string;
  conto_dest_id: string | null;
  keywords_dest: string[];
  type_dest: "income" | "expense" | "any" | string;
  importo_match: "exact" | "percent" | string;
  commissione_percent: number;
  tolleranza_euro: number;
  giorni_min: number;
  giorni_max: number;
  reconciliation_type: string;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export type ReconciliationRuleInsert = Omit<ReconciliationRule, "id" | "created_at" | "updated_at" | "user_id">;
export type ReconciliationRuleUpdate = Partial<ReconciliationRuleInsert>;

export interface ReconciliationMatch {
  rule_id: string;
  rule_name: string;
  source_id: string;
  source_desc: string | null;
  source_amount: number;
  source_type: string;
  source_date: string;
  source_conto: string;
  dest_id: string;
  dest_desc: string | null;
  dest_amount: number;
  dest_type: string;
  dest_date: string;
  dest_conto: string;
  score: number;
  giorni_distanza: number;
  differenza_euro: number;
}

const QUERY_KEY = ["reconciliation_rules"];

export function useReconciliationRules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reconciliation_rules")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ReconciliationRule[];
    },
  });
}

export function useCreateReconciliationRule() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (rule: ReconciliationRuleInsert) => {
      const { data, error } = await (supabase as any)
        .from("reconciliation_rules")
        .insert({ ...rule, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as ReconciliationRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateReconciliationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ReconciliationRuleUpdate & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("reconciliation_rules")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ReconciliationRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteReconciliationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("reconciliation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useToggleReconciliationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any)
        .from("reconciliation_rules")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useReconcileSumupPairs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pairs: Array<{ source_id: string; dest_id: string; rule_id: string }>) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await (supabase as any).rpc("reconcile_sumup_batch", {
        p_user_id: user.id,
        p_pairs: pairs,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-matches"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
    },
  });
}

export function useFindReconciliationMatches() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).rpc("find_reconciliation_matches", {
        p_user_id: user.id,
      });
      if (error) throw error;
      return (data || []) as ReconciliationMatch[];
    },
  });
}
