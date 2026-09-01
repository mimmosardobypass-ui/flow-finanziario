import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { excelSerialToDate } from "@/utils/excelDate";

export interface Fattura {
  id: string;
  user_id: string;
  fornitore_id: string | null;
  numero_documento: string | null;
  identificativo_sdi: string | null;
  data_documento: string;
  data_notifica: string | null;
  tipo: string;
  mittente: string;
  piva_mittente: string | null;
  totale: number;
  imponibile: number | null;
  iva: number | null;
  condizioni_pagamento: string | null;
  data_scadenza: string | null;
  importo_scadenza: number | null;
  stato_pagamento: string;
  data_pagamento: string | null;
  transaction_id: string | null;
  category_id: string | null;
  note: string | null;
  nome_file: string | null;
  origine: string;
  sdi_mancante: boolean;
  data_verifica_sdi: string | null;
  created_at: string;
  updated_at: string;
}

export const ORIGINE_LABELS: Record<string, string> = {
  sdi: "Fattura elettronica (SdI)",
  portale_fornitore: "Portale fornitore",
  manuale: "Inserimento manuale",
  cartacea: "Documento cartaceo",
};

export interface FatturaSdiMancante {
  id: string;
  mittente: string | null;
  numero_documento: string | null;
  data_documento: string | null;
  totale: number | null;
  stato_pagamento: string | null;
  origine: string | null;
  giorni_attesa: number | null;
  livello: string | null;
}

export function useFattureSdiMancanti() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fatture-sdi-mancanti", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("v_fatture_sdi_mancanti")
        .select("id, mittente, numero_documento, data_documento, totale, stato_pagamento, origine, giorni_attesa, livello")
        .order("giorni_attesa", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as FatturaSdiMancante[];
    },
    enabled: !!user,
  });
}

export interface FatturaWithRel extends Fattura {
  fornitore: { id: string; nome: string; piva: string | null } | null;
  category: { id: string; name: string } | null;
}

export interface FattureFilters {
  stato?: string;
  fornitore_id?: string;
  mese?: number;
  anno?: number;
}

export function useFattureFornitori(filters?: FattureFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fatture-fornitori", user?.id, filters],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from("fatture_fornitori")
        .select(`
          *,
          fornitore:fornitori (id, nome, piva),
          category:categories (id, name)
        `)
        .order("data_documento", { ascending: false })
        .limit(5000);

      if (filters?.stato && filters.stato !== "all") q = q.eq("stato_pagamento", filters.stato);
      if (filters?.fornitore_id && filters.fornitore_id !== "all") q = q.eq("fornitore_id", filters.fornitore_id);
      if (filters?.anno) {
        const m = filters.mese;
        if (m) {
          const start = new Date(filters.anno, m - 1, 1).toISOString().slice(0, 10);
          const end = new Date(filters.anno, m, 0).toISOString().slice(0, 10);
          q = q.gte("data_documento", start).lte("data_documento", end);
        } else {
          q = q.gte("data_documento", `${filters.anno}-01-01`).lte("data_documento", `${filters.anno}-12-31`);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FatturaWithRel[];
    },
    enabled: !!user,
  });
}

export interface PagamentoProposta {
  fattura_id: string;
  mittente: string | null;
  numero_documento: string | null;
  data_documento: string | null;
  totale: number | null;
  transaction_id: string;
  data_pagamento: string | null;
  importo_pagamento: number | null;
  descrizione: string | null;
  scarto: number | null;
  giorni: number | null;
  confidenza: string | null;
  candidati: number | null;
}

export function usePagamentiFatture() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pagamenti-fatture", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("find_pagamenti_fatture", { p_user_id: user.id });
      if (error) throw error;
      const rows = (data ?? []) as unknown as PagamentoProposta[];
      return [...rows].sort((a, b) =>
        String(b.data_documento ?? "").localeCompare(String(a.data_documento ?? ""))
      );
    },
    enabled: !!user,
  });
}

export function useCollegaPagamentiFatture() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pairs: { fattura_id: string; transaction_id: string }[]) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("collega_pagamenti_fatture", {
        p_user_id: user.id,
        p_fattura_ids: pairs.map((p) => p.fattura_id),
        p_transaction_ids: pairs.map((p) => p.transaction_id),
      });
      if (error) throw error;
      return data as unknown as { collegate: number; saltate: number };
    },
    onSuccess: (r) => {
      toast.success(`${r?.collegate ?? 0} fatture collegate · ${r?.saltate ?? 0} saltate`);
      qc.invalidateQueries({ queryKey: ["pagamenti-fatture"] });
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
      qc.invalidateQueries({ queryKey: ["fatture-sdi-mancanti"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: any) => toast.error(`Abbinamento fallito: ${e?.message ?? e}`),
  });
}

export function useFattureStats() {
  const { data: fatture = [] } = useFattureFornitori();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const meseFatt = fatture.filter((f) => f.data_documento.startsWith(ym) && f.imponibile !== null);
  return {
    daPagare: fatture.filter((f) => f.stato_pagamento === "da_pagare").reduce((s, f) => s + Number(f.totale), 0),
    pagate: fatture.filter((f) => f.stato_pagamento === "pagata").reduce((s, f) => s + Number(f.totale), 0),
    imponibileMese: meseFatt.reduce((s, f) => s + Number(f.imponibile ?? 0), 0),
  };
}


export function useCreateFattura() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Fattura>) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase
        .from("fatture_fornitori")
        .insert({ ...input, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }); qc.invalidateQueries({ queryKey: ["fatture-sdi-mancanti"] }); },
  });
}

export function useUpdateFattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Fattura> & { id: string }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("fatture_fornitori")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }); qc.invalidateQueries({ queryKey: ["fatture-sdi-mancanti"] }); },
  });
}

export function useDeleteFattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fatture_fornitori").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }); qc.invalidateQueries({ queryKey: ["fatture-sdi-mancanti"] }); },
  });
}

export function useCollegaTransazione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fattura_id,
      transaction_id,
      data_pagamento,
    }: {
      fattura_id: string;
      transaction_id: string;
      data_pagamento: string;
    }) => {
      const { data, error } = await supabase
        .from("fatture_fornitori")
        .update({
          transaction_id,
          stato_pagamento: "pagata",
          data_pagamento,
        })
        .eq("id", fattura_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }); qc.invalidateQueries({ queryKey: ["fatture-sdi-mancanti"] }); },
  });
}

function parseDate(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const d = excelSerialToDate(value);
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, dd, mm, yy] = m;
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}


export function useImportFattureExcel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Non autenticato");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

      let imported = 0;
      let skipped = 0;
      let linked = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const totale = row["Totale"];
          if (totale === null || totale === undefined || totale === "") continue;
          const sdi = row["Identificativo SDI"];
          if (!sdi) continue;

          const { data, error } = await supabase.rpc("import_fattura_sdi", {
            p_user_id: user.id,
            p_numero_documento: row["Numero Documento"] ? String(row["Numero Documento"]) : null,
            p_identificativo_sdi: String(sdi),
            p_data_documento: parseDate(row["Data Documento"]) ?? new Date().toISOString().slice(0, 10),
            p_data_notifica: parseDate(row["Data Notifica"]),
            p_tipo: row["Tipo"] ?? "Fattura",
            p_mittente: row["Mittente"] ?? "",
            p_piva_mittente: row["P. Iva"] ? String(row["P. Iva"]) : null,
            p_totale: Number(totale),
            p_imponibile: row["Imponibile"] ? Number(row["Imponibile"]) : null,
            p_condizioni_pagamento: row["Condizioni Pagamento Scadenza"] ?? null,
            p_data_scadenza: parseDate(row["Scadenza"]),
            p_importo_scadenza: row["Importo Scadenza"] ? Number(row["Importo Scadenza"]) : null,
            p_nome_file: row["Nome File"] ?? null,
          });
          if (error) {
            errors.push(error.message);
            continue;
          }
          const res = data as any;
          if (res?.status === "skipped") skipped++;
          else if (res?.status === "imported") {
            imported++;
            if (res?.transaction_id) linked++;
          }
        } catch (e: any) {
          errors.push(e?.message ?? "errore");
        }
      }

      return { imported, skipped, linked, errors };
    },
    onSuccess: (r) => {
      toast.success(
        `Importate ${r.imported} fatture · ${r.linked} già collegate a un pagamento · ${r.skipped} duplicate saltate`
      );
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
      qc.invalidateQueries({ queryKey: ["fornitori"] });
    },
    onError: (e: any) => toast.error(`Import fallito: ${e?.message ?? e}`),
  });
}

/* ---------- Nuove viste documenti ---------- */

export interface DocumentoSaldo {
  id: string;
  direzione: string;
  tipo: string;
  controparte: string | null;
  numero_documento: string | null;
  data_documento: string | null;
  data_scadenza: string | null;
  totale: number;
  residuo: number;
  imputato: number;
  stato_pagamento: string;
  sdi_mancante: boolean;
  origine: string | null;
  giorni_scaduta: number | null;
  fornitore_id: string | null;
}

export function useDocumentiSaldi(direzione: "passiva" | "attiva") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["documenti-saldi", user?.id, direzione],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("v_documenti_saldi")
        .select("id, direzione, tipo, controparte, numero_documento, data_documento, data_scadenza, totale, residuo, imputato, stato_pagamento, sdi_mancante, origine, giorni_scaduta, fornitore_id")
        .eq("direzione", direzione)
        .order("data_documento", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        direzione: r.direzione ?? direzione,
        tipo: r.tipo ?? "Fattura",
        controparte: r.controparte,
        numero_documento: r.numero_documento,
        data_documento: r.data_documento,
        data_scadenza: r.data_scadenza,
        totale: Number(r.totale ?? 0),
        residuo: Number(r.residuo ?? 0),
        imputato: Number(r.imputato ?? 0),
        stato_pagamento: r.stato_pagamento ?? "da_pagare",
        sdi_mancante: !!r.sdi_mancante,
        origine: r.origine,
        giorni_scaduta: r.giorni_scaduta === null ? null : Number(r.giorni_scaduta),
        fornitore_id: r.fornitore_id,
      })) as DocumentoSaldo[];
    },
    enabled: !!user,
  });
}

export interface DocumentoPagamento {
  fattura_id: string;
  transaction_id: string | null;
  compensazione_id: string | null;
  importo_imputato: number;
  data_movimento: string | null;
  importo_movimento: number;
  descrizione_movimento: string | null;
  conto: string | null;
  legame_id: string | null;
}


export function useDocumentoPagamenti(fatturaId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["documento-pagamenti", user?.id, fatturaId],
    queryFn: async () => {
      if (!user || !fatturaId) return [];
      const { data, error } = await supabase
        .from("v_documento_pagamenti")
        .select("fattura_id, transaction_id, compensazione_id, legame_id, importo_imputato, data_movimento, importo_movimento, descrizione_movimento, conto")
        .eq("fattura_id", fatturaId)
        .order("data_movimento", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        fattura_id: r.fattura_id as string,
        transaction_id: r.transaction_id,
        compensazione_id: r.compensazione_id,
        legame_id: r.legame_id,
        importo_imputato: Number(r.importo_imputato ?? 0),
        data_movimento: r.data_movimento,
        importo_movimento: Number(r.importo_movimento ?? 0),
        descrizione_movimento: r.descrizione_movimento,
        conto: r.conto,
      })) as DocumentoPagamento[];
    },
    enabled: !!user && !!fatturaId,
  });
}

/* ---------- Compensazione fattura ↔ nota di credito ---------- */

export interface NotaCreditoCompensabile {
  nota_id: string;
  numero_documento: string | null;
  data_documento: string | null;
  totale: number;
  residuo: number;
  compensabile: number;
}

/** Carica (on demand) le note di credito compensabili con una fattura. */
export function useFindNoteCreditoCompensabili() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (fatturaId: string) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("find_note_credito_compensabili", {
        p_user_id: user.id,
        p_fattura_id: fatturaId,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        nota_id: r.nota_id,
        numero_documento: r.numero_documento,
        data_documento: r.data_documento,
        totale: Number(r.totale ?? 0),
        residuo: Number(r.residuo ?? 0),
        compensabile: Number(r.compensabile ?? 0),
      })) as NotaCreditoCompensabile[];
    },
  });
}

function invalidaDocumenti(qc: ReturnType<typeof useQueryClient>) {
  [
    "fatture-fornitori", "fatture-sdi-mancanti", "documenti-saldi", "documento-pagamenti",
    "esposizione-controparti", "pagamenti-fatture", "documenti-per-movimento",
    "combinazioni-documenti", "movimenti-copertura",
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useCompensaDocumenti() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fattura_id: string; nota_id: string; importo?: number | null; data?: string | null }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("compensa_documenti", {
        p_user_id: user.id,
        p_fattura_id: input.fattura_id,
        p_nota_id: input.nota_id,
        p_importo: input.importo ?? undefined,
        p_data: input.data ?? undefined,
      });
      if (error) throw error;
      return data as unknown as {
        compensazione_id: string; importo: number; fattura: string; nota: string;
        residuo_fattura: number; residuo_nota: number;
      };
    },
    onSuccess: () => invalidaDocumenti(qc),
  });
}

export function useAnnullaCompensazione() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (compensazioneId: string) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("annulla_compensazione", {
        p_user_id: user.id,
        p_compensazione_id: compensazioneId,
      });
      if (error) throw error;
      return data as unknown as { righe_rimosse: number };
    },
    onSuccess: () => {
      toast.success("Compensazione annullata");
      invalidaDocumenti(qc);
    },
    onError: (e: any) => toast.error(`${e?.message ?? e}`),
  });
}


export interface EsposizioneControparte {
  controparte: string;
  documenti: number;
  aperto: number;
  a_scadere: number;
  scaduto_1_30: number;
  scaduto_31_90: number;
  scaduto_oltre_90: number;
}

export function useEsposizioneControparti() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["esposizione-controparti", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("v_esposizione_controparti")
        .select("controparte, documenti, aperto, a_scadere, scaduto_1_30, scaduto_31_90, scaduto_oltre_90")
        .order("aperto", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        controparte: r.controparte ?? "—",
        documenti: Number(r.documenti ?? 0),
        aperto: Number(r.aperto ?? 0),
        a_scadere: Number(r.a_scadere ?? 0),
        scaduto_1_30: Number(r.scaduto_1_30 ?? 0),
        scaduto_31_90: Number(r.scaduto_31_90 ?? 0),
        scaduto_oltre_90: Number(r.scaduto_oltre_90 ?? 0),
      })) as EsposizioneControparte[];
    },
    enabled: !!user,
  });
}

export function useDissociaDocumento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fattura_id, transaction_id }: { fattura_id: string; transaction_id: string }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("dissocia_documento", {
        p_user_id: user.id,
        p_fattura_id: fattura_id,
        p_transaction_id: transaction_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Pagamento staccato dal documento");
      qc.invalidateQueries({ queryKey: ["documento-pagamenti"] });
      qc.invalidateQueries({ queryKey: ["documenti-per-movimento"] });
      qc.invalidateQueries({ queryKey: ["combinazioni-documenti"] });
      qc.invalidateQueries({ queryKey: ["movimenti-copertura"] });
      qc.invalidateQueries({ queryKey: ["documenti-saldi"] });
      qc.invalidateQueries({ queryKey: ["esposizione-controparti"] });
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
      qc.invalidateQueries({ queryKey: ["pagamenti-fatture"] });
    },
    onError: (e: any) => toast.error(`Operazione fallita: ${e?.message ?? e}`),
  });
}

/* ---------- Pagamento in contanti ---------- */

export interface PagaContantiInput {
  fattura_ids: string[];
  data: string;
  conto_id: string | null;
  importi?: number[] | null;
  nota?: string | null;
}

export interface PagaContantiResult {
  documenti: number;
  totale: number;
  conto_id: string;
  data: string;
}

export function usePagaDocumentiContanti() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PagaContantiInput) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase.rpc("paga_documenti_contanti", {
        p_user_id: user.id,
        p_fattura_ids: input.fattura_ids,
        p_data: input.data,
        p_conto_id: input.conto_id,
        p_importi: input.importi ?? null,
        p_nota: input.nota ?? null,
      });
      if (error) throw error;
      return data as unknown as PagaContantiResult;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
      qc.invalidateQueries({ queryKey: ["fatture-sdi-mancanti"] });
      qc.invalidateQueries({ queryKey: ["documenti-saldi"] });
      qc.invalidateQueries({ queryKey: ["documento-pagamenti"] });
      qc.invalidateQueries({ queryKey: ["esposizione-controparti"] });
      qc.invalidateQueries({ queryKey: ["pagamenti-fatture"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["movimenti-copertura"] });
      qc.invalidateQueries({ queryKey: ["saldo-conto"] });
    },
  });
}

/** Saldo corrente di un conto: saldo iniziale + entrate − uscite. */
export function useSaldoConto(contoId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saldo-conto", user?.id, contoId],
    queryFn: async () => {
      if (!user || !contoId) return 0;
      const { data: conto, error: e1 } = await supabase
        .from("conti")
        .select("saldo_iniziale")
        .eq("id", contoId)
        .maybeSingle();
      if (e1) throw e1;
      let saldo = Number(conto?.saldo_iniziale ?? 0);
      const chunk = 1000;
      for (let from = 0; ; from += chunk) {
        const { data, error } = await supabase
          .from("transactions")
          .select("amount, type")
          .eq("conto_id", contoId)
          .is("deleted_at", null)
          .range(from, from + chunk - 1);
        if (error) throw error;
        const rows = data ?? [];
        rows.forEach((t) => {
          const a = Number(t.amount ?? 0);
          saldo += t.type === "income" ? a : -a;
        });
        if (rows.length < chunk) break;
      }
      return saldo;
    },
    enabled: !!user && !!contoId,
  });
}
