import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
  type?: "income" | "expense";
}

/* ── Regex ──────────────────────────────────────── */

const DATE_RE = /(\d{2})\/(\d{2})\/(\d{4})/;
const DATE_RE_G = /(\d{2})\/(\d{2})\/(\d{4})/g;
// Amount with mandatory sign (+/-): used as anchor for new Sella format
const SIGNED_AMOUNT_RE = /([+-])\s*(\d{1,3}(?:\.\d{3})*,\d{2})/;
// Plain amount (legacy Addebiti/Accrediti format)
const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})/;
const CODE_RE = /\b\d{14,}\b/;

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

/* ── Types ──────────────────────────────────────── */

interface PdfFragment {
  x: number;
  str: string;
}
interface PdfLine {
  y: number;
  fragments: PdfFragment[];
  text: string;
}

/* ── PDF extraction (X-aware, Y-bucketed) ──────── */

async function extractLines(arrayBuffer: ArrayBuffer): Promise<PdfLine[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: PdfLine[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const byY = new Map<number, PdfFragment[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = String((item as any).str || "");
      if (!str.trim()) continue;
      const x = Math.round((item as any).transform[4]);
      const y = Math.round((item as any).transform[5]);
      const key = Math.round(y / 2) * 2;
      const arr = byY.get(key) || [];
      arr.push({ x, str });
      byY.set(key, arr);
    }

    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const frags = (byY.get(y) || []).sort((a, b) => a.x - b.x);
      const text = frags.map((f) => f.str).join(" ").replace(/\s{2,}/g, " ").trim();
      if (text) allLines.push({ y, fragments: frags, text });
    }
  }
  return allLines;
}

/* ── Noise filter ──────────────────────────────── */

function isNoiseLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^pagina/i.test(t) || /\b\d+\/\d+\s*$/.test(t)) return false; // page number safe
  if (/saldo\s+(iniziale|finale|contabile|disponibile|progressivo|al\b)/i.test(t)) return true;
  if (/totale\s+movimenti/i.test(t)) return true;
  if (/^estratto\s+conto/i.test(t)) return true;
  if (/saldo e lista movimenti/i.test(t)) return true;
  if (/^codice\s+identificativo/i.test(t)) return true;
  if (/^data\s+(operazione|valuta)/i.test(t)) return true;
  if (/^descrizione/i.test(t)) return true;
  if (/la stampa di questo documento/i.test(t)) return true;
  if (/^\(\*\)/.test(t)) return true;
  if (/non tiene conto/i.test(t)) return true;
  return false;
}

function stripStructural(text: string): string {
  // Remove dates, 14+ digit codes, EUR, signed amounts; keep descriptive words
  return text
    .replace(/\b\d{14,}\b/g, " ")
    .replace(DATE_RE_G, " ")
    .replace(/\bEUR\b/gi, " ")
    .replace(/[+-]\s*\d{1,3}(?:\.\d{3})*,\d{2}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ── New format: signed-amount anchor ──────────── */

function parseSignedFormat(lines: PdfLine[]): ParsedRow[] {
  const clean = lines.filter((l) => !isNoiseLine(l.text));

  interface Anchor {
    idx: number;
    y: number;
    date: string | null;
    sign: string;
    value: number;
    inlineDesc: string;
  }
  const anchors: Anchor[] = [];
  clean.forEach((line, idx) => {
    const sm = line.text.match(SIGNED_AMOUNT_RE);
    const dm = line.text.match(DATE_RE);
    if (!sm || !dm) return;
    const value = parseItalianAmount(sm[2]);
    if (value == null) return;
    anchors.push({
      idx,
      y: line.y,
      date: formatDate(dm[0]),
      sign: sm[1],
      value,
      inlineDesc: stripStructural(line.text),
    });
  });

  if (anchors.length === 0) return [];

  const anchorIdxSet = new Set(anchors.map((a) => a.idx));
  const descByAnchor = new Map<number, string[]>();
  anchors.forEach((a) => descByAnchor.set(a.idx, a.inlineDesc ? [a.inlineDesc] : []));

  clean.forEach((line, idx) => {
    if (anchorIdxSet.has(idx)) return;
    const cleaned = stripStructural(line.text);
    if (!cleaned) return;
    let bestIdx = anchors[0].idx;
    let bestDist = Math.abs(line.y - anchors[0].y);
    for (let i = 1; i < anchors.length; i++) {
      const d = Math.abs(line.y - anchors[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = anchors[i].idx;
      }
    }
    if (bestDist > 40) return;
    descByAnchor.get(bestIdx)!.push(cleaned);
  });

  const results: ParsedRow[] = [];
  for (const a of anchors) {
    const desc = (descByAnchor.get(a.idx) || [])
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const amount = a.sign === "-" ? -Math.abs(a.value) : Math.abs(a.value);
    const type: "income" | "expense" = a.sign === "-" ? "expense" : "income";
    console.log("[AUTO IMPORT PDF]", { date: a.date, descrizione: desc, amount, type });
    results.push({ date: a.date, description: desc, amount, type });
  }
  return results;
}

/* ── Public API ────────────────────────────────── */

export async function parseSellaPdf(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const lines = await extractLines(arrayBuffer);
  console.log(`[AUTO IMPORT PDF] Linee estratte: ${lines.length}`);

  const rows = parseSignedFormat(lines);
  console.log(`[AUTO IMPORT PDF] Transazioni totali: ${rows.length}`);
  return rows;
}

export function parseSellaPdfText(_rawText: string): ParsedRow[] {
  console.warn("[parseSellaPdfText] deprecato.");
  return [];
}
