import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import { toast } from "sonner";

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
  created_at: string;
  updated_at: string;
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
        .order("data_documento", { ascending: false });

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

export function useFattureStats() {
  const { data: fatture = [] } = useFattureFornitori();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const meseFatt = fatture.filter((f) => f.data_documento.startsWith(ym));
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }),
  });
}

export function useDeleteFattura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fatture_fornitori").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fatture-fornitori"] }),
  });
}

function parseDate(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
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
      const wb = XLSX.read(buf, { type: "array" });
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
