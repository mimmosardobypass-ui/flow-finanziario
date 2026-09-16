import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invalidaAnagrafiche } from "@/lib/invalidate";

export type TipoConto = "conto_corrente" | "carta" | "cassa" | "pos" | "altro";

export interface Conto {
  id: string;
  user_id: string;
  nome_conto: string;
  banca: string | null;
  saldo_iniziale: number;
  attivo: boolean;
  created_at: string;
  tipo: TipoConto | null;
  intestatario: string | null;
  identificativo: string | null;
  colore: string | null;
  saldo_riferimento: number | null;
  saldo_riferimento_data: string | null;
  verificato_dal: string | null;
  verificato_fino_al: string | null;
  note: string | null;
}

export interface ContoRiepilogo extends Conto {
  n_movimenti: number;
  primo_movimento: string | null;
  ultimo_movimento: string | null;
  ultimo_import: string | null;
  totale_movimenti: number;
  entrate_mese: number;
  uscite_mese: number;
  entrate_mese_prec: number;
  uscite_mese_prec: number;
  da_classificare: number;
  da_riconciliare: number;
  saldo_attuale: number;
  saldo_confermato: boolean;
  saldo_prima_del_primo_movimento: number;
  giorni_da_ultimo_movimento: number | null;
}

export interface AndamentoMensileConto {
  conto_id: string;
  mese: string;
  entrate: number;
  uscite: number;
  netto: number;
  n_movimenti: number;
}

export interface ContoFormInput {
  nome_conto: string;
  tipo?: TipoConto | null;
  banca?: string | null;
  identificativo?: string | null;
  intestatario?: string | null;
  colore?: string | null;
  note?: string | null;
  saldo_iniziale: number;
  saldo_riferimento?: number | null;
  saldo_riferimento_data?: string | null;
  verificato_dal?: string | null;
  verificato_fino_al?: string | null;
}

export type CreateContoInput = ContoFormInput;

export interface UpdateContoInput extends ContoFormInput {
  id: string;
  attivo: boolean;
}

const n = (v: number | string | null | undefined) => Number(v ?? 0);

const ORDINE_TIPI: TipoConto[] = ["conto_corrente", "carta", "pos", "cassa", "altro"];

function invalidaConti(qc: ReturnType<typeof useQueryClient>) {
  invalidaAnagrafiche(qc);
  qc.invalidateQueries({ queryKey: ["conti-riepilogo"] });
  qc.invalidateQueries({ queryKey: ["conti-andamento"] });
  qc.invalidateQueries({ queryKey: ["saldo-conto"] });
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

export function useContiRiepilogo() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["conti-riepilogo", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("v_conti_riepilogo").select("*");
      if (error) throw error;
      const righe = (data ?? []).map((r): ContoRiepilogo => ({
        id: r.id as string,
        user_id: r.user_id as string,
        nome_conto: r.nome_conto ?? "",
        banca: r.banca,
        saldo_iniziale: n(r.saldo_iniziale),
        attivo: r.attivo ?? true,
        created_at: r.created_at ?? "",
        tipo: (r.tipo as TipoConto | null) ?? null,
        intestatario: r.intestatario,
        identificativo: r.identificativo,
        colore: r.colore,
        saldo_riferimento: r.saldo_riferimento === null ? null : n(r.saldo_riferimento),
        saldo_riferimento_data: r.saldo_riferimento_data,
        verificato_dal: r.verificato_dal,
        verificato_fino_al: r.verificato_fino_al,
        note: r.note,
        n_movimenti: n(r.n_movimenti),
        primo_movimento: r.primo_movimento,
        ultimo_movimento: r.ultimo_movimento,
        ultimo_import: r.ultimo_import,
        totale_movimenti: n(r.totale_movimenti),
        entrate_mese: n(r.entrate_mese),
        uscite_mese: n(r.uscite_mese),
        entrate_mese_prec: n(r.entrate_mese_prec),
        uscite_mese_prec: n(r.uscite_mese_prec),
        da_classificare: n(r.da_classificare),
        da_riconciliare: n(r.da_riconciliare),
        saldo_attuale: n(r.saldo_attuale),
        saldo_confermato: r.saldo_confermato ?? false,
        saldo_prima_del_primo_movimento: n(r.saldo_prima_del_primo_movimento),
        giorni_da_ultimo_movimento:
          r.giorni_da_ultimo_movimento === null ? null : n(r.giorni_da_ultimo_movimento),
      }));

      righe.sort((a, b) => {
        const ia = ORDINE_TIPI.indexOf((a.tipo ?? "altro") as TipoConto);
        const ib = ORDINE_TIPI.indexOf((b.tipo ?? "altro") as TipoConto);
        if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        return a.nome_conto.localeCompare(b.nome_conto, "it");
      });

      return righe;
    },
    enabled: !!user,
  });
}

export function useAndamentoConti() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["conti-andamento", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("v_conti_andamento_mensile")
        .select("*")
        .order("mese");
      if (error) throw error;
      return (data ?? []).map((r): AndamentoMensileConto => ({
        conto_id: r.conto_id as string,
        mese: r.mese as string,
        entrate: n(r.entrate),
        uscite: n(r.uscite),
        netto: n(r.netto),
        n_movimenti: n(r.n_movimenti),
      }));
    },
    enabled: !!user,
  });
}

function payload(input: ContoFormInput) {
  return {
    nome_conto: input.nome_conto,
    tipo: input.tipo || null,
    banca: input.banca || null,
    identificativo: input.identificativo || null,
    intestatario: input.intestatario || null,
    colore: input.colore || null,
    note: input.note || null,
    saldo_iniziale: input.saldo_iniziale,
    saldo_riferimento: input.saldo_riferimento ?? null,
    saldo_riferimento_data: input.saldo_riferimento_data || null,
    verificato_dal: input.verificato_dal || null,
    verificato_fino_al: input.verificato_fino_al || null,
  };
}

export function useCreateConto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContoInput) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase
        .from("conti")
        .insert({ user_id: user.id, ...payload(input) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidaConti(queryClient),
  });
}

export function useUpdateConto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateContoInput) => {
      const { data, error } = await supabase
        .from("conti")
        .update({ ...payload(input), attivo: input.attivo })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidaConti(queryClient),
  });
}

export function useToggleContoAttivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("conti").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidaConti(queryClient),
  });
}

/** Somma dei movimenti del conto successivi a una data (per l'anteprima del saldo reale). */
export function useMovimentiDopoData(contoId: string | undefined, data: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saldo-conto", "dopo-data", contoId, data],
    queryFn: async () => {
      if (!contoId || !data) return 0;
      const { data: rows, error } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("conto_id", contoId)
        .is("deleted_at", null)
        .gt("date", data)
        .limit(5000);
      if (error) throw error;
      return (rows ?? []).reduce(
        (acc, r) => acc + (r.type === "income" ? n(r.amount) : -n(r.amount)),
        0
      );
    },
    enabled: !!user && !!contoId && !!data,
  });
}
