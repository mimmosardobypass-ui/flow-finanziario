import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Categoria } from "@/lib/smartphone/parserCarico";

export interface SpDocumento { id: string; tipo: string; numero: string; data_documento: string; nome_file: string | null; created_at: string }
export interface SpArticolo {
  id: string; documento_id: string; marca: string; codice_articolo: string; modello: string; descrizione: string;
  categoria: Categoria; costo_unitario: number; aliquota_iva: number | null; prezzo_previsto: number | null; created_at: string;
}
export interface SpPezzo { id: string; articolo_id: string; documento_id: string; imei: string | null; stato: "disponibile" | "venduto"; created_at: string }
export interface SpVendita { id: string; pezzo_id: string; data_vendita: string; prezzo_vendita: number; prezzo_previsto_al_momento: number | null; imei: string | null; created_at: string }

export interface SpDati {
  documenti: SpDocumento[];
  articoli: SpArticolo[];
  pezzi: SpPezzo[];
  vendite: SpVendita[];
  docById: Map<string, SpDocumento>;
  artById: Map<string, SpArticolo>;
  pezzoById: Map<string, SpPezzo>;
  venditaByPezzo: Map<string, SpVendita>;
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function tutte<T>(tabella: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(tabella as any) as any).select("*").order("created_at").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useSmartphone() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["smartphone", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SpDati> => {
      const [documenti, articoliR, pezzi, venditeR] = await Promise.all([
        tutte<SpDocumento>("smartphone_documenti"),
        tutte<Record<string, unknown>>("smartphone_articoli"),
        tutte<SpPezzo>("smartphone_pezzi"),
        tutte<Record<string, unknown>>("smartphone_vendite"),
      ]);
      const articoli = articoliR.map((a) => ({ ...a, costo_unitario: Number(a.costo_unitario), aliquota_iva: n(a.aliquota_iva), prezzo_previsto: n(a.prezzo_previsto) })) as SpArticolo[];
      const vendite = venditeR.map((v) => ({ ...v, prezzo_vendita: Number(v.prezzo_vendita), prezzo_previsto_al_momento: n(v.prezzo_previsto_al_momento) })) as SpVendita[];
      return {
        documenti, articoli, pezzi, vendite,
        docById: new Map(documenti.map((d) => [d.id, d])),
        artById: new Map(articoli.map((a) => [a.id, a])),
        pezzoById: new Map(pezzi.map((p) => [p.id, p])),
        venditaByPezzo: new Map(vendite.map((v) => [v.pezzo_id, v])),
      };
    },
  });
}

export interface ArticoloDaImportare {
  marca: string; codice_articolo: string; modello: string; descrizione: string; categoria: Categoria;
  costo_unitario: number; aliquota_iva: number | null; prezzo_previsto: number | null; quantita: number;
}

export function useImportaCarico() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { tipo: string; numero: string; data_documento: string; nome_file: string; articoli: ArticoloDaImportare[] }) => {
      if (!user) throw new Error("Utente non autenticato");
      const { data, error } = await supabase.rpc("smartphone_importa_documento", {
        p_user_id: user.id,
        p_documento: { tipo: p.tipo, numero: p.numero, data_documento: p.data_documento, nome_file: p.nome_file },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p_articoli: p.articoli as any,
      });
      if (error) throw error;
      return data as { documento_id: string; pezzi: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smartphone"] }),
  });
}

export function useAggiornaPrezzoPrevisto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ articoloId, prezzo }: { articoloId: string; prezzo: number | null }) => {
      const { error } = await supabase.from("smartphone_articoli").update({ prezzo_previsto: prezzo }).eq("id", articoloId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smartphone"] }),
  });
}

export function useRegistraVendita() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { pezzoId: string; data: string; prezzo: number; imei: string | null }) => {
      if (!user) throw new Error("Utente non autenticato");
      const { error } = await supabase.rpc("smartphone_registra_vendita", {
        p_user_id: user.id, p_pezzo_id: p.pezzoId, p_data: p.data, p_prezzo: p.prezzo, p_imei: p.imei ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smartphone"] }),
  });
}

export function useEliminaVendita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("smartphone_vendite").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smartphone"] }),
  });
}

export async function documentoEsiste(numero: string, data: string) {
  const { data: r } = await supabase.from("smartphone_documenti").select("id").eq("numero", numero).eq("data_documento", data).limit(1);
  return (r?.length ?? 0) > 0;
}

/** Riga "piatta" per pezzo, comoda per tutte le schede. */
export interface RigaPezzo {
  pezzo: SpPezzo; articolo: SpArticolo; documento: SpDocumento; vendita: SpVendita | null;
  costo: number; previsto: number | null; venduto: number | null;
}

export function righePezzi(d: SpDati): RigaPezzo[] {
  const out: RigaPezzo[] = [];
  for (const p of d.pezzi) {
    const a = d.artById.get(p.articolo_id); const doc = d.docById.get(p.documento_id);
    if (!a || !doc) continue;
    const v = d.venditaByPezzo.get(p.id) ?? null;
    out.push({
      pezzo: p, articolo: a, documento: doc, vendita: v, costo: a.costo_unitario,
      previsto: v ? v.prezzo_previsto_al_momento : a.prezzo_previsto,
      venduto: v ? v.prezzo_vendita : null,
    });
  }
  return out;
}
