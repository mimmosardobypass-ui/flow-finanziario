import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DocumentoPerMovimento {
  fattura_id: string;
  controparte: string | null;
  tipo: string;
  direzione: string;
  numero_documento: string | null;
  data_documento: string | null;
  data_scadenza: string | null;
  totale: number;
  residuo: number;
  effetto: number;
  giorni_scaduta: number | null;
  sdi_mancante: boolean;
  suggerito: boolean;
  gia_associato: boolean;
  importo_associato: number;
}

export function useDocumentiPerMovimento(
  transactionId: string | null,
  query: string,
  includiAssociati: boolean,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["documenti-per-movimento", user?.id, transactionId, query, includiAssociati],
    queryFn: async () => {
      if (!user || !transactionId) return [];
      const { data, error } = await supabase.rpc("find_documenti_per_movimento", {
        p_user_id: user.id,
        p_transaction_id: transactionId,
        p_query: query || "",
        p_includi_associati: includiAssociati,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        totale: Number(r.totale ?? 0),
        residuo: Number(r.residuo ?? 0),
        effetto: Number(r.effetto ?? 0),
        importo_associato: Number(r.importo_associato ?? 0),
        giorni_scaduta: r.giorni_scaduta === null ? null : Number(r.giorni_scaduta),
      })) as DocumentoPerMovimento[];
    },
    enabled: !!user && !!transactionId,
  });
}

export interface CombinazioneDocumenti {
  out_controparte: string | null;
  out_ids: string[];
  out_numeri: string[];
  out_somma: number;
}

export function useCombinazioniDocumenti(transactionId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["combinazioni-documenti", user?.id, transactionId],
    queryFn: async () => {
      if (!user || !transactionId) return [];
      const { data, error } = await supabase.rpc("find_combinazioni_documenti", {
        p_user_id: user.id,
        p_transaction_id: transactionId,
        p_max_documenti: 4,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        out_controparte: r.out_controparte,
        out_ids: r.out_ids ?? [],
        out_numeri: r.out_numeri ?? [],
        out_somma: Number(r.out_somma ?? 0),
      })) as CombinazioneDocumenti[];
    },
    enabled: !!user && !!transactionId,
  });
}

export function useAssociaDocumentiMovimento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transaction_id,
      fattura_ids,
      importi,
    }: {
      transaction_id: string;
      fattura_ids: string[];
      importi: number[];
    }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("associa_documenti_movimento", {
        p_user_id: user.id,
        p_transaction_id: transaction_id,
        p_fattura_ids: fattura_ids,
        p_importi: importi,
      });
      if (error) throw error;
      return data as unknown as { documenti: number; coperto: number; residuo_movimento: number };
    },
    onSuccess: (r) => {
      toast.success(`${r?.documenti ?? 0} documenti collegati al movimento`);
      qc.invalidateQueries({ queryKey: ["documenti-per-movimento"] });
      qc.invalidateQueries({ queryKey: ["combinazioni-documenti"] });
      qc.invalidateQueries({ queryKey: ["movimenti-copertura"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["documenti-saldi"] });
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
    },
    onError: (e: any) => toast.error(`Collegamento fallito: ${e?.message ?? e}`),
  });
}

export interface MovimentoCopertura {
  transaction_id: string;
  coperto: number;
  residuo: number;
  documenti_collegati: number;
}

export function useMovimentiCopertura() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["movimenti-copertura", user?.id],
    queryFn: async () => {
      if (!user) return new Map<string, MovimentoCopertura>();
      const { data, error } = await supabase
        .from("v_movimenti_copertura")
        .select("transaction_id, coperto, residuo, documenti_collegati")
        .gt("documenti_collegati", 0)
        .limit(5000);

      if (error) throw error;
      const map = new Map<string, MovimentoCopertura>();
      for (const r of data ?? []) {
        if (!r.transaction_id) continue;
        map.set(r.transaction_id, {
          transaction_id: r.transaction_id,
          coperto: Number(r.coperto ?? 0),
          residuo: Number(r.residuo ?? 0),
          documenti_collegati: Number(r.documenti_collegati ?? 0),
        });
      }
      return map;
    },
    enabled: !!user,
  });
}
