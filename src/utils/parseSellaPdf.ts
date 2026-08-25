import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Worker servito dal bundle dell'app: niente dipendenza da CDN esterne
// e nessun rischio di disallineamento di versione.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
  type?: "income" | "expense";
  /** Identificativo operazione della banca (14 cifre). Chiave stabile del movimento. */
  operationId?: string | null;
}

/* ── Regex ──────────────────────────────────────── */

const DATE_RE = /(\d{2})\/(\d{2})\/(\d{4})/;
const DATE_RE_G = /(\d{2})\/(\d{2})\/(\d{4})/g;
const SIGNED_AMOUNT_RE = /([+-])\s*(\d{1,3}(?:\.\d{3})*,\d{2})/;
/** Ogni riga-movimento dell'estratto Sella inizia con l'identificativo a 14 cifre. */
const ROW_ID_RE = /^\s*(\d{14})\b/;

/* ── Helpers ────────────────────────────────────── */

function formatDate(ddmmyyyy: string): string | null {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > 2100) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseItalianAmount(raw: string): number | null {
  const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  return isNaN(num) ? null : num;
}

/** Toglie dalla riga i campi strutturali, lasciando solo il testo descrittivo. */
function stripStructural(text: string): string {
  return text
    .replace(/\b\d{14,}\b/g, " ")
    .replace(DATE_RE_G, " ")
    .replace(/\bEUR\b/gi, " ")
    .replace(/[+-]\s*\d{1,3}(?:\.\d{3})*,\d{2}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Intestazioni di colonna, totali e note legali: non sono descrizioni e non
 * devono mai finire dentro un movimento.
 */
function isNoiseLine(text: string): boolean {
  const s = text.trim();
  if (!s) return true;
  return (
    /^codice\s*data$/i.test(s) ||
    /^identificativo\s+operazione$/i.test(s) ||
    /^data\s+valuta\s+descrizione/i.test(s) ||
    /^codice\s+identificativo/i.test(s) ||
    /^data\s+(operazione|valuta)/i.test(s) ||
    /^descrizione\b/i.test(s) ||
    /^saldo e lista movimenti/i.test(s) ||
    /^totale\s+movimenti/i.test(s) ||
    /^saldo\s+(iniziale|finale|contabile|disponibile|progressivo|al\b)/i.test(s) ||
    /^estratto\s+conto/i.test(s) ||
    /^\(\*\)/.test(s) ||
    /non tiene conto/i.test(s) ||
    /la stampa di questo documento/i.test(s) ||
    /^\d+\s*\/\s*\d+$/.test(s)          // numero di pagina "1 / 2"
  );
}

/* ── Tipi interni ───────────────────────────────── */

interface PdfLine {
  page: number;
  y: number;
  text: string;
}

interface Item extends PdfLine {
  isAnchor: boolean;
  operationId: string | null;
  date: string | null;
  value: number | null;
  sign: string | null;
  stripped: string;
}

/* ── Estrazione righe (con numero di pagina) ────── */

async function extractLines(arrayBuffer: ArrayBuffer): Promise<PdfLine[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: PdfLine[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const byY = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = String((item as { str?: string }).str || "");
      if (!str.trim()) continue;
      const transform = (item as { transform: number[] }).transform;
      const x = Math.round(transform[4]);
      const y = Math.round(transform[5]);
      const key = Math.round(y / 2) * 2;
      const arr = byY.get(key) || [];
      arr.push({ x, str });
      byY.set(key, arr);
    }

    // ordine di lettura: dall'alto verso il basso, e a parità di riga da sinistra a destra
    for (const y of Array.from(byY.keys()).sort((a, b) => b - a)) {
      const frags = (byY.get(y) || []).sort((a, b) => a.x - b.x);
      const text = frags.map((f) => f.str).join(" ").replace(/\s{2,}/g, " ").trim();
      if (text) allLines.push({ page: p, y, text });
    }
  }
  return allLines;
}

/* ── Ricostruzione dei movimenti ────────────────── */

function buildRows(lines: PdfLine[]): ParsedRow[] {
  const clean = lines.filter((l) => !isNoiseLine(l.text));

  const makeItem = (l: PdfLine, requireId: boolean): Item => {
    const idm = l.text.match(ROW_ID_RE);
    const dm = l.text.match(DATE_RE);
    const sm = l.text.match(SIGNED_AMOUNT_RE);
    const hasAmount = !!sm && parseItalianAmount(sm[2]) !== null;
    const isAnchor = !!dm && hasAmount && (!requireId || !!idm);
    return {
      ...l,
      isAnchor,
      operationId: idm ? idm[1] : null,
      date: isAnchor && dm ? formatDate(dm[0]) : null,
      value: isAnchor && sm ? parseItalianAmount(sm[2]) : null,
      sign: isAnchor && sm ? sm[1] : null,
      stripped: stripStructural(l.text),
    };
  };

  // L'identificativo a 14 cifre è il riconoscitore più affidabile della riga-movimento.
  // Se un tracciato non lo espone, si ripiega su data + importo firmato.
  let items = clean.map((l) => makeItem(l, true));
  if (!items.some((it) => it.isAnchor)) {
    items = clean.map((l) => makeItem(l, false));
  }

  const anchors = items.filter((it) => it.isAnchor);
  const n = anchors.length;
  if (n === 0) return [];

  // gaps[k] = righe di dettaglio fra l'ancora k-1 e l'ancora k (gaps[n] = coda finale)
  const gaps: Item[][] = Array.from({ length: n + 1 }, () => []);
  let g = 0;
  for (const it of items) {
    if (it.isAnchor) { g++; continue; }
    if (!it.stripped) continue;
    gaps[g].push(it);
  }
  const cap = gaps.map((x) => x.length);
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(v, hi));

  // Il blocco descrizione è centrato verticalmente sulla riga-movimento:
  // le righe sopra sono tante quante quelle sotto. La catena è quindi determinata
  // da un capo noto, e i capi noti sono due: l'inizio e la fine del documento.
  const aFwd = new Array<number>(n);
  aFwd[0] = cap[0];
  for (let k = 0; k < n - 1; k++) aFwd[k + 1] = clamp(cap[k + 1] - aFwd[k], cap[k + 1]);

  const aBwd = new Array<number>(n);
  aBwd[n - 1] = clamp(cap[n], cap[n - 1]);
  for (let k = n - 2; k >= 0; k--) aBwd[k] = clamp(cap[k + 1] - aBwd[k + 1], cap[k]);

  // Un blocco tagliato da un salto pagina rompe la simmetria: prima del salto vale
  // la catena in avanti, dopo il salto quella all'indietro.
  let firstBreak = n;
  for (let k = 1; k < n; k++) {
    const lines_ = gaps[k];
    const crossesInside = lines_.length > 1 && lines_[0].page !== lines_[lines_.length - 1].page;
    const crossesAnchors = anchors[k - 1].page !== anchors[k].page;
    if (crossesInside || crossesAnchors) { firstBreak = k; break; }
  }

  const above: Item[][] = Array.from({ length: n }, () => []);
  const below: Item[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < n; k++) {
    const chosen = k < firstBreak ? aFwd[k] : aBwd[k];
    const gapAbove = gaps[k];
    const nAbove = clamp(chosen, gapAbove.length);
    above[k] = gapAbove.slice(gapAbove.length - nAbove);
    if (k > 0) below[k - 1] = gapAbove.slice(0, gapAbove.length - nAbove);
  }
  below[n - 1] = gaps[n];

  return anchors.map((a, k) => {
    const description = [
      ...above[k].map((l) => l.stripped),
      a.stripped,
      ...below[k].map((l) => l.stripped),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    const value = a.value ?? 0;
    return {
      date: a.date,
      description,
      amount: a.sign === "-" ? -Math.abs(value) : Math.abs(value),
      type: (a.sign === "-" ? "expense" : "income") as "income" | "expense",
      operationId: a.operationId,
    };
  });
}

/* ── API pubblica ───────────────────────────────── */

export async function parseSellaPdf(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const lines = await extractLines(arrayBuffer);
  return buildRows(lines);
}
