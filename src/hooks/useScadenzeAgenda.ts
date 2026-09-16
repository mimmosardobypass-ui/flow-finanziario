import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { oggiISO } from "@/components/finanziamenti/utils";

export interface ScadenzaAgenda {
  rata_id: string;
  scadenziario_id: string;
  user_id: string;
  numero_rata: number;
  numero_rate: number;
  data_scadenza: string;
  data_addebito: string;
  importo: number;
  spese_previste: number;
  importo_previsto: number;
  stato: "pagata" | "non_pagata";
  stato_agenda: "pagata" | "scaduta" | "da_pagare";
  stimata: boolean;
  giorni_alla_scadenza: number;
  giorni_ritardo: number;
  data_pagamento: string | null;
  importo_pagato: number | null;
  spese: number;
  transaction_id: string | null;
  fonte_pagamento: string | null;
  nota: string | null;
  tipo: string;
  stato_contratto: string;
  societa_finanziaria: string;
  numero_contratto: string;
  nome_visualizzato: string;
  riferimento: string | null;
  ente: string;
  beneficiario: string | null;
  origine_piano: string | null;
  piano_stimato: boolean;
  conto_id: string | null;
  nome_conto: string | null;
  tipo_conto: string | null;
  identificativo_conto: string | null;
}

export interface EntrataPrevista {
  user_id: string;
  conto_id: string;
  nome_conto: string;
  category_id: string | null;
  categoria: string;
  occorrenze: number;
  importo_previsto: number;
  ultima_data: string;
  prossima_data: string;
}

const numero = (v: unknown) => Number(v ?? 0);

function mappaScadenza(r: Record<string, unknown>): ScadenzaAgenda {
  return {
    rata_id: String(r.rata_id ?? ""), scadenziario_id: String(r.scadenziario_id ?? ""), user_id: String(r.user_id ?? ""),
    numero_rata: numero(r.numero_rata), numero_rate: numero(r.numero_rate), data_scadenza: String(r.data_scadenza ?? ""),
    data_addebito: String(r.data_addebito ?? r.data_scadenza ?? ""), importo: numero(r.importo),
    spese_previste: numero(r.spese_previste), importo_previsto: numero(r.importo_previsto),
    stato: r.stato === "pagata" ? "pagata" : "non_pagata",
    stato_agenda: r.stato_agenda === "pagata" || r.stato_agenda === "scaduta" ? r.stato_agenda : "da_pagare",
    stimata: Boolean(r.stimata), giorni_alla_scadenza: numero(r.giorni_alla_scadenza), giorni_ritardo: numero(r.giorni_ritardo),
    data_pagamento: r.data_pagamento ? String(r.data_pagamento) : null,
    importo_pagato: r.importo_pagato == null ? null : numero(r.importo_pagato), spese: numero(r.spese),
    transaction_id: r.transaction_id ? String(r.transaction_id) : null, fonte_pagamento: r.fonte_pagamento ? String(r.fonte_pagamento) : null,
    nota: r.nota ? String(r.nota) : null, tipo: String(r.tipo ?? "altro"), stato_contratto: String(r.stato_contratto ?? "attivo"),
    societa_finanziaria: String(r.societa_finanziaria ?? ""), numero_contratto: String(r.numero_contratto ?? ""),
    nome_visualizzato: String(r.nome_visualizzato ?? r.numero_contratto ?? "Contratto"), riferimento: r.riferimento ? String(r.riferimento) : null,
    ente: String(r.ente ?? r.societa_finanziaria ?? "—"), beneficiario: r.beneficiario ? String(r.beneficiario) : null,
    origine_piano: r.origine_piano ? String(r.origine_piano) : null, piano_stimato: Boolean(r.piano_stimato),
    conto_id: r.conto_id ? String(r.conto_id) : null, nome_conto: r.nome_conto ? String(r.nome_conto) : null,
    tipo_conto: r.tipo_conto ? String(r.tipo_conto) : null, identificativo_conto: r.identificativo_conto ? String(r.identificativo_conto) : null,
  };
}

export function useScadenzeAgenda() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["scadenze-agenda", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const limitePagate = subDays(new Date(`${oggiISO()}T12:00:00`), 90).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("v_scadenze_agenda")
        .select("*")
        .eq("stato_contratto", "attivo")
        .or(`stato_agenda.neq.pagata,data_pagamento.gte.${limitePagate}`)
        .order("data_addebito", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((r) => mappaScadenza(r as Record<string, unknown>));
    },
    enabled: Boolean(user),
  });
}

export function useEntratePreviste() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["entrate-previste", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("v_entrate_previste").select("*").order("prossima_data");
      if (error) throw error;
      return (data ?? []).filter((r) => r.conto_id && r.prossima_data).map((r): EntrataPrevista => ({
        user_id: String(r.user_id ?? ""), conto_id: String(r.conto_id), nome_conto: String(r.nome_conto ?? "—"),
        category_id: r.category_id, categoria: String(r.categoria ?? "Entrata prevista"), occorrenze: numero(r.occorrenze),
        importo_previsto: numero(r.importo_previsto), ultima_data: String(r.ultima_data ?? ""), prossima_data: String(r.prossima_data),
      }));
    },
    enabled: Boolean(user),
  });
}