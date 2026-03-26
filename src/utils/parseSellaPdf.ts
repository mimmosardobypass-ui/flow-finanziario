import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
}

/* ── Regex ──────────────────────────────────────── */

const TWO_DATES_RE = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/;
const AMOUNT_RE = /([+-])?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
const CODE_RE = /\b\d{14,}\b/;
const NOISE_RE = [
  /^pagina\s*\d/i,
  /^pagina$/i,
  /saldo\s*(iniziale|finale|contabile|disponibile)/i,
  /totale\s+movimenti/i,
  /estratto\s+conto/i,
  /^iban/i,
  /^intestat/i,
  /^filiale/i,
  /^conto\s+corrente/i,
  /^codice\s+identificativo/i,
  /^data\s+operazione/i,
  /^data\s+valuta/i,
  /^descrizione$/i,
  /^divisa$/i,
  /^importo$/i,
];

/* ── Helpers ────────────────────────────────────── */

function isNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (t === "EUR") return true;
  if (CODE_RE.test(t)) return true;
  return NOISE_RE.some((re) => re.test(t));
}

function formatDate(ddmmyyyy: string): string | null {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > 2100) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseItalianAmount(raw: string): number | null {
  const m = raw.match(/([+-])?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const num = parseFloat(m[2].replace(/\./g, "").replace(",", "."));
  return isNaN(num) ? null : sign * num;
}

/* ── Text-based parser ─────────────────────────── */

export function parseSellaPdfText(rawText: string): ParsedRow[] {
  const lines = rawText.split("\n");
  const results: ParsedRow[] = [];

  interface Block {
    dateStr: string;
    textLines: string[];
  }

  let current: Block | null = null;

  function flushBlock(block: Block) {
    // Join all text lines
    const fullText = block.textLines
      .filter((l) => !isNoise(l))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Extract amount: last match in the full text
    let amount: number | null = null;
    let lastAmountMatch: RegExpMatchArray | null = null;
    const amountRegex = /([+-])?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = amountRegex.exec(fullText)) !== null) {
      lastAmountMatch = m;
    }
    if (lastAmountMatch) {
      amount = parseItalianAmount(lastAmountMatch[0]);
    }

    // Build description: remove the amount portion, codes, EUR, dates
    let description = fullText;
    if (lastAmountMatch) {
      description = description.slice(0, lastAmountMatch.index!) + description.slice(lastAmountMatch.index! + lastAmountMatch[0].length);
    }
    // Clean up residual noise from description
    description = description
      .replace(CODE_RE, "")
      .replace(/\bEUR\b/g, "")
      .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const date = formatDate(block.dateStr);

    if (date || amount !== null) {
      const row: ParsedRow = { date, description, amount };
      console.log("[parseSellaPdf] Transaction:", JSON.stringify(row));
      results.push(row);
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const dateMatch = TWO_DATES_RE.exec(line);
    if (dateMatch) {
      // Flush previous block
      if (current) flushBlock(current);

      // Start new block
      current = {
        dateStr: dateMatch[1],
        textLines: [],
      };

      // Anything on this line after the two dates is part of description
      const after = line.slice(dateMatch.index! + dateMatch[0].length).trim();
      if (after && !isNoise(after)) {
        current.textLines.push(after);
      }
    } else if (current) {
      // Continuation line → add to current block
      if (!isNoise(line)) {
        current.textLines.push(line);
      }
    }
  }

  // Flush last block
  if (current) flushBlock(current);

  console.log(`[parseSellaPdf] Total transactions parsed: ${results.length}`);
  return results;
}

/* ── PDF extraction + parsing ──────────────────── */

export async function parseSellaPdf(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    let lastY: number | null = null;
    const pageText: string[] = [];

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = (item as any).str;
      if (!str) continue;
      const y = Math.round((item as any).transform[5]);

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        pageText.push("\n");
      } else if (pageText.length > 0) {
        pageText.push(" ");
      }
      pageText.push(str);
      lastY = y;
    }

    textParts.push(pageText.join(""));
  }

  const rawText = textParts.join("\n");
  console.log("[parseSellaPdf] Raw text extracted:\n", rawText);

  return parseSellaPdfText(rawText);
}
