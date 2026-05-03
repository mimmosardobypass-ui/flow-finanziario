import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
  type?: "income" | "expense";
}

/* ── Regex ──────────────────────────────────────── */

const TWO_DATES_RE = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/;
const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})/;
const AMOUNT_RE_G = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
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
  const m = raw.match(AMOUNT_RE);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
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
  text: string; // joined
}

/* ── PDF extraction (X-aware) ──────────────────── */

async function extractLines(arrayBuffer: ArrayBuffer): Promise<PdfLine[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: PdfLine[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group fragments by Y (rounded) per page
    const byY = new Map<number, PdfFragment[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = String((item as any).str || "");
      if (!str.trim()) continue;
      const x = Math.round((item as any).transform[4]);
      const y = Math.round((item as any).transform[5]);
      // Bucket Y by 2px to merge slight variations
      const key = Math.round(y / 2) * 2;
      const arr = byY.get(key) || [];
      arr.push({ x, str });
      byY.set(key, arr);
    }

    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a); // top-to-bottom
    for (const y of sortedYs) {
      const frags = (byY.get(y) || []).sort((a, b) => a.x - b.x);
      const text = frags.map((f) => f.str).join(" ").replace(/\s{2,}/g, " ").trim();
      if (text) allLines.push({ y, fragments: frags, text });
    }
  }
  return allLines;
}

/* ── Column detection ──────────────────────────── */

interface Columns {
  xAddebiti: number;
  xAccrediti: number;
  xSaldo: number | null;
}

function detectColumns(lines: PdfLine[]): Columns | null {
  for (const line of lines) {
    let xAdd: number | null = null;
    let xAcc: number | null = null;
    let xSaldo: number | null = null;
    for (const f of line.fragments) {
      const s = f.str.toLowerCase();
      if (s.includes("addebit")) xAdd = f.x;
      else if (s.includes("accredit")) xAcc = f.x;
      else if (s === "saldo" || s.includes("saldo")) xSaldo = f.x;
    }
    if (xAdd != null && xAcc != null) {
      console.log("[AUTO IMPORT PDF] Header colonne rilevato:", { xAddebiti: xAdd, xAccrediti: xAcc, xSaldo });
      return { xAddebiti: xAdd, xAccrediti: xAcc, xSaldo };
    }
  }
  return null;
}

/* ── Block flushing ────────────────────────────── */

interface AmountAtX {
  x: number;
  value: number;
  raw: string;
}

interface Block {
  dateStr: string;
  lines: PdfLine[];
}

function classifyAmount(x: number, cols: Columns): "addebito" | "accredito" | "saldo" {
  // Distances to each column anchor
  const dAdd = Math.abs(x - cols.xAddebiti);
  const dAcc = Math.abs(x - cols.xAccrediti);
  const dSaldo = cols.xSaldo != null ? Math.abs(x - cols.xSaldo) : Infinity;

  // Closest wins
  if (dSaldo <= dAdd && dSaldo <= dAcc) return "saldo";
  if (dAdd <= dAcc) return "addebito";
  return "accredito";
}

function isNoiseLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (CODE_RE.test(t) && t.length < 25) return true;
  if (/^pagina/i.test(t)) return true;
  if (/saldo\s+(iniziale|finale|contabile|disponibile|progressivo)/i.test(t)) return true;
  if (/totale\s+movimenti/i.test(t)) return true;
  if (/^estratto\s+conto/i.test(t)) return true;
  if (/^iban|^intestat|^filiale|^conto\s+corrente|^codice\s+identificativo/i.test(t)) return true;
  return false;
}

/* ── Main parsing ──────────────────────────────── */

function parseBlocks(lines: PdfLine[], cols: Columns): ParsedRow[] {
  const results: ParsedRow[] = [];
  let current: Block | null = null;

  const flush = (block: Block) => {
    // Collect amounts (with their X) across all lines of the block
    const amounts: AmountAtX[] = [];
    const descParts: string[] = [];

    for (const line of block.lines) {
      for (const f of line.fragments) {
        const m = f.str.match(AMOUNT_RE);
        if (m && /^\s*[\d.,+-]+\s*$/.test(f.str.replace(/\s/g, ""))) {
          // Pure numeric fragment → amount candidate
          const v = parseItalianAmount(f.str);
          if (v != null) {
            amounts.push({ x: f.x, value: v, raw: f.str });
            continue;
          }
        }
        // Otherwise, contribute to description if not date/code/EUR
        const s = f.str;
        if (/\d{2}\/\d{2}\/\d{4}/.test(s)) continue;
        if (CODE_RE.test(s)) continue;
        if (/^EUR$/i.test(s.trim())) continue;
        if (AMOUNT_RE.test(s) && /^[\d.,\s+-]+$/.test(s)) continue;
        descParts.push(s);
      }
    }

    // Classify each amount by column
    let addebito: AmountAtX | null = null;
    let accredito: AmountAtX | null = null;
    for (const a of amounts) {
      const cls = classifyAmount(a.x, cols);
      if (cls === "addebito") {
        if (!addebito || Math.abs(a.x - cols.xAddebiti) < Math.abs(addebito.x - cols.xAddebiti)) addebito = a;
      } else if (cls === "accredito") {
        if (!accredito || Math.abs(a.x - cols.xAccrediti) < Math.abs(accredito.x - cols.xAccrediti)) accredito = a;
      }
      // saldo → ignored
    }

    const description = descParts.join(" ").replace(/\s{2,}/g, " ").trim();
    const date = formatDate(block.dateStr);

    let amount: number | null = null;
    let type: "income" | "expense" | undefined;

    if (addebito && accredito) {
      console.error("[AUTO IMPORT PDF] - ERRORE: sia addebito che accredito valorizzati, riga ignorata.", {
        descrizione: description,
        addebitoLetto: addebito.raw,
        accreditoLetto: accredito.raw,
      });
      return;
    } else if (addebito) {
      amount = -Math.abs(addebito.value);
      type = "expense";
    } else if (accredito) {
      amount = Math.abs(accredito.value);
      type = "income";
    } else {
      console.log("[AUTO IMPORT PDF] - SKIP: nessun importo addebito/accredito.", { descrizione: description, date });
      return;
    }

    console.log("[AUTO IMPORT PDF]", {
      descrizione: description,
      addebitoLetto: addebito?.raw ?? null,
      accreditoLetto: accredito?.raw ?? null,
      amountFinale: amount,
      typeFinale: type,
    });

    results.push({ date, description, amount, type });
  };

  for (const line of lines) {
    if (isNoiseLine(line.text)) continue;
    const dateMatch = TWO_DATES_RE.exec(line.text);
    if (dateMatch) {
      if (current) flush(current);
      current = { dateStr: dateMatch[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) flush(current);

  return results;
}

/* ── Public API ────────────────────────────────── */

export async function parseSellaPdf(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const lines = await extractLines(arrayBuffer);
  console.log(`[AUTO IMPORT PDF] Linee estratte: ${lines.length}`);

  const cols = detectColumns(lines);
  if (!cols) {
    console.error("[AUTO IMPORT PDF] Impossibile rilevare colonne 'Addebiti'/'Accrediti' nell'header.");
    return [];
  }

  const rows = parseBlocks(lines, cols);
  console.log(`[AUTO IMPORT PDF] Transazioni totali: ${rows.length}`);
  return rows;
}

// Backward-compat export (no longer used externally, kept for safety)
export function parseSellaPdfText(_rawText: string): ParsedRow[] {
  console.warn("[parseSellaPdfText] deprecato: il parser ora richiede coordinate X dal PDF.");
  return [];
}
