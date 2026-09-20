import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const n0 = (v: unknown) => Number(v ?? 0);

export function invalidaFinanziamenti(qc: QueryClient) {
  ["finanziamenti", "scadenziario", "scadenze_rate_unpaid", "scadenze-agenda", "transactions"].forEach((k) =>
    qc.invalidateQueries({ queryKey: [k] }),
  );
}

export interface Finanziamento {
  id: string;
  user_id: string;
  societa_finanziaria: string;
  nome: string | null;
  stato: string;
  forma: string | null;
  tipo: string;
  numero_contratto: string | null;
  numero_utilizzo: number | null;
  intestatario: string | null;
  beneficiario: string | null;
  conto_id: string | null;
  category_id: string | null;
  nome_conto: string | null;
  banca: string | null;
  categoria_nome: string | null;
  capitale: number | null;
  fido: number | null;
  tan: number | null;
  taeg: number | null;
  importo_rata: number | null;
  importo_totale: number;
  numero_rate: number;
  giorno_addebito: number | null;
  data_prima_scadenza: string | null;
  data_stipula: string | null;
  data_erogazione: string | null;
  data_estinzione: string | null;
  origine_piano: string | null;
  mandato_sdd: string | null;
  residuo_ente: number | null;
  residuo_ente_data: string | null;
  note: string | null;
  rate_totali: number;
  rate_pagate: number;
  rate_scadute: number;
  rate_senza_movimento: number;
  pagato_piano: number;
  residuo_da_pagare: number;
  residuo_capitale: number;
  interessi_residui: number;
  spese_totali: number;
  prossima_scadenza: string | null;
  prossima_importo: number | null;
  prossima_stimata: boolean | null;
  data_fine: string | null;
  differenza_residuo_ente: number | null;
  da_verificare: boolean;
}

function mapFinanziamento(r: Record<string, unknown>): Finanziamento {
  return {
    ...(r as unknown as Finanziamento),
    capitale: n(r.capitale),
    fido: n(r.fido),
    tan: n(r.tan),
    taeg: n(r.taeg),
    importo_rata: n(r.importo_rata),
    importo_totale: n0(r.importo_totale),
    numero_rate: n0(r.numero_rate),
    rate_totali: n0(r.rate_totali),
    rate_pagate: n0(r.rate_pagate),
    rate_scadute: n0(r.rate_scadute),
    rate_senza_movimento: n0(r.rate_senza_movimento),
    pagato_piano: n0(r.pagato_piano),
    residuo_da_pagare: n0(r.residuo_da_pagare),
    residuo_capitale: n0(r.residuo_capitale),
    interessi_residui: n0(r.interessi_residui),
    spese_totali: n0(r.spese_totali),
    prossima_importo: n(r.prossima_importo),
    differenza_residuo_ente: n(r.differenza_residuo_ente),
    da_verificare: !!r.da_verificare,
    stato: (r.stato as string) ?? "attivo",
  };
}

export function useFinanziamenti() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finanziamenti", "lista", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("v_finanziamenti")
        .select("*")
        .order("data_prima_scadenza", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapFinanziamento(r as Record<string, unknown>));
    },
    enabled: !!user,
  });
}

/** Movimento imputato a una rata (dalla colonna jsonb `movimenti` di v_rate_piano). */
export interface MovimentoImputato {
  transaction_id: string;
  data: string | null;
  descrizione: string | null;
  conto: string | null;
  importo_movimento: number;
  importo_imputato: number;
  ruolo: string;
  cumulativo: boolean;
  rate_coperte: number;
}

export interface RataFinanziamento {
  id: string;
  scadenziario_id: string;
  numero_rata: number;
  importo: number | null;
  data_scadenza: string | null;
  stato: string;
  transaction_id: string | null;
  stimata: boolean;
  quota_capitale: number | null;
  quota_interessi: number | null;
  debito_residuo: number | null;
  data_pagamento: string | null;
  importo_pagato: number | null;
  spese: number;
  tentativi_falliti: number;
  fonte_pagamento: string | null;
  confidenza: string | null;
  nota: string | null;
  imputato: number;
  residuo_rata: number;
  stato_effettivo: string;
  n_movimenti: number;
  da_pagamento_cumulativo: boolean;
  movimenti_imputati: MovimentoImputato[];
}

function mapMovimentiImputati(v: unknown): MovimentoImputato[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => {
    const m = (x ?? {}) as Record<string, unknown>;
    return {
      transaction_id: String(m.transaction_id ?? ""),
      data: (m.data as string | null) ?? null,
      descrizione: (m.descrizione as string | null) ?? null,
      conto: (m.conto as string | null) ?? null,
      importo_movimento: n0(m.importo_movimento),
      importo_imputato: n0(m.importo_imputato),
      ruolo: (m.ruolo as string) ?? "rata",
      cumulativo: !!m.cumulativo,
      rate_coperte: n0(m.rate_coperte),
    };
  });
}

function mapRata(r: Record<string, unknown>): RataFinanziamento {
  return {
    ...(r as unknown as RataFinanziamento),
    importo: n(r.importo),
    quota_capitale: n(r.quota_capitale),
    quota_interessi: n(r.quota_interessi),
    debito_residuo: n(r.debito_residuo),
    importo_pagato: n(r.importo_pagato),
    spese: n0(r.spese),
    tentativi_falliti: n0(r.tentativi_falliti),
    stimata: !!r.stimata,
    imputato: n0(r.imputato),
    residuo_rata: n0(r.residuo_rata),
    stato_effettivo: (r.stato_effettivo as string) ?? (r.stato as string) ?? "non_pagata",
    n_movimenti: n0(r.n_movimenti),
    da_pagamento_cumulativo: !!r.da_pagamento_cumulativo,
    movimenti_imputati: mapMovimentiImputati(r.movimenti),
  };
}

export interface MovimentoRata {
  id: string;
  rata_id: string | null;
  description: string | null;
  date: string;
  amount: number;
  conto_nome: string | null;
}

export interface EventoFinanziamento {
  id: string;
  scadenziario_id: string;
  rata_id: string | null;
  transaction_id: string | null;
  data: string;
  tipo: string;
  descrizione: string;
  importo: number | null;
  esito: string;
}

export interface RegolaFinanziamento {
  id: string;
  scadenziario_id: string;
  ruolo: string;
  conto_id: string | null;
  testo: string;
  confidenza: string;
  importo_min: number | null;
  importo_max: number | null;
  giorni_prima: number;
  giorni_dopo: number;
  attiva: boolean;
  note: string | null;
}

export function useFinanziamentoDettaglio(scadenziarioId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finanziamenti", "dettaglio", user?.id, scadenziarioId],
    queryFn: async () => {
      if (!user || !scadenziarioId)
        return { rate: [], movimenti: {}, spese_movimenti: {}, eventi: [], regole: [] } as {
          rate: RataFinanziamento[];
          movimenti: Record<string, MovimentoRata>;
          spese_movimenti: Record<string, MovimentoRata[]>;
          eventi: EventoFinanziamento[];
          regole: RegolaFinanziamento[];
        };

      const [rateRes, eventiRes, regoleRes] = await Promise.all([
        supabase
          .from("v_rate_piano")
          .select("*")
          .eq("scadenziario_id", scadenziarioId)
          .order("numero_rata"),
        supabase
          .from("finanziamento_eventi")
          .select("*")
          .eq("scadenziario_id", scadenziarioId)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("finanziamento_regole")
          .select("*")
          .eq("scadenziario_id", scadenziarioId)
          .order("created_at"),
      ]);
      if (rateRes.error) throw rateRes.error;
      if (eventiRes.error) throw eventiRes.error;
      if (regoleRes.error) throw regoleRes.error;

      const rate = (rateRes.data ?? []).map((r) => mapRata(r as Record<string, unknown>));
      const rataIds = rate.map((r) => r.id);

      const movimenti: Record<string, MovimentoRata> = {};
      const spese_movimenti: Record<string, MovimentoRata[]> = {};
      if (rataIds.length) {
        const { data: tx, error: txErr } = await supabase
          .from("transactions")
          .select("id, rata_id, description, date, amount, conti(nome_conto)")
          .in("rata_id", rataIds)
          .is("deleted_at", null)
          .order("date");
        if (txErr) throw txErr;

        // Il movimento principale è quello indicato da rata.transaction_id:
        // gli altri collegati alla stessa rata sono spese accessorie (commissioni).
        const principaleDiRata = new Map<string, string>();
        rate.forEach((r) => {
          if (r.transaction_id) principaleDiRata.set(r.id, r.transaction_id);
        });

        (tx ?? []).forEach((t) => {
          const row = t as unknown as {
            id: string;
            rata_id: string | null;
            description: string | null;
            date: string;
            amount: number;
            conti: { nome_conto: string } | null;
          };
          if (!row.rata_id) return;
          const mov: MovimentoRata = {
            id: row.id,
            rata_id: row.rata_id,
            description: row.description,
            date: row.date,
            amount: n0(row.amount),
            conto_nome: row.conti?.nome_conto ?? null,
          };
          const principale = principaleDiRata.get(row.rata_id);
          if (principale ? principale === row.id : !movimenti[row.rata_id]) {
            movimenti[row.rata_id] = mov;
          } else {
            (spese_movimenti[row.rata_id] ??= []).push(mov);
          }
        });
      }

      const eventi = (eventiRes.data ?? []).map((e) => ({
        ...(e as unknown as EventoFinanziamento),
        importo: n((e as Record<string, unknown>).importo),
      }));
      const regole = (regoleRes.data ?? []).map((r) => ({
        ...(r as unknown as RegolaFinanziamento),
        importo_min: n((r as Record<string, unknown>).importo_min),
        importo_max: n((r as Record<string, unknown>).importo_max),
      }));

      return { rate, movimenti, spese_movimenti, eventi, regole };
    },
    enabled: !!user && !!scadenziarioId,
  });
}

export interface RataAperta {
  id: string;
  scadenziario_id: string;
  numero_rata: number;
  importo: number;
  data_scadenza: string;
  ente: string;
  nome: string | null;
  conto_nome: string | null;
  banca: string | null;
}

/** Rate non pagate dei finanziamenti attivi (per riepiloghi, grafico e scadenze). */
export function useRateFinanziamentiAperte() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finanziamenti", "rate-aperte", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("scadenze_rate")
        .select(
          "id, scadenziario_id, numero_rata, importo, data_scadenza, stato, scadenziario!inner(id, nome, societa_finanziaria, stato, tipo, conti(nome_conto, banca))",
        )
        .eq("stato", "non_pagata")
        .eq("scadenziario.tipo", "finanziamento")
        .eq("scadenziario.stato", "attivo")
        .not("data_scadenza", "is", null)
        .order("data_scadenza")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const row = r as unknown as {
          id: string;
          scadenziario_id: string;
          numero_rata: number;
          importo: number | null;
          data_scadenza: string;
          scadenziario: {
            nome: string | null;
            societa_finanziaria: string;
            conti: { nome_conto: string; banca: string | null } | null;
          };
        };
        return {
          id: row.id,
          scadenziario_id: row.scadenziario_id,
          numero_rata: n0(row.numero_rata),
          importo: n0(row.importo),
          data_scadenza: row.data_scadenza,
          ente: row.scadenziario.societa_finanziaria,
          nome: row.scadenziario.nome,
          conto_nome: row.scadenziario.conti?.nome_conto ?? null,
          banca: row.scadenziario.conti?.banca ?? null,
        } as RataAperta;
      });
    },
    enabled: !!user,
  });
}

export interface PropostaRata {
  scadenziario_id: string;
  rata_id: string;
  numero_rata: number;
  data_scadenza: string;
  importo_rata: number;
  transaction_id: string;
  data_movimento: string;
  importo_movimento: number;
  descrizione: string | null;
  conto_id: string | null;
  confidenza: string;
  giorni_scarto: number;
}

export function useProposteRate(scadenziarioId?: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finanziamenti", "proposte", user?.id, scadenziarioId ?? "tutti"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("trova_rate_finanziamenti", {
        p_user_id: user.id,
        ...(scadenziarioId ? { p_scadenziario_id: scadenziarioId } : {}),
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        importo_rata: n0(r.importo_rata),
        importo_movimento: n0(r.importo_movimento),
        numero_rata: n0(r.numero_rata),
        giorni_scarto: n0(r.giorni_scarto),
      })) as PropostaRata[];
    },
    enabled: !!user && enabled,
  });
}

export function useCollegaRata() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rata_id,
      transaction_id,
      confidenza = "manuale",
    }: {
      rata_id: string;
      transaction_id: string;
      confidenza?: string;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("collega_rata_finanziamento", {
        p_user_id: user.id,
        p_rata_id: rata_id,
        p_transaction_id: transaction_id,
        p_confidenza: confidenza,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

export function useAbbinaRate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scadenziario_id,
      includi_media = false,
    }: { scadenziario_id?: string | null; includi_media?: boolean } = {}) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("abbina_rate_finanziamenti", {
        p_user_id: user.id,
        p_includi_media: includi_media,
        ...(scadenziario_id ? { p_scadenziario_id: scadenziario_id } : {}),
      });
      if (error) throw error;
      return n0(data);
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

export function useScollegaRata() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rata_id: string) => {
      if (!user) throw new Error("Non autenticato");
      const { error } = await supabase.rpc("scollega_rata_finanziamento", {
        p_user_id: user.id,
        p_rata_id: rata_id,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

export function useSegnaRataPagataEnte() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rata_id, data, nota }: { rata_id: string; data: string; nota?: string }) => {
      if (!user) throw new Error("Non autenticato");
      const { error } = await supabase.rpc("segna_rata_pagata_ente", {
        p_user_id: user.id,
        p_rata_id: rata_id,
        p_data: data,
        ...(nota ? { p_nota: nota } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

export interface EsitoResiduo {
  residuo_ente: number;
  residuo_calcolato: number;
  differenza: number;
}

export function useRegistraResiduoEnte() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scadenziario_id,
      importo,
      data,
    }: {
      scadenziario_id: string;
      importo: number;
      data: string;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const { data: res, error } = await supabase.rpc("registra_residuo_ente", {
        p_user_id: user.id,
        p_scadenziario_id: scadenziario_id,
        p_importo: importo,
        p_data: data,
      });
      if (error) throw error;
      const r = (res ?? {}) as Record<string, unknown>;
      return {
        residuo_ente: n0(r.residuo_ente),
        residuo_calcolato: n0(r.residuo_calcolato),
        differenza: n0(r.differenza),
      } as EsitoResiduo;
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

/* ---------- Contratto: creazione, modifica, estinzione ---------- */

export interface RataDaCreare {
  numero_rata: number;
  importo: number;
  data_scadenza: string;
  quota_capitale: number | null;
  quota_interessi: number | null;
  debito_residuo: number | null;
}

export interface DatiContratto {
  societa_finanziaria: string;
  nome: string | null;
  beneficiario: string | null;
  intestatario: string | null;
  conto_id: string | null;
  category_id: string | null;
  numero_contratto: string;
  forma: string | null;
  capitale: number | null;
  tan: number | null;
  taeg: number | null;
  importo_rata: number | null;
  data_stipula: string | null;
  data_erogazione: string | null;
  mandato_sdd: string | null;
  note: string | null;
}

export function useCreateFinanziamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contratto,
      rate,
      origine_piano,
      testo_regola,
      scadenziario_id,
    }: {
      contratto: DatiContratto;
      rate: RataDaCreare[];
      origine_piano: string;
      testo_regola: string;
      scadenziario_id?: string | null;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const totale = rate.reduce((s, r) => s + r.importo, 0);
      const prima = rate[0]?.data_scadenza ?? null;
      const payload = {
        ...contratto,
        tipo: "finanziamento",
        stato: "attivo",
        modalita_importo: "manuale",
        importo_totale: Math.round(totale * 100) / 100,
        numero_rate: rate.length,
        data_prima_scadenza: prima,
        giorno_addebito: prima ? Number(prima.slice(8, 10)) : null,
        origine_piano,
      };

      let contrattoId = scadenziario_id ?? null;
      if (contrattoId) {
        const { error } = await supabase
          .from("scadenziario")
          .update(payload)
          .eq("id", contrattoId);
        if (error) throw error;
        await supabase.from("scadenze_rate").delete().eq("scadenziario_id", contrattoId);
      } else {
        const { data, error } = await supabase
          .from("scadenziario")
          .insert({ ...payload, user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        contrattoId = data.id;
      }

      const { error: errRate } = await supabase.from("scadenze_rate").insert(
        rate.map((r) => ({
          scadenziario_id: contrattoId!,
          user_id: user.id,
          numero_rata: r.numero_rata,
          importo: r.importo,
          data_scadenza: r.data_scadenza,
          stato: "non_pagata",
          quota_capitale: r.quota_capitale,
          quota_interessi: r.quota_interessi,
          debito_residuo: r.debito_residuo,
        })),
      );
      if (errRate) throw errRate;

      const testo = testo_regola.trim();
      if (testo) {
        const { data: esistenti } = await supabase
          .from("finanziamento_regole")
          .select("id")
          .eq("scadenziario_id", contrattoId!)
          .eq("ruolo", "rata");
        if (!esistenti?.length) {
          const { error: errRegola } = await supabase.from("finanziamento_regole").insert({
            user_id: user.id,
            scadenziario_id: contrattoId!,
            ruolo: "rata",
            conto_id: contratto.conto_id,
            testo: `%${testo}%`,
            confidenza: "alta",
            importo_min: -0.02,
            importo_max: 0.02,
            giorni_prima: 3,
            giorni_dopo: 10,
            attiva: true,
          });
          if (errRegola) throw errRegola;
        }
      }

      if (contratto.data_stipula) {
        await supabase.from("finanziamento_eventi").insert({
          user_id: user.id,
          scadenziario_id: contrattoId!,
          data: contratto.data_stipula,
          tipo: "stipula",
          descrizione: `Stipula contratto ${contratto.societa_finanziaria}`,
          esito: "info",
        });
      }

      const { data: collegate } = await supabase.rpc("abbina_rate_finanziamenti", {
        p_user_id: user.id,
        p_scadenziario_id: contrattoId!,
        p_includi_media: false,
      });

      return { id: contrattoId!, collegate: n0(collegate) };
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

export function useUpdateFinanziamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dati }: { id: string; dati: Record<string, unknown> }) => {
      const { error } = await supabase.from("scadenziario").update(dati).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

export function useEstinguiFinanziamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Non autenticato");
      const oggi = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase
        .from("scadenziario")
        .update({ stato: "estinto", data_estinzione: oggi })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("finanziamento_eventi").insert({
        user_id: user.id,
        scadenziario_id: id,
        data: oggi,
        tipo: "estinzione",
        descrizione: "Contratto segnato come estinto",
        esito: "info",
      });
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

/* ---------- Regole di riconoscimento ---------- */

export function useSalvaRegola() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RegolaFinanziamento> & { scadenziario_id: string }) => {
      if (!user) throw new Error("Non autenticato");
      if (input.id) {
        const { id, ...rest } = input;
        const { error } = await supabase.from("finanziamento_regole").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finanziamento_regole").insert({
          user_id: user.id,
          scadenziario_id: input.scadenziario_id,
          ruolo: input.ruolo ?? "rata",
          conto_id: input.conto_id ?? null,
          testo: input.testo ?? "",
          confidenza: input.confidenza ?? "alta",
          importo_min: input.importo_min ?? null,
          importo_max: input.importo_max ?? null,
          giorni_prima: input.giorni_prima ?? 3,
          giorni_dopo: input.giorni_dopo ?? 10,
          attiva: input.attiva ?? true,
          note: input.note ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

/* ---------- Movimenti candidati per collegamento manuale ---------- */

export interface MovimentoCandidato {
  id: string;
  description: string | null;
  date: string;
  amount: number;
  conto_nome: string | null;
}

export function useMovimentiCandidati(rataId: string | null, query: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finanziamenti", "candidati", user?.id, rataId, query],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from("transactions")
        .select("id, description, date, amount, conti(nome_conto)")
        .eq("type", "expense")
        .is("rata_id", null)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(300);
      if (query.trim()) q = q.ilike("description", `%${query.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((t) => {
        const row = t as unknown as {
          id: string;
          description: string | null;
          date: string;
          amount: number;
          conti: { nome_conto: string } | null;
        };
        return {
          id: row.id,
          description: row.description,
          date: row.date,
          amount: n0(row.amount),
          conto_nome: row.conti?.nome_conto ?? null,
        } as MovimentoCandidato;
      });
    },
    enabled: !!user && !!rataId,
  });
}

/* ---------- Imputazione di un pagamento su più rate ---------- */

export interface RataPerMovimento {
  rata_id: string;
  scadenziario_id: string;
  piano: string | null;
  numero_rata: number;
  data_scadenza: string | null;
  importo: number;
  gia_imputato: number;
  residuo: number;
  quota_proposta: number;
  preselezionata: boolean;
}

/** Rate aperte imputabili a un movimento. */
export function useRatePerMovimento(transactionId: string | null, scadenziarioId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finanziamenti", "rate-per-movimento", user?.id, transactionId, scadenziarioId ?? "tutti"],
    queryFn: async () => {
      if (!user || !transactionId) return [] as RataPerMovimento[];
      const { data, error } = await supabase.rpc("trova_rate_per_movimento", {
        p_user_id: user.id,
        p_transaction_id: transactionId,
        ...(scadenziarioId ? { p_scadenziario_id: scadenziarioId } : {}),
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        numero_rata: n0(r.numero_rata),
        importo: n0(r.importo),
        gia_imputato: n0(r.gia_imputato),
        residuo: n0(r.residuo),
        quota_proposta: n0(r.quota_proposta),
        preselezionata: !!r.preselezionata,
      })) as RataPerMovimento[];
    },
    enabled: !!user && !!transactionId,
  });
}

export interface EsitoImputazione {
  importo_movimento: number;
  imputato_ora: number;
  residuo_non_imputato: number;
}

export function useImputaPagamentoRate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transaction_id,
      rata_ids,
      confidenza = "manuale",
    }: {
      transaction_id: string;
      rata_ids: string[];
      confidenza?: string;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("imputa_pagamento_rate", {
        p_user_id: user.id,
        p_transaction_id: transaction_id,
        p_rata_ids: rata_ids,
        p_confidenza: confidenza,
      });
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        importo_movimento: n0(r.importo_movimento),
        imputato_ora: n0(r.imputato_ora),
        residuo_non_imputato: n0(r.residuo_non_imputato),
      } as EsitoImputazione;
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

export function useScollegaPagamentoRata() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rata_id = null,
      transaction_id = null,
    }: { rata_id?: string | null; transaction_id?: string | null }) => {
      if (!user) throw new Error("Non autenticato");
      const { error } = await supabase.rpc("scollega_pagamento_rata", {
        p_user_id: user.id,
        ...(rata_id ? { p_rata_id: rata_id } : {}),
        ...(transaction_id ? { p_transaction_id: transaction_id } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => invalidaFinanziamenti(qc),
  });
}

/* ---------- Proposte di pagamenti cumulativi ---------- */

export interface RigaCumulativa {
  rata_id: string;
  numero_rata: number;
  scadenza: string | null;
  residuo: number;
  quota: number;
  chiude: boolean;
}

export interface PagamentoCumulativo {
  transaction_id: string;
  data: string;
  importo: number;
  descrizione: string | null;
  conto: string | null;
  scadenziario_id: string;
  piano: string | null;
  n_rate: number;
  rate_chiuse: number;
  con_acconto: number;
  importo_imputabile: number;
  residuo_non_imputato: number;
  scarto_max_giorni: number;
  tipo: string;
  confidenza: string;
  ambiguo: boolean;
  avviso: string | null;
  righe: RigaCumulativa[];
}

function mapRigheCumulative(v: unknown): RigaCumulativa[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    return {
      rata_id: String(r.rata_id ?? ""),
      numero_rata: n0(r.numero_rata),
      scadenza: (r.scadenza as string | null) ?? null,
      residuo: n0(r.residuo),
      quota: n0(r.quota),
      chiude: !!r.chiude,
    };
  });
}

/** Cerca i movimenti che coprono più rate (o parte di una rata). */
export function useTrovaPagamentiCumulativi() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (scadenziarioId?: string | null) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("trova_pagamenti_cumulativi", {
        p_user_id: user.id,
        ...(scadenziarioId ? { p_scadenziario_id: scadenziarioId } : {}),
      });
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({
          ...r,
          importo: n0(r.importo),
          n_rate: n0(r.n_rate),
          rate_chiuse: n0(r.rate_chiuse),
          con_acconto: n0(r.con_acconto),
          importo_imputabile: n0(r.importo_imputabile),
          residuo_non_imputato: n0(r.residuo_non_imputato),
          scarto_max_giorni: n0(r.scarto_max_giorni),
          ambiguo: !!r.ambiguo,
          avviso: (r.avviso as string | null) ?? null,
          righe: mapRigheCumulative(r.righe),
        }))
        .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")) as PagamentoCumulativo[];
    },
  });
}
