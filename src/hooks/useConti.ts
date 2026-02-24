import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Conto {
  id: string;
  user_id: string;
  nome_conto: string;
  banca: string | null;
  saldo_iniziale: number;
  attivo: boolean;
  created_at: string;
}

export interface CreateContoInput {
  nome_conto: string;
  banca?: string;
  saldo_iniziale: number;
}

export interface UpdateContoInput extends CreateContoInput {
  id: string;
  attivo: boolean;
}

export function useConti() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["conti", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("conti")
        .select("*")
        .order("nome_conto");
      if (error) throw error;
      return data as Conto[];
    },
    enabled: !!user,
  });
}

export function useContiAttivi() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["conti", "attivi", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("conti")
        .select("*")
        .eq("attivo", true)
        .order("nome_conto");
      if (error) throw error;
      return data as Conto[];
    },
    enabled: !!user,
  });
}

export function useCreateConto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContoInput) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase
        .from("conti")
        .insert({
          user_id: user.id,
          nome_conto: input.nome_conto,
          banca: input.banca || null,
          saldo_iniziale: input.saldo_iniziale,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conti"] });
    },
  });
}

export function useUpdateConto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateContoInput) => {
      const { data, error } = await supabase
        .from("conti")
        .update({
          nome_conto: input.nome_conto,
          banca: input.banca || null,
          saldo_iniziale: input.saldo_iniziale,
          attivo: input.attivo,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conti"] });
    },
  });
}

export function useToggleContoAttivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase
        .from("conti")
        .update({ attivo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conti"] });
    },
  });
}
