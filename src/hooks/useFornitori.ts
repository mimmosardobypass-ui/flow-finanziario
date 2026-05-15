import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Fornitore {
  id: string;
  user_id: string;
  nome: string;
  piva: string | null;
  codice_fiscale: string | null;
  category_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFornitoreInput {
  nome: string;
  piva?: string | null;
  codice_fiscale?: string | null;
  category_id?: string | null;
  note?: string | null;
}

export function useFornitori() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fornitori", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("fornitori")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Fornitore[];
    },
    enabled: !!user,
  });
}

export function useCreateFornitore() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFornitoreInput) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase
        .from("fornitori")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornitori"] }),
  });
}

export function useUpdateFornitore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFornitoreInput & { id: string }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("fornitori")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornitori"] });
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
    },
  });
}

export function useDeleteFornitore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornitori").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornitori"] });
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
    },
  });
}
