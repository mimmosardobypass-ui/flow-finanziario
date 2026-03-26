import * as pdfjsLib from "pdfjs-dist";

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
  page: number;
}

/* ── regex ──────────────────────────────────────── */

const CODE_RE = /^\d{14,}$/;
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const AMOUNT_RE = /([+-])?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/;

/* ── helpers ────────────────────────────────────── */

function parseItalianAmount(raw: string): number | null {
  const m = raw.match(AMOUNT_RE);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const num = parseFloat(m[2].replace(/\./g, "").replace(",", "."));
  return isNaN(num) ? null : sign * num;
}

function formatDate(ddmmyyyy: string): string | null {
  const m = ddmmyyyy.match(DATE_RE);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const NOISE_PATTERNS = [
  /pagina/i,
  /saldo/i,
  /^codice\s+identificativo/i,
  /^data\s+operazione/i,
  /^data\s+valuta/i,
  /^descrizione$/i,
  /^divisa$/i,
  /^importo$/i,
  /totale\s+movimenti/i,
  /estratto\s+conto/i,
  /^iban/i,
  /^intestat/i,
  /^filiale/i,
  /^conto\s+corrente/i,
];

function isNoiseLine(text: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(text.trim()));
}

/* ── Column ranges ─────────────────────────────── */

interface ColumnRanges {
  codice: [number, number];
  dataOp: [number, number];
  dataVal: [number, number];
  descrizione: [number, number];
  divisa: [number, number];
  importo: [number, number];
}

/**
 * Detect column X ranges from header row.
 * We look for header keywords on the same Y level, then compute
 * boundaries as [thisColumnX, nextColumnX).
 */
function detectColumnRanges(fragments: TextFragment[]): ColumnRanges | null {
  // Collect header candidates
  const candidates: { key: string; x: number; y: number }[] = [];

  for (const f of fragments) {
    const lower = f.str.toLowerCase();
    if (lower.includes("codice") && (lower.includes("identificativo") || lower.includes("ident"))) {
      candidates.push({ key: "codice", x: f.x, y: f.y });
    } else if (lower.includes("data") && lower.includes("operazione")) {
      candidates.push({ key: "dataOp", x: f.x, y: f.y });
    } else if (lower.includes("data") && lower.includes("valuta")) {
      candidates.push({ key: "dataVal", x: f.x, y: f.y });
    } else if (lower === "descrizione" || (lower.includes("descrizione") && !lower.includes("data"))) {
      candidates.push({ key: "descrizione", x: f.x, y: f.y });
    } else if (lower === "divisa") {
      candidates.push({ key: "divisa", x: f.x, y: f.y });
    } else if (lower === "importo" || (lower.includes("importo") && !lower.includes("data"))) {
      candidates.push({ key: "importo", x: f.x, y: f.y });
    }
  }

  if (candidates.length < 3) return null;

  // Group by Y (tolerance 10px) and pick the largest group
  const yBuckets = new Map<number, typeof candidates>();
  for (const c of candidates) {
    const bucketKey = Math.round(c.y / 10) * 10;
    if (!yBuckets.has(bucketKey)) yBuckets.set(bucketKey, []);
    yBuckets.get(bucketKey)!.push(c);
  }

  let bestGroup = candidates;
  let bestSize = 0;
  for (const [, group] of yBuckets) {
    if (group.length > bestSize) {
      bestSize = group.length;
      bestGroup = group;
    }
  }

  // Build a map of key → x
  const xMap: Record<string, number> = {};
  for (const c of bestGroup) {
    // If duplicate key, take the one with smallest x (first occurrence)
    if (!(c.key in xMap) || c.x < xMap[c.key]) {
      xMap[c.key] = c.x;
    }
  }

  // We need at minimum descrizione and importo
  if (!("descrizione" in xMap) || !("importo" in xMap)) return null;

  // Sort keys by X to build ranges
  const sortedKeys = Object.entries(xMap).sort((a, b) => a[1] - b[1]);
  const ranges: Record<string, [number, number]> = {};

  for (let i = 0; i < sortedKeys.length; i++) {
    const [key, startX] = sortedKeys[i];
    const endX = i + 1 < sortedKeys.length ? sortedKeys[i + 1][1] : 9999;
    ranges[key] = [startX - 10, endX - 10]; // 10px tolerance on left edge
  }

  return {
    codice: ranges.codice || [0, ranges.dataOp?.[0] ?? 100],
    dataOp: ranges.dataOp || [100, 200],
    dataVal: ranges.dataVal || [200, 300],
    descrizione: ranges.descrizione || [300, 640],
    divisa: ranges.divisa || [640, 700],
    importo: ranges.importo || [700, 9999],
  };
}

function classifyFragment(x: number, ranges: ColumnRanges): keyof ColumnRanges {
  // Check from right to left (importo is usually rightmost)
  if (x >= ranges.importo[0]) return "importo";
  if (x >= ranges.divisa[0]) return "divisa";
  if (x >= ranges.descrizione[0]) return "descrizione";
  if (x >= ranges.dataVal[0]) return "dataVal";
  if (x >= ranges.dataOp[0]) return "dataOp";
  return "codice";
}

/* ── Main parser ───────────────────────────────── */

export async function parseSellaPdf(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allFragments: TextFragment[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = (item as any).str.trim();
      if (!str) continue;
      allFragments.push({
        x: Math.round((item as any).transform[4]),
        y: Math.round((item as any).transform[5]),
        str,
        page: p,
      });
    }
  }

  // Sort top-to-bottom (Y descending), left-to-right (X ascending)
  allFragments.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });

  const ranges = detectColumnRanges(allFragments);
  if (!ranges) {
    console.warn("[parseSellaPdf] Column detection failed, using fallback");
    return fallbackParsing(allFragments);
  }

  console.log("[parseSellaPdf] Detected column ranges:", ranges);

  // ── Build transaction blocks ──
  // Each block starts when we encounter a 14+ digit code
  interface TxBlock {
    dates: string[];      // dd/MM/yyyy strings from dataOp column
    descParts: string[];  // text fragments from descrizione column
    amountParts: string[]; // text fragments from importo column
  }

  const blocks: TxBlock[] = [];
  let current: TxBlock | null = null;

  for (const f of allFragments) {
    // Skip noise
    if (isNoiseLine(f.str)) continue;

    const col = classifyFragment(f.x, ranges);

    // New transaction block on codice column with 14+ digit code
    if (col === "codice" && CODE_RE.test(f.str)) {
      if (current) blocks.push(current);
      current = { dates: [], descParts: [], amountParts: [] };
      continue; // don't store the code itself
    }

    if (!current) continue;

    switch (col) {
      case "codice":
        // Continuation text that landed in code column area
        // Could be part of description on a wrapped line
        if (!CODE_RE.test(f.str) && !DATE_RE.test(f.str)) {
          current.descParts.push(f.str);
        }
        break;

      case "dataOp":
        if (DATE_RE.test(f.str)) {
          current.dates.push(f.str);
        } else if (!CODE_RE.test(f.str)) {
          // Could be wrapped description text
          current.descParts.push(f.str);
        }
        break;

      case "dataVal":
        // Ignore data valuta entirely
        break;

      case "descrizione":
        // Accept anything that isn't a bare code or duplicate date
        if (!CODE_RE.test(f.str)) {
          current.descParts.push(f.str);
        }
        break;

      case "divisa":
        // Ignore "EUR" and similar
        break;

      case "importo":
        // Collect everything - we'll parse the joined string
        if (f.str !== "EUR") {
          current.amountParts.push(f.str);
        }
        break;
    }
  }

  if (current) blocks.push(current);

  // ── Convert blocks to ParsedRow[] ──
  const results: ParsedRow[] = [];

  for (const block of blocks) {
    // Date: take first valid date from dataOp
    let date: string | null = null;
    for (const d of block.dates) {
      date = formatDate(d);
      if (date) break;
    }

    // Amount: join all amount parts and extract
    const amountStr = block.amountParts.join(" ").trim();
    const amount = amountStr ? parseItalianAmount(amountStr) : null;

    // Description: join, clean dates that leaked in, normalize
    let description = block.descParts
      .filter((s) => !DATE_RE.test(s) && s !== "EUR")
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    results.push({ date, description, amount });
  }

  return results;
}

/* ── Fallback ──────────────────────────────────── */

function fallbackParsing(fragments: TextFragment[]): ParsedRow[] {
  const results: ParsedRow[] = [];
  let current: { date: string | null; descParts: string[]; amount: number | null } | null = null;

  // Group into visual rows with Y tolerance
  const rows: { y: number; page: number; items: TextFragment[] }[] = [];
  for (const f of fragments) {
    const existing = rows.find((r) => r.page === f.page && Math.abs(r.y - f.y) <= 4);
    if (existing) {
      existing.items.push(f);
    } else {
      rows.push({ y: f.y, page: f.page, items: [f] });
    }
  }
  rows.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return b.y - a.y;
  });
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);

  for (const row of rows) {
    const line = row.items.map((i) => i.str).join(" ").trim();
    if (!line || isNoiseLine(line)) continue;

    // Check if line starts with a 14+ digit code
    const firstToken = line.split(/\s+/)[0];
    if (CODE_RE.test(firstToken)) {
      if (current) {
        results.push({
          date: current.date,
          description: current.descParts.join(" ").trim(),
          amount: current.amount,
        });
      }

      // Extract date
      const dateMatches = line.match(/\d{2}\/\d{2}\/\d{4}/g);
      const date = dateMatches ? formatDate(dateMatches[0]) : null;

      // Extract amount (after EUR)
      let amount: number | null = null;
      const eurIdx = line.indexOf("EUR");
      if (eurIdx >= 0) {
        amount = parseItalianAmount(line.substring(eurIdx + 3));
      }

      // Description: between second date and EUR (or end)
      let desc = "";
      if (dateMatches && dateMatches.length >= 2) {
        const lastDateIdx = line.lastIndexOf(dateMatches[1]);
        const endIdx = eurIdx >= 0 ? eurIdx : line.length;
        desc = line.substring(lastDateIdx + dateMatches[1].length, endIdx).trim();
      }

      current = { date, descParts: desc ? [desc] : [], amount };
    } else if (current) {
      // Continuation line
      if (current.amount == null) {
        const amt = parseItalianAmount(line);
        if (amt != null) {
          current.amount = amt;
          const remaining = line.replace(AMOUNT_RE, "").replace(/EUR/g, "").trim();
          if (remaining) current.descParts.push(remaining);
          continue;
        }
      }
      current.descParts.push(line.replace(/EUR/g, "").trim());
    }
  }

  if (current) {
    results.push({
      date: current.date,
      description: current.descParts.join(" ").trim(),
      amount: current.amount,
    });
  }

  return results;
}
