import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
}

interface TextFragment {
  x: number;
  y: number;
  str: string;
}

interface ColumnBounds {
  codice: number;
  dataOp: number;
  dataVal: number;
  descrizione: number;
  divisa: number;
  importo: number;
}

const HEADER_KEYWORDS: Record<keyof ColumnBounds, string[]> = {
  codice: ["codice"],
  dataOp: ["data"],
  dataVal: ["data"],
  descrizione: ["descrizione"],
  divisa: ["divisa"],
  importo: ["importo"],
};

const CODE_RE = /^\d{14,}/;
const DATE_RE = /\d{2}\/\d{2}\/\d{4}/;
const AMOUNT_RE = /[+-]?\s?\d{1,3}(?:\.\d{3})*,\d{2}/;

function parseItalianAmount(raw: string): number | null {
  const str = raw.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function formatDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse a Banca Sella PDF bank statement using a column-based approach.
 *
 * Instead of reconstructing lines by Y position, we:
 * 1. Find column X positions from the header row
 * 2. Group text fragments into transaction blocks (delimited by the 14+ digit code)
 * 3. Assign each fragment to its column based on X position
 * 4. Extract date, description, and amount from the correct columns
 */
export async function parseSellaPdf(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allFragments: TextFragment[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item) || !(item as any).str.trim()) continue;
      allFragments.push({
        x: Math.round((item as any).transform[4]),
        y: Math.round((item as any).transform[5]),
        str: (item as any).str.trim(),
      });
    }
  }

  // Sort all fragments top-to-bottom (Y desc), then left-to-right (X asc)
  allFragments.sort((a, b) => b.y - a.y || a.x - b.x);

  // Step 1: Find column boundaries from header
  const columns = detectColumns(allFragments);

  // Step 2: Group fragments into logical rows with Y-tolerance
  const rows = groupIntoRows(allFragments, 4);

  // Step 3: Parse transactions
  return parseTransactions(rows, columns);
}

/**
 * Detect column X boundaries by finding header keywords.
 * We look for fragments containing "Codice", "Descrizione", "Importo", etc.
 * and record their X positions.
 */
function detectColumns(fragments: TextFragment[]): ColumnBounds | null {
  // Find fragments that look like headers
  // They should be on the same Y level (or very close)
  const headerCandidates: { keyword: string; x: number; y: number }[] = [];

  for (const f of fragments) {
    const lower = f.str.toLowerCase();
    if (lower.includes("codice") && lower.includes("identificativo")) {
      headerCandidates.push({ keyword: "codice", x: f.x, y: f.y });
    } else if (lower === "descrizione" || lower.includes("descrizione")) {
      headerCandidates.push({ keyword: "descrizione", x: f.x, y: f.y });
    } else if (lower === "importo" || lower.includes("importo")) {
      headerCandidates.push({ keyword: "importo", x: f.x, y: f.y });
    } else if (lower === "divisa") {
      headerCandidates.push({ keyword: "divisa", x: f.x, y: f.y });
    } else if (lower.includes("data") && lower.includes("operazione")) {
      headerCandidates.push({ keyword: "dataOp", x: f.x, y: f.y });
    } else if (lower.includes("data") && lower.includes("valuta")) {
      headerCandidates.push({ keyword: "dataVal", x: f.x, y: f.y });
    }
  }

  if (headerCandidates.length < 3) return null;

  // Find the most common Y among headers (they should be on the same line)
  const yGroups = new Map<number, typeof headerCandidates>();
  for (const h of headerCandidates) {
    const roundedY = Math.round(h.y / 5) * 5;
    if (!yGroups.has(roundedY)) yGroups.set(roundedY, []);
    yGroups.get(roundedY)!.push(h);
  }

  let bestGroup = headerCandidates;
  let bestCount = 0;
  for (const [, group] of yGroups) {
    if (group.length > bestCount) {
      bestCount = group.length;
      bestGroup = group;
    }
  }

  const bounds: Partial<ColumnBounds> = {};
  for (const h of bestGroup) {
    if (h.keyword === "codice") bounds.codice = h.x;
    else if (h.keyword === "dataOp") bounds.dataOp = h.x;
    else if (h.keyword === "dataVal") bounds.dataVal = h.x;
    else if (h.keyword === "descrizione") bounds.descrizione = h.x;
    else if (h.keyword === "divisa") bounds.divisa = h.x;
    else if (h.keyword === "importo") bounds.importo = h.x;
  }

  return (bounds.descrizione != null && bounds.importo != null)
    ? (bounds as ColumnBounds)
    : null;
}

/**
 * Group fragments into logical rows using Y-tolerance.
 * Fragments within `tolerance` pixels of each other are on the same visual row.
 */
function groupIntoRows(
  fragments: TextFragment[],
  tolerance: number
): { y: number; items: TextFragment[] }[] {
  const rows: { y: number; items: TextFragment[] }[] = [];

  for (const f of fragments) {
    const existing = rows.find((r) => Math.abs(r.y - f.y) <= tolerance);
    if (existing) {
      existing.items.push(f);
    } else {
      rows.push({ y: f.y, items: [f] });
    }
  }

  // Sort rows top-to-bottom, items left-to-right
  rows.sort((a, b) => b.y - a.y);
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
  }

  return rows;
}

/**
 * Assign a fragment to a column based on its X position relative to column boundaries.
 */
function classifyColumn(
  x: number,
  cols: ColumnBounds
): "codice" | "dataOp" | "dataVal" | "descrizione" | "divisa" | "importo" | "unknown" {
  // Build sorted column entries
  const entries: { name: string; x: number }[] = [];
  if (cols.codice != null) entries.push({ name: "codice", x: cols.codice });
  if (cols.dataOp != null) entries.push({ name: "dataOp", x: cols.dataOp });
  if (cols.dataVal != null) entries.push({ name: "dataVal", x: cols.dataVal });
  if (cols.descrizione != null) entries.push({ name: "descrizione", x: cols.descrizione });
  if (cols.divisa != null) entries.push({ name: "divisa", x: cols.divisa });
  if (cols.importo != null) entries.push({ name: "importo", x: cols.importo });
  entries.sort((a, b) => a.x - b.x);

  // Find closest column (fragment X should be >= column start)
  let best = "unknown";
  for (const e of entries) {
    if (x >= e.x - 15) {
      best = e.name;
    }
  }

  return best as any;
}

interface TransactionBlock {
  dateFragments: string[];
  descFragments: string[];
  amountFragments: string[];
}

function parseTransactions(
  rows: { y: number; items: TextFragment[] }[],
  columns: ColumnBounds | null
): ParsedRow[] {
  // If we couldn't detect columns, fall back to line-based parsing
  if (!columns) {
    return fallbackLineParsing(rows);
  }

  const transactions: TransactionBlock[] = [];
  let current: TransactionBlock | null = null;

  for (const row of rows) {
    const lineText = row.items.map((i) => i.str).join(" ");

    // Skip header/footer lines
    if (
      lineText.includes("Pagina") ||
      lineText.includes("Saldo") ||
      lineText.toLowerCase().includes("codice identificativo") ||
      lineText.toLowerCase().includes("data operazione")
    ) {
      continue;
    }

    // Check if any fragment in this row starts a new transaction (14+ digit code)
    const hasCode = row.items.some((f) => CODE_RE.test(f.str));

    if (hasCode) {
      if (current) transactions.push(current);
      current = { dateFragments: [], descFragments: [], amountFragments: [] };
    }

    if (!current) continue;

    // Classify each fragment by column
    for (const f of row.items) {
      const col = classifyColumn(f.x, columns);

      if (col === "codice" || col === "dataVal" || col === "divisa") {
        // For dataOp: the code column might contain date-like text on the same row
        // Check if this fragment is actually a date
        if (col === "codice" && DATE_RE.test(f.str) && current.dateFragments.length === 0) {
          // This might be a date that landed in the code column area
        }
        continue; // ignore
      }

      if (col === "dataOp") {
        if (DATE_RE.test(f.str)) {
          current.dateFragments.push(f.str);
        }
      } else if (col === "descrizione") {
        if (!CODE_RE.test(f.str) && !DATE_RE.test(f.str)) {
          current.descFragments.push(f.str);
        }
      } else if (col === "importo") {
        current.amountFragments.push(f.str);
      } else {
        // Unknown column - check if it looks like a date or amount
        if (DATE_RE.test(f.str) && current.dateFragments.length === 0) {
          current.dateFragments.push(f.str);
        } else if (AMOUNT_RE.test(f.str)) {
          current.amountFragments.push(f.str);
        } else if (!CODE_RE.test(f.str)) {
          current.descFragments.push(f.str);
        }
      }
    }
  }

  if (current) transactions.push(current);

  return transactions.map((t) => {
    const dateStr = t.dateFragments[0] || null;
    const amountStr = t.amountFragments.join("").trim();
    const amount = amountStr ? parseItalianAmount(amountStr) : null;

    return {
      date: dateStr ? formatDate(dateStr) : null,
      description: t.descFragments.join(" ").trim(),
      amount,
    };
  });
}

/**
 * Fallback: line-based parsing when column detection fails.
 */
function fallbackLineParsing(
  rows: { y: number; items: TextFragment[] }[]
): ParsedRow[] {
  const results: ParsedRow[] = [];
  let current: { date: string; descParts: string[]; amount: number | null } | null = null;

  for (const row of rows) {
    const line = row.items.map((i) => i.str).join(" ").trim();
    if (!line) continue;

    if (CODE_RE.test(line)) {
      if (current) {
        results.push({
          date: current.date || null,
          description: current.descParts.join(" "),
          amount: current.amount,
        });
      }

      const dateMatch = line.match(DATE_RE);
      const opDate = dateMatch ? formatDate(dateMatch[0]) : "";

      let amount: number | null = null;
      const eurIdx = line.indexOf("EUR");
      if (eurIdx >= 0) {
        const afterEur = line.substring(eurIdx + 3);
        const amtMatch = afterEur.match(AMOUNT_RE);
        if (amtMatch) amount = parseItalianAmount(amtMatch[0]);
      }

      // Description between dates and EUR
      let desc = "";
      const allDates = line.match(new RegExp(DATE_RE.source, "g"));
      if (allDates && allDates.length >= 2) {
        const secondDateEnd = line.indexOf(allDates[1]) + allDates[1].length;
        const eurPos = eurIdx >= 0 ? eurIdx : line.length;
        desc = line.substring(secondDateEnd, eurPos).trim();
      }

      current = { date: opDate, descParts: desc ? [desc] : [], amount };
    } else if (current) {
      if (
        !line.startsWith("Codice") &&
        !line.startsWith("Data") &&
        !line.startsWith("Descrizione") &&
        !line.includes("Pagina") &&
        !line.includes("Saldo")
      ) {
        // Check if this continuation line has the amount
        if (current.amount == null) {
          const amtMatch = line.match(AMOUNT_RE);
          if (amtMatch) {
            current.amount = parseItalianAmount(amtMatch[0]);
            const remaining = line.replace(AMOUNT_RE, "").replace(/EUR/g, "").trim();
            if (remaining) current.descParts.push(remaining);
            continue;
          }
        }
        current.descParts.push(line);
      }
    }
  }

  if (current) {
    results.push({
      date: current.date || null,
      description: current.descParts.join(" "),
      amount: current.amount,
    });
  }

  return results;
}
