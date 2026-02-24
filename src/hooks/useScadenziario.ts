import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Scadenziario {
  id: string;
  user_id: string;
  numero_contratto: string;
  societa_finanziaria: string;
  tipo: string;
  importo_totale: number;
  numero_rate: number;
  data_prima_scadenza: string;
  modalita_importo: string;
  created_at: string;
}

export interface ScadenzaRata {
  id: string;
  scadenziario_id: string;
  user_id: string;
  numero_rata: number;
  importo: number | null;
  data_scadenza: string | null;
  stato: string;
  transaction_id: string | null;
  created_at: string;
}

export interface ScadenziarioWithRate extends Scadenziario {
  scadenze_rate: ScadenzaRata[];
}

export interface CreateScadenziarioInput {
  numero_contratto: string;
  societa_finanziaria: string;
  tipo: string;
  importo_totale: number;
  numero_rate: number;
  data_prima_scadenza: string;
  modalita_importo: string;
  rate: { numero_rata: number; importo: number | null; data_scadenza: string | null }[];
}

export function useScadenziarioList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scadenziario", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("scadenziario")
        .select(`
          *,
          scadenze_rate (*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ScadenziarioWithRate[];
    },
    enabled: !!user,
  });
}

export function useUnpaidRateByContract() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scadenze_rate_unpaid", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("scadenziario")
        .select(`
          id, numero_contratto, societa_finanziaria,
          scadenze_rate!inner (id, numero_rata, importo, data_scadenza, stato)
        `)
        .eq("scadenze_rate.stato", "non_pagata")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as (Pick<Scadenziario, "id" | "numero_contratto" | "societa_finanziaria"> & {
        scadenze_rate: Pick<ScadenzaRata, "id" | "numero_rata" | "importo" | "data_scadenza" | "stato">[];
      })[];
    },
    enabled: !!user,
  });
}

export function useCreateScadenziario() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateScadenziarioInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data: contratto, error: errContratto } = await supabase
        .from("scadenziario")
        .insert({
          user_id: user.id,
          numero_contratto: input.numero_contratto,
          societa_finanziaria: input.societa_finanziaria,
          tipo: input.tipo,
          importo_totale: input.importo_totale,
          numero_rate: input.numero_rate,
          data_prima_scadenza: input.data_prima_scadenza,
          modalita_importo: input.modalita_importo,
        })
        .select()
        .single();

      if (errContratto) throw errContratto;

      const rateRows = input.rate.map((r) => ({
        scadenziario_id: contratto.id,
        user_id: user.id,
        numero_rata: r.numero_rata,
        importo: r.importo,
        data_scadenza: r.data_scadenza,
        stato: "non_pagata" as const,
      }));

      const { error: errRate } = await supabase.from("scadenze_rate").insert(rateRows);
      if (errRate) throw errRate;

      return contratto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scadenziario"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze_rate_unpaid"] });
    },
  });
}

export function useUpdateRata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; importo?: number | null; data_scadenza?: string | null }) => {
      const { error } = await supabase
        .from("scadenze_rate")
        .update({ importo: input.importo, data_scadenza: input.data_scadenza })
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scadenziario"] });
    },
  });
}

export function useDeleteScadenziario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scadenziario").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scadenziario"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze_rate_unpaid"] });
    },
  });
}
