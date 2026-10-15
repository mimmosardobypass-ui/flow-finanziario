import { parseImporto } from "@/components/finanziamenti/utils";

export type Categoria = "Smartphone" | "Accessorio" | "Cellulare" | "Altro";
export const CATEGORIE: Categoria[] = ["Smartphone", "Accessorio", "Cellulare", "Altro"];

export interface RigaCarico {
  chiave: string;
  marca: string;
  codice_articolo: string;
  modello: string;
  descrizione: string;
  quantita: number;
  costo_unitario: number;
  aliquota_iva: number | null;
  categoria: Categoria;
  righeFile: number;
}

export interface CaricoLetto {
  tipo: string;
  numero: string | null;
  data_documento: string | null; // yyyy-MM-dd
  righe: RigaCarico[];
  correzioni: string[];
  avvisi: string[];
}

const INVISIBILI = /[\u200B-\u200D\uFEFF\u2060]/g;

export function pulisci(v: unknown): string {
  return String(v ?? "")
    .replace(/&zwnj;/gi, "")
    .replace(INVISIBILI, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function numeroIt(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = pulisci(v).replace(/€/g, "").trim();
  if (!s) return null;
  return parseImporto(s);
}

export function normalizzaMarca(v: string): string {
  return pulisci(v).toUpperCase().replace(/\s+/g, "");
}

const PAROLE_ACCESSORIO = ["AURICOLAR", "BUDS", "COVER", "CARICABATTER", "CAVO", "PELLICOL", "CUSTODIA", "ALIMENTATORE", "POWERBANK", "POWER BANK", "VETRO", "CUFFIE", "ADATTATORE", "SMARTWATCH", "WATCH", "BAND"];
const CELLULARI = /\bNOKIA\s*(105|106|110|130|150|210|215|220|225|230|235|2660|2760|3210|5310|6310|8210|800)\b|FEATURE PHONE|\bBRONDI\b|\bTELEFONO ANZIANI\b|\bCELLULARE\b/i;

export function categoriaProposta(testo: string): Categoria {
  const t = testo.toUpperCase();
  if (PAROLE_ACCESSORIO.some((p) => t.includes(p))) return "Accessorio";
  if (CELLULARI.test(t)) return "Cellulare";
  return "Smartphone";
}

const RE_TITOLO = /^(.*?)\s*-\s*N\.doc\.\s*(\S+)\s+del\s+(\d{2})\/(\d{2})\/(\d{4})/i;

export function leggiTitolo(testo: string): { tipo: string; numero: string; data: string } | null {
  const m = pulisci(testo).match(RE_TITOLO);
  if (!m) return null;
  return { tipo: pulisci(m[1]).toUpperCase(), numero: m[2], data: `${m[5]}-${m[4]}-${m[3]}` };
}

const norm = (s: string) => pulisci(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const COLONNE: Record<string, (h: string) => boolean> = {
  marca: (h) => h === "marca",
  codice: (h) => h.includes("id univoco") || h.includes("codice"),
  modello: (h) => h === "modello",
  descrizione: (h) => h.startsWith("descrizione"),
  quantita: (h) => h.startsWith("quantita") || h === "qta" || h === "q.ta",
  valore: (h) => h === "valore" || h.includes("prezzo unit") || h.includes("costo unit"),
  importo: (h) => h === "importo" || h === "totale",
  iva: (h) => h === "iva" || h.startsWith("aliquota"),
};

/** Interpreta una tabella (righe × celle di testo) del gestionale. */
export function interpretaTabella(tabella: unknown[][]): CaricoLetto {
  const correzioni: string[] = [];
  const avvisi: string[] = [];
  let tipo = "";
  let numero: string | null = null;
  let data: string | null = null;

  let idxHeader = -1;
  let mappa: Record<string, number> = {};
  for (let i = 0; i < Math.min(tabella.length, 20); i++) {
    const celle = tabella[i].map((c) => norm(String(c ?? "")));
    if (!numero) {
      for (const c of tabella[i]) {
        const t = leggiTitolo(String(c ?? ""));
        if (t) { tipo = t.tipo; numero = t.numero; data = t.data; break; }
      }
    }
    const m: Record<string, number> = {};
    celle.forEach((h, j) => {
      for (const [k, test] of Object.entries(COLONNE)) if (m[k] === undefined && test(h)) m[k] = j;
    });
    if (m.codice !== undefined && m.valore !== undefined && (m.descrizione !== undefined || m.modello !== undefined)) {
      idxHeader = i; mappa = m; break;
    }
  }
  if (idxHeader < 0) throw new Error("Non trovo le colonne del carico (Marca, Id univoco articolo, Descrizione, Quantità, Valore).");
  if (!numero) avvisi.push("Numero e data del documento non trovati nel file: inseriscili a mano.");

  let invisibili = 0;
  let marcheUnite = new Set<string>();
  let importiDiversi = 0;
  const gruppi = new Map<string, RigaCarico>();

  for (let i = idxHeader + 1; i < tabella.length; i++) {
    const r = tabella[i];
    const cel = (k: string) => (mappa[k] === undefined ? "" : String(r[mappa[k]] ?? ""));
    const grezzi = [cel("marca"), cel("codice"), cel("modello"), cel("descrizione")];
    if (grezzi.some((g) => g !== pulisci(g) && (INVISIBILI.test(g) || /&zwnj;|\u00A0|\s{2,}|^\s|\s$/.test(g)))) invisibili++;
    INVISIBILI.lastIndex = 0;
    const codice = pulisci(cel("codice")).toUpperCase();
    if (!codice) continue;
    const marcaGrezza = pulisci(cel("marca")).toUpperCase();
    const marca = normalizzaMarca(marcaGrezza);
    if (marcaGrezza !== marca) marcheUnite.add(`"${marcaGrezza}" → "${marca}"`);
    const quantita = numeroIt(mappa.quantita === undefined ? 1 : r[mappa.quantita]) ?? 1;
    const valore = numeroIt(r[mappa.valore]);
    if (valore === null) { avvisi.push(`Riga ${i + 1}: costo non leggibile per ${codice}, riga saltata.`); continue; }
    if (mappa.importo !== undefined) {
      const imp = numeroIt(r[mappa.importo]);
      if (imp !== null && Math.abs(imp - quantita * valore) > 0.011) importiDiversi++;
    }
    const iva = mappa.iva === undefined ? null : numeroIt(r[mappa.iva]);
    const descrizione = pulisci(cel("descrizione"));
    const modello = pulisci(cel("modello"));
    const chiave = `${codice}|${valore.toFixed(2)}`;
    const g = gruppi.get(chiave);
    if (g) {
      g.quantita += quantita;
      g.righeFile += 1;
    } else {
      gruppi.set(chiave, {
        chiave, marca, codice_articolo: codice, modello, descrizione,
        quantita, costo_unitario: Math.round(valore * 100) / 100, aliquota_iva: iva,
        categoria: categoriaProposta(`${descrizione} ${modello} ${codice}`), righeFile: 1,
      });
    }
  }

  if (invisibili) correzioni.push(`Tolti caratteri invisibili e spazi in eccesso in ${invisibili} righe.`);
  if (marcheUnite.size) correzioni.push(`Marche uniformate: ${[...marcheUnite].join(", ")}.`);
  const doppie = [...gruppi.values()].filter((g) => g.righeFile > 1);
  if (doppie.length) correzioni.push(`Unite ${doppie.length} righe ripetute nel file (stesso codice e stesso costo).`);
  correzioni.push("Costo unitario preso dalla colonna \"Valore\" (non \"Importo\").");
  if (importiDiversi) avvisi.push(`${importiDiversi} righe hanno "Importo" diverso da quantità × valore: controlla il file.`);

  return { tipo, numero, data_documento: data, righe: [...gruppi.values()], correzioni, avvisi };
}

/** Converte l'HTML esportato dal gestionale in tabella di testo. */
export function tabellaDaHtml(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) throw new Error("Il file non contiene una tabella leggibile.");
  return [...table.querySelectorAll("tr")].map((tr) =>
    [...tr.querySelectorAll("th,td")].map((c) => c.textContent ?? "")
  );
}

export async function leggiFileCarico(file: File): Promise<CaricoLetto> {
  const testo = await file.text();
  if (testo.replace(/^\uFEFF/, "").trimStart().startsWith("<")) {
    return interpretaTabella(tabellaDaHtml(testo));
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const righe = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  return interpretaTabella(righe);
}
