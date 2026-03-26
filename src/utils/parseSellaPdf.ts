import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
}

/**
 * Parse a Banca Sella PDF bank statement.
 *
 * Each transaction line starts with a long numeric code (14+ digits),
 * followed by two dates dd/MM/yyyy, description text, "EUR", and an amount.
 * We ignore: codice identificativo, data valuta, divisa, note.
 */
export async function parseSellaPdf(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const itemsByY = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round((item as any).transform[5]);
      if (!itemsByY.has(y)) itemsByY.set(y, []);
      itemsByY.get(y)!.push({ x: (item as any).transform[4], str: (item as any).str });
    }

    // Sort by Y descending (PDF coords), then X ascending within each line
    const sortedYs = [...itemsByY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = itemsByY.get(y)!.sort((a, b) => a.x - b.x);
      const line = items.map((i) => i.str).join(" ").trim();
      if (line) lines.push(line);
    }
  }

  return parseSellaLines(lines);
}

const DATE_RE = /\d{2}\/\d{2}\/\d{4}/g;
const CODE_RE = /^\d{14,}/;
const AMOUNT_RE = /[+-]?\d{1,3}(?:\.\d{3})*,\d{2}/;

function parseItalianAmount(raw: string): number | null {
  let str = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function formatDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

interface RawTransaction {
  date: string;
  descriptionParts: string[];
  amount: number | null;
}

function parseSellaLines(lines: string[]): ParsedRow[] {
  const transactions: RawTransaction[] = [];
  let current: RawTransaction | null = null;

  for (const line of lines) {
    // Check if line starts with a long numeric code (new transaction)
    if (CODE_RE.test(line)) {
      // Flush previous
      if (current) transactions.push(current);

      // Extract dates
      const dates = line.match(DATE_RE);
      const opDate = dates?.[0] ? formatDate(dates[0]) : null;

      // Extract amount - find "EUR" and grab the amount after it
      let amount: number | null = null;
      const eurIdx = line.indexOf("EUR");
      if (eurIdx >= 0) {
        const afterEur = line.substring(eurIdx + 3);
        const amtMatch = afterEur.match(AMOUNT_RE);
        if (amtMatch) {
          amount = parseItalianAmount(amtMatch[0]);
        }
      }

      // Extract description: text between the second date and "EUR"
      let description = "";
      if (dates && dates.length >= 2) {
        const secondDateEnd = line.indexOf(dates[1]) + dates[1].length;
        const eurPos = eurIdx >= 0 ? eurIdx : line.length;
        description = line.substring(secondDateEnd, eurPos).trim();
      } else if (dates && dates.length === 1) {
        const firstDateEnd = line.indexOf(dates[0]) + dates[0].length;
        const eurPos = eurIdx >= 0 ? eurIdx : line.length;
        description = line.substring(firstDateEnd, eurPos).trim();
      }

      current = {
        date: opDate || "",
        descriptionParts: description ? [description] : [],
        amount,
      };
    } else if (current) {
      // Continuation line - append to description if it's not a header/footer
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith("Codice") &&
        !trimmed.startsWith("Data") &&
        !trimmed.startsWith("Descrizione") &&
        !trimmed.startsWith("Divisa") &&
        !trimmed.startsWith("Importo") &&
        !trimmed.startsWith("Note") &&
        !trimmed.includes("Pagina") &&
        !trimmed.includes("Saldo")
      ) {
        current.descriptionParts.push(trimmed);
      }
    }
  }

  // Flush last
  if (current) transactions.push(current);

  return transactions.map((t) => ({
    date: t.date || null,
    description: t.descriptionParts.join(" "),
    amount: t.amount,
  }));
}
