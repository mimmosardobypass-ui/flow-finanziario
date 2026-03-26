import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
}

interface TextFragment {
  x: number;
  y: number;
  w: number; // width of fragment
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
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > 2100) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const NOISE_RE = [
  /pagina\s*\d/i,
  /^pagina$/i,
  /saldo\s*(iniziale|finale|contabile|disponibile)/i,
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
  /^\d{2}\/\d{2}\/\d{4}\s*$/,  // bare date on its own
];

function isNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t === "EUR") return true;
  return NOISE_RE.some((re) => re.test(t));
}

/* ── Column boundaries ─────────────────────────── */

interface ColumnBounds {
  // Midpoint boundaries between columns (sorted left to right)
  // Columns: codice | dataOp | dataVal | descrizione | divisa | importo
  // We store 5 boundaries: b0..b4
  // x < b0 → codice
  // b0 <= x < b1 → dataOp
  // b1 <= x < b2 → dataVal
  // b2 <= x < b3 → descrizione
  // b3 <= x < b4 → divisa
  // x >= b4 → importo
  boundaries: number[];
  headerY: number;
}

type ColName = "codice" | "dataOp" | "dataVal" | "descrizione" | "divisa" | "importo";

const HEADER_KEYWORDS: { key: ColName; test: (s: string) => boolean }[] = [
  { key: "codice", test: (s) => /codice/i.test(s) && /ident/i.test(s) },
  { key: "dataOp", test: (s) => /data/i.test(s) && /operazione/i.test(s) },
  { key: "dataVal", test: (s) => /data/i.test(s) && /valuta/i.test(s) },
  { key: "descrizione", test: (s) => /descrizione/i.test(s) },
  { key: "divisa", test: (s) => /^divisa$/i.test(s) },
  { key: "importo", test: (s) => /^importo$/i.test(s) },
];

function detectColumns(fragments: TextFragment[]): ColumnBounds | null {
  // Find header fragments by matching keywords
  const found: { key: ColName; x: number; y: number }[] = [];

  for (const f of fragments) {
    for (const hk of HEADER_KEYWORDS) {
      if (hk.test(f.str)) {
        found.push({ key: hk.key, x: f.x, y: f.y });
        break;
      }
    }
  }

  if (found.length < 3) return null;

  // Group by Y with tolerance 15 and pick largest group
  const yGroups = new Map<number, typeof found>();
  for (const c of found) {
    let assigned = false;
    for (const [bucketY, group] of yGroups) {
      if (Math.abs(c.y - bucketY) <= 15) {
        group.push(c);
        assigned = true;
        break;
      }
    }
    if (!assigned) yGroups.set(c.y, [c]);
  }

  let bestGroup = found;
  for (const [, group] of yGroups) {
    if (group.length > bestGroup.length || 
        (group.length === bestGroup.length && group.length > 0)) {
      bestGroup = group;
    }
  }

  // Deduplicate by key, keep leftmost x
  const colX: Partial<Record<ColName, number>> = {};
  for (const c of bestGroup) {
    if (!(c.key in colX) || c.x < colX[c.key]!) {
      colX[c.key] = c.x;
    }
  }

  // Need at minimum descrizione + importo
  if (!("descrizione" in colX) || !("importo" in colX)) return null;

  // Build sorted column list
  const COL_ORDER: ColName[] = ["codice", "dataOp", "dataVal", "descrizione", "divisa", "importo"];
  const presentCols = COL_ORDER.filter((k) => k in colX);
  presentCols.sort((a, b) => colX[a]! - colX[b]!);

  // Compute midpoint boundaries between adjacent columns
  const boundaries: number[] = [];
  for (let i = 0; i < presentCols.length - 1; i++) {
    const thisX = colX[presentCols[i]]!;
    const nextX = colX[presentCols[i + 1]]!;
    boundaries.push((thisX + nextX) / 2);
  }

  const headerY = bestGroup[0].y;

  console.log("[parseSellaPdf] Columns detected:", presentCols.map((k) => `${k}=${colX[k]}`).join(", "));
  console.log("[parseSellaPdf] Midpoint boundaries:", boundaries);

  return { boundaries, headerY };
}

function classifyX(x: number, bounds: ColumnBounds): ColName {
  const b = bounds.boundaries;
  // With 6 columns we have 5 boundaries
  // But we might have fewer if some columns are missing
  // The order is always: codice, dataOp, dataVal, descrizione, divisa, importo
  // We classify based on which segment x falls into
  
  let segment = 0;
  for (let i = 0; i < b.length; i++) {
    if (x >= b[i]) segment = i + 1;
  }
  
  // Map segment to column name based on how many columns we have
  const allCols: ColName[] = ["codice", "dataOp", "dataVal", "descrizione", "divisa", "importo"];
  // We have b.length + 1 segments
  // segment 0 is leftmost column, segment b.length is rightmost
  // Map: segment index → column name
  // Since boundaries are midpoints between detected columns, and we have
  // b.length+1 = number of detected columns, we need the original column order
  
  // Simpler: just return based on hardcoded thresholds
  // Actually the boundaries array has exactly (numDetectedCols - 1) entries
  // segment i corresponds to the i-th detected column
  // But we don't know which columns were detected here...
  
  // Let me use a different approach: store the mapping with the bounds
  return segment >= allCols.length ? "importo" : allCols[Math.min(segment, allCols.length - 1)];
}

/* ── Better approach: store column ranges explicitly ── */

interface ColumnRanges {
  ranges: { name: ColName; left: number; right: number }[];
}

function buildColumnRanges(fragments: TextFragment[]): ColumnRanges | null {
  const found: { key: ColName; x: number; y: number }[] = [];

  for (const f of fragments) {
    for (const hk of HEADER_KEYWORDS) {
      if (hk.test(f.str)) {
        found.push({ key: hk.key, x: f.x, y: f.y });
        break;
      }
    }
  }

  if (found.length < 3) return null;

  // Group by Y with tolerance 15 and pick largest group
  const yGroups = new Map<number, typeof found>();
  for (const c of found) {
    let assigned = false;
    for (const [bucketY, group] of yGroups) {
      if (Math.abs(c.y - bucketY) <= 15) {
        group.push(c);
        assigned = true;
        break;
      }
    }
    if (!assigned) yGroups.set(c.y, [c]);
  }

  let bestGroup = found;
  for (const [, group] of yGroups) {
    if (group.length > bestGroup.length) {
      bestGroup = group;
    }
  }

  // Deduplicate by key, keep leftmost x
  const colX: Partial<Record<ColName, number>> = {};
  for (const c of bestGroup) {
    if (!(c.key in colX) || c.x < colX[c.key]!) {
      colX[c.key] = c.x;
    }
  }

  if (!("descrizione" in colX) || !("importo" in colX)) return null;

  // Sort detected columns by X position
  const COL_ORDER: ColName[] = ["codice", "dataOp", "dataVal", "descrizione", "divisa", "importo"];
  const presentCols = COL_ORDER.filter((k) => k in colX);
  presentCols.sort((a, b) => colX[a]! - colX[b]!);

  // Build ranges using midpoints as boundaries
  const ranges: { name: ColName; left: number; right: number }[] = [];
  for (let i = 0; i < presentCols.length; i++) {
    const name = presentCols[i];
    const left = i === 0 ? 0 : (colX[presentCols[i - 1]]! + colX[name]!) / 2;
    const right = i === presentCols.length - 1 ? 9999 : (colX[name]! + colX[presentCols[i + 1]]!) / 2;
    ranges.push({ name, left, right });
  }

  console.log("[parseSellaPdf] Column ranges:", ranges.map((r) => `${r.name}:[${Math.round(r.left)},${Math.round(r.right)})`).join("  "));

  return { ranges };
}

function classifyFragment(x: number, colRanges: ColumnRanges): ColName {
  for (const r of colRanges.ranges) {
    if (x >= r.left && x < r.right) return r.name;
  }
  // Default: if beyond all ranges, it's importo (rightmost)
  return "importo";
}

/* ── Visual row grouping ───────────────────────── */

function groupByVisualRows(fragments: TextFragment[], yTolerance: number = 3): TextFragment[][] {
  if (fragments.length === 0) return [];
  
  // Sort by Y descending (top of page = higher Y in PDF coords), then X ascending
  const sorted = [...fragments].sort((a, b) => {
    if (Math.abs(a.y - b.y) > yTolerance) return b.y - a.y;
    return a.x - b.x;
  });

  const rows: TextFragment[][] = [];
  let currentRow: TextFragment[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= yTolerance) {
      currentRow.push(sorted[i]);
    } else {
      rows.push(currentRow);
      currentRow = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  rows.push(currentRow);

  // Sort items within each row by X
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }

  return rows;
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
      const transform = (item as any).transform;
      allFragments.push({
        x: Math.round(transform[4]),
        y: Math.round(transform[5]),
        w: Math.round((item as any).width || 0),
        str,
        page: p,
      });
    }
  }

  // Detect column structure
  const colRanges = buildColumnRanges(allFragments);
  if (!colRanges) {
    console.warn("[parseSellaPdf] Column detection failed, using fallback");
    return fallbackParsing(allFragments);
  }

  // Sort fragments: page asc, Y desc (top to bottom), X asc
  allFragments.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });

  // ── Phase 1: Collect transaction blocks ──
  // A block starts at each 14+ digit code fragment
  interface RawBlock {
    fragments: TextFragment[];
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;

  for (const f of allFragments) {
    if (isNoise(f.str)) continue;

    const col = classifyFragment(f.x, colRanges);

    // New block on code
    if (col === "codice" && CODE_RE.test(f.str)) {
      if (currentBlock && currentBlock.fragments.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = { fragments: [] };
      continue; // skip the code itself
    }

    if (currentBlock) {
      currentBlock.fragments.push(f);
    }
  }
  if (currentBlock && currentBlock.fragments.length > 0) {
    blocks.push(currentBlock);
  }

  console.log(`[parseSellaPdf] Found ${blocks.length} transaction blocks`);

  // ── Phase 2: Extract data from each block ──
  const results: ParsedRow[] = [];

  for (const block of blocks) {
    // Classify each fragment
    const dates: string[] = [];
    const descParts: string[] = [];
    const amountParts: string[] = [];

    // Group fragments by visual rows within the block
    const visualRows = groupByVisualRows(block.fragments);

    for (const row of visualRows) {
      for (const f of row) {
        const col = classifyFragment(f.x, colRanges);

        switch (col) {
          case "codice":
            // Continuation text in code area - likely wrapped description
            if (!CODE_RE.test(f.str) && !DATE_RE.test(f.str) && f.str !== "EUR") {
              descParts.push(f.str);
            }
            break;

          case "dataOp":
            if (DATE_RE.test(f.str)) {
              dates.push(f.str);
            } else if (!CODE_RE.test(f.str) && f.str !== "EUR") {
              // Wrapped description text that landed in dataOp area
              descParts.push(f.str);
            }
            break;

          case "dataVal":
            // Ignore data valuta entirely - we only need data operazione
            break;

          case "descrizione":
            if (!CODE_RE.test(f.str) && f.str !== "EUR") {
              descParts.push(f.str);
            }
            break;

          case "divisa":
            // Ignore EUR/divisa
            break;

          case "importo":
            if (f.str !== "EUR") {
              amountParts.push(f.str);
            }
            break;
        }
      }
    }

    // Extract date (first valid date)
    let date: string | null = null;
    for (const d of dates) {
      date = formatDate(d);
      if (date) break;
    }

    // Extract amount - join parts and parse
    const amountStr = amountParts.join(" ").trim();
    let amount = parseItalianAmount(amountStr);
    
    // If amount parts were split (sign separate from number), try combining
    if (amount === null && amountParts.length > 1) {
      // Try: first part is sign, rest is number
      const combined = amountParts.join("").trim();
      amount = parseItalianAmount(combined);
    }

    // Build description - filter out leaked dates and noise
    const description = descParts
      .filter((s) => {
        const t = s.trim();
        if (!t) return false;
        if (DATE_RE.test(t)) return false;
        if (t === "EUR") return false;
        if (CODE_RE.test(t)) return false;
        return true;
      })
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Only add if we have at least a date or amount (skip pure noise blocks)
    if (date || amount !== null) {
      results.push({ date, description, amount });
    }
  }

  console.log(`[parseSellaPdf] Parsed ${results.length} transactions`);
  return results;
}

/* ── Fallback parser ───────────────────────────── */

function fallbackParsing(fragments: TextFragment[]): ParsedRow[] {
  const results: ParsedRow[] = [];
  let current: { date: string | null; descParts: string[]; amount: number | null } | null = null;

  const visualRows = groupByVisualRows(fragments, 4);

  // Sort rows by page then Y descending
  visualRows.sort((a, b) => {
    if (a[0].page !== b[0].page) return a[0].page - b[0].page;
    return b[0].y - a[0].y;
  });

  for (const row of visualRows) {
    const line = row.map((f) => f.str).join(" ").trim();
    if (!line || isNoise(line)) continue;

    const firstToken = line.split(/\s+/)[0];
    if (CODE_RE.test(firstToken)) {
      if (current) {
        results.push({
          date: current.date,
          description: current.descParts.join(" ").trim(),
          amount: current.amount,
        });
      }

      const dateMatches = line.match(/\d{2}\/\d{2}\/\d{4}/g);
      const date = dateMatches ? formatDate(dateMatches[0]) : null;

      let amount: number | null = null;
      const eurIdx = line.indexOf("EUR");
      if (eurIdx >= 0) {
        amount = parseItalianAmount(line.substring(eurIdx + 3));
      }

      let desc = "";
      if (dateMatches && dateMatches.length >= 2) {
        const lastDateIdx = line.lastIndexOf(dateMatches[1]);
        const endIdx = eurIdx >= 0 ? eurIdx : line.length;
        desc = line.substring(lastDateIdx + dateMatches[1].length, endIdx).trim();
      }

      current = { date, descParts: desc ? [desc] : [], amount };
    } else if (current) {
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
