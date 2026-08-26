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
  commissione_euro: number;
  percentuale: number;
  fuori_norma: boolean;
}

export interface ReconciliationAggregate {
  rule_id: string;
  rule_name: string;
  dest_id: string;
  dest_desc: string | null;
  dest_amount: number;
  dest_date: string;
  dest_conto: string;
  source_ids: string[];
  source_count: number;
  source_totale: number;
  source_dal: string;
  source_al: string;
  source_conto: string;
  commissione_euro: number;
  percentuale: number;
  giorni: number;
  fuori_norma: boolean;
}

export interface CommissioneSumupRow {
  gruppo: string | null;
  primo_incasso: string | null;
  ultimo_incasso: string | null;
  data_accredito: string | null;
  giorni_di_attesa: number | null;
  numero_incassi: number | null;
  accorpato: boolean | null;
  incassato: number | null;
  accreditato: number | null;
  commissione: number | null;
  percentuale: number | null;
  mese: string | null;
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

export interface AggregateSource {
  id: string;
  date: string;
  amount: number;
  description: string | null;
}

export interface ReconciliationAggregateEnriched extends ReconciliationAggregate {
  sources: AggregateSource[];
}

export function useFindReconciliationAggregates() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).rpc("find_reconciliation_aggregates", {
        p_user_id: user.id,
      });
      if (error) throw error;
      const rows = (data || []) as ReconciliationAggregate[];
      if (rows.length === 0) return [] as ReconciliationAggregateEnriched[];

      const allIds = Array.from(new Set(rows.flatMap((r) => r.source_ids || [])));
      const detailMap = new Map<string, AggregateSource>();
      if (allIds.length > 0) {
        const { data: txs, error: txErr } = await supabase
          .from("transactions")
          .select("id, date, amount, description")
          .in("id", allIds);
        if (txErr) throw txErr;
        (txs || []).forEach((t: any) =>
          detailMap.set(t.id, { id: t.id, date: t.date, amount: Number(t.amount), description: t.description })
        );
      }

      return rows.map((r) => ({
        ...r,
        sources: (r.source_ids || [])
          .map((id) => detailMap.get(id))
          .filter((s): s is AggregateSource => !!s)
          .sort((a, b) => a.date.localeCompare(b.date)),
      })) as ReconciliationAggregateEnriched[];
    },
  });
}

export function useReconcileSumupGroups() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groups: Array<{ source_ids: string[]; dest_id: string; rule_id: string }>) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await (supabase as any).rpc("reconcile_sumup_groups_batch", {
        p_user_id: user.id,
        p_groups: groups,
      });
      if (error) throw error;
      return data as { accorpamenti: number; totale_commissioni: number; dettaglio: any };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["commissioni_sumup"] });
    },
  });
}

export function useCommissioniSumup() {
  return useQuery({
    queryKey: ["commissioni_sumup"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_commissioni_sumup")
        .select("*")
        .order("data_accredito", { ascending: false });
      if (error) throw error;
      return (data || []) as CommissioneSumupRow[];
    },
  });
}
