import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PianoRate {
  fattura_id: string;
  controparte: string | null;
  numero_documento: string | null;
  data_documento: string | null;
  totale_fattura: number;
  residuo_fattura: number;
  transaction_ids: string[];
  date_rate: string[];
  importi_rate: number[];
  rate_trovate: number;
  rate_previste: number;
  importo_trovato: number;
  prossima_rata_attesa: string | null;
  stato: "completo" | "in corso" | string;
  confidenza: "alta" | "media" | "bassa" | "dubbio" | string;
}

export function useFindPianiRate() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("find_piani_rate", { p_user_id: user.id });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        totale_fattura: Number(r.totale_fattura ?? 0),
        residuo_fattura: Number(r.residuo_fattura ?? 0),
        importo_trovato: Number(r.importo_trovato ?? 0),
        rate_trovate: Number(r.rate_trovate ?? 0),
        rate_previste: Number(r.rate_previste ?? 0),
        transaction_ids: r.transaction_ids ?? [],
        date_rate: r.date_rate ?? [],
        importi_rate: (r.importi_rate ?? []).map((x: any) => Number(x)),
      })) as PianoRate[];
    },
  });
}

export function useCollegaPianoRate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fattura_id,
      transaction_ids,
      crea_scadenziario = true,
    }: {
      fattura_id: string;
      transaction_ids: string[];
      crea_scadenziario?: boolean;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("collega_piano_rate", {
        p_user_id: user.id,
        p_fattura_id: fattura_id,
        p_transaction_ids: transaction_ids,
        p_crea_scadenziario: crea_scadenziario,
      });
      if (error) throw error;
      return data as unknown as {
        rate_collegate: number;
        piano_completo: boolean;
        importo: number;
        arrotondamento: number;
        residuo_fattura: number;
        stato: string;
        scadenziario_id?: string | null;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
      qc.invalidateQueries({ queryKey: ["documenti-saldi"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["movimenti-copertura"] });
    },
  });
}
