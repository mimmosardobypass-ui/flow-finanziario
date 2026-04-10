import { useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { parse, isValid, format } from "date-fns";
import { parseSellaPdf } from "@/utils/parseSellaPdf";
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  Search,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  useEnsureClassificationCategories,
  useImportTransactions,
  ParsedTransaction,
} from "@/hooks/useImportTransactions";
import { useContiAttivi } from "@/hooks/useConti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ── helpers ────────────────────────────────────────── */

const DATE_FORMATS = [
  "dd/MM/yyyy",
  "yyyy-MM-dd",
  "dd-MM-yyyy",
  "MM/dd/yyyy",
  "d/M/yyyy",
  "dd.MM.yyyy",
];

function tryParseDate(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    try {
      const excelDate = XLSX.SSF.parse_date_code(raw);
      if (excelDate) {
        const d = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
        if (isValid(d)) return format(d, "yyyy-MM-dd");
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  const str = String(raw).trim();
  if (!str) return null;
  for (const fmt of DATE_FORMATS) {
    const d = parse(str, fmt, new Date());
    if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
      return format(d, "yyyy-MM-dd");
    }
  }
  const fallback = new Date(str);
  if (isValid(fallback) && fallback.getFullYear() > 1900) {
    return format(fallback, "yyyy-MM-dd");
  }
  return null;
}

function tryParseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  let str = String(raw).trim().replace(/[€$£\s]/g, "");
  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

interface ParsedRow {
  date: string | null;
  description: string;
  amount: number | null;
}

function parseWorkbook(workbook: XLSX.WorkBook): ParsedRow[] | string {
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const limit = Math.min(raw.length, 200);

    for (let i = 0; i < limit; i++) {
      const row = raw[i];
      if (!Array.isArray(row)) continue;

      const headerCells = row.map((cell) =>
        typeof cell === "string" ? cell.trim().toLowerCase() : ""
      );

      const dateIndex = headerCells.findIndex((c) => c.includes("data contabile"));
      if (dateIndex < 0) continue;

      const descrIndex = headerCells.findIndex((c) => c.includes("descrizione"));
      const debitIndex = headerCells.findIndex((c) => c.includes("addebiti"));
      const creditIndex = headerCells.findIndex((c) => c.includes("accrediti"));
      const importoIndex = headerCells.findIndex((c) => c.includes("importo"));

      const dataRows = raw.slice(i + 1);
      const parsed: ParsedRow[] = [];

      for (const dr of dataRows) {
        if (!Array.isArray(dr) || dr.length === 0) continue;
        const hasAnyValue = dr.some((c) => c != null && String(c).trim() !== "");
        if (!hasAnyValue) continue;

        const dateRaw = dr[dateIndex];
        const descrRaw = descrIndex >= 0 ? dr[descrIndex] : "";

        let amount: number | null = null;
        if (debitIndex >= 0 && dr[debitIndex] != null && String(dr[debitIndex]).trim() !== "") {
          const v = tryParseAmount(dr[debitIndex]);
          if (v != null && v !== 0) amount = -Math.abs(v);
        }
        if (amount == null && creditIndex >= 0 && dr[creditIndex] != null && String(dr[creditIndex]).trim() !== "") {
          const v = tryParseAmount(dr[creditIndex]);
          if (v != null && v !== 0) amount = Math.abs(v);
        }
        if (amount == null && importoIndex >= 0) {
          amount = tryParseAmount(dr[importoIndex]);
        }

        parsed.push({
          date: tryParseDate(dateRaw),
          description: descrRaw != null ? String(descrRaw).trim() : "",
          amount,
        });
      }

      return parsed;
    }
  }

  return "Intestazione 'Data Contabile' non trovata nelle prime 200 righe.";
}

/* ── fingerprint ────────────────────────────────────── */

function normalizeDescription(desc: string): string {
  return desc.toLowerCase().trim().replace(/\s+/g, " ");
}

function makeFingerprint(contoId: string, date: string, amount: number, description: string): string {
  return `${contoId}|${date}|${Math.abs(amount).toFixed(2)}|${normalizeDescription(description)}`;
}

/* ── types for duplicate review ─────────────────────── */

interface ExistingTransaction {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  type: string;
}

interface DuplicateMatch {
  fileIndex: number;
  fileRow: ParsedRow;
  existing: ExistingTransaction;
}

type Step = "preview" | "review" | "importing";

/* ── component ──────────────────────────────────────── */

export default function ImportTransazioni() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [selectedContoId, setSelectedContoId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [step, setStep] = useState<Step>("preview");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [newRowIndices, setNewRowIndices] = useState<number[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showDuplicatesExpanded, setShowDuplicatesExpanded] = useState(true);
  const [showNewExpanded, setShowNewExpanded] = useState(false);

  const ensureCategoriesMutation = useEnsureClassificationCategories();
  const importMutation = useImportTransactions();
  const { data: contiAttivi = [] } = useContiAttivi();

  /* ── derived data ── */

  const suspiciousPatterns = useMemo(
    () => [/^identificativo$/i, /^saldo$/i, /^eur$/i, /^divisa$/i, /^importo$/i, /^data$/i, /^codice$/i],
    []
  );

  const parsedRows = useMemo(() => {
    return rows.map((row, i) => {
      const emptyDesc = !row.description || row.description.trim().length === 0;
      const suspiciousDesc = suspiciousPatterns.some((re) => re.test(row.description.trim()));
      const hasError = !row.date || row.amount == null || row.amount === 0 || emptyDesc || suspiciousDesc;
      return { index: i, ...row, hasError };
    });
  }, [rows, suspiciousPatterns]);

  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return parsedRows;
    const q = searchText.toLowerCase();
    return parsedRows.filter((r) => r.description.toLowerCase().includes(q));
  }, [parsedRows, searchText]);

  const errorIndices = useMemo(
    () => new Set(parsedRows.filter((r) => r.hasError).map((r) => r.index)),
    [parsedRows]
  );

  const selectableCount = rows.length - errorIndices.size;
  const includedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      if (!errorIndices.has(i) && !excludedRows.has(i)) count++;
    }
    return count;
  }, [rows.length, excludedRows, errorIndices]);

  const allSelected = selectableCount > 0 && includedCount === selectableCount;

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of parsedRows) {
      if (r.hasError || excludedRows.has(r.index)) continue;
      if (r.amount! >= 0) income += r.amount!;
      else expense += Math.abs(r.amount!);
    }
    return { income, expense };
  }, [parsedRows, excludedRows]);

  /* ── actions ── */

  const toggleRow = useCallback(
    (index: number) => {
      if (errorIndices.has(index)) return;
      setExcludedRows((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    },
    [errorIndices]
  );

  const toggleAll = useCallback(() => {
    if (allSelected) {
      const all = new Set<number>();
      for (let i = 0; i < rows.length; i++) {
        if (!errorIndices.has(i)) all.add(i);
      }
      setExcludedRows(all);
    } else {
      setExcludedRows(new Set());
    }
  }, [allSelected, rows.length, errorIndices]);

  const processFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isPdf = file.type === "application/pdf" || ext === "pdf";
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/vnd.ms-excel",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type) && ext !== "xlsx" && ext !== "csv" && ext !== "pdf") {
      toast({ title: "Formato non supportato", description: "Carica un file .xlsx, .csv o .pdf", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        let result: ParsedRow[] | string;

        if (isPdf) {
          const pdfRows = await parseSellaPdf(buffer);
          result = pdfRows.length > 0 ? pdfRows : "Nessuna transazione trovata nel PDF.";
        } else {
          const data = new Uint8Array(buffer);
          const workbook = XLSX.read(data, { type: "array" });
          if (workbook.SheetNames.length === 0) {
            toast({ title: "File vuoto", description: "Il file non contiene fogli", variant: "destructive" });
            return;
          }
          result = parseWorkbook(workbook);
        }

        if (typeof result === "string") {
          toast({ title: "Colonne non trovate", description: result, variant: "destructive" });
          return;
        }

        if (result.length === 0) {
          toast({ title: "Nessun dato", description: "Nessuna riga dati trovata.", variant: "destructive" });
          return;
        }

        setRows(result);
        setFileName(file.name);
        setExcludedRows(new Set());
        setSearchText("");
        setStep("preview");
        setDuplicates([]);
        setNewRowIndices([]);
      } catch {
        toast({ title: "Errore di lettura", description: "File corrotto o formato non supportato", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  /* ── duplicate check ── */

  const checkDuplicates = async () => {
    if (!selectedContoId || !user) return;
    setCheckingDuplicates(true);

    try {
      // Fetch all existing transactions for this conto
      const PAGE_SIZE = 1000;
      let allExisting: ExistingTransaction[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, date, description, amount, type")
          .eq("user_id", user.id)
          .eq("conto_id", selectedContoId)
          .is("deleted_at", null)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        allExisting.push(...(data || []));
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      // Build fingerprint set from existing transactions
      const existingByFingerprint = new Map<string, ExistingTransaction>();
      for (const tx of allExisting) {
        const fp = makeFingerprint(
          selectedContoId,
          tx.date,
          tx.type === "expense" ? -tx.amount : tx.amount,
          tx.description || ""
        );
        existingByFingerprint.set(fp, tx);
      }

      // Check each valid file row against existing
      const foundDuplicates: DuplicateMatch[] = [];
      const foundNew: number[] = [];
      const newExcluded = new Set(excludedRows);

      for (const r of parsedRows) {
        if (r.hasError) continue;
        
        const fp = makeFingerprint(
          selectedContoId,
          r.date!,
          r.amount!,
          r.description
        );

        const existing = existingByFingerprint.get(fp);
        if (existing) {
          foundDuplicates.push({
            fileIndex: r.index,
            fileRow: { date: r.date, description: r.description, amount: r.amount },
            existing,
          });
          // Auto-deselect duplicates
          newExcluded.add(r.index);
        } else {
          foundNew.push(r.index);
        }
      }

      setDuplicates(foundDuplicates);
      setNewRowIndices(foundNew);
      setExcludedRows(newExcluded);

      if (foundDuplicates.length === 0) {
        // No duplicates — proceed directly to import
        toast({ title: "Nessun duplicato trovato", description: "Tutte le righe sono nuove." });
        await doImport(newExcluded);
      } else {
        setStep("review");
        setShowDuplicatesExpanded(true);
        setShowNewExpanded(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante il controllo duplicati";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  /* ── import ── */

  const doImport = async (excluded?: Set<number>) => {
    const finalExcluded = excluded ?? excludedRows;
    if (!selectedContoId) return;
    setImporting(true);
    setStep("importing");

    try {
      const categories = await ensureCategoriesMutation.mutateAsync();
      const parsed: ParsedTransaction[] = [];
      let skipped = 0;

      for (const r of parsedRows) {
        if (finalExcluded.has(r.index) || r.hasError) {
          skipped++;
          continue;
        }
        parsed.push({
          date: r.date!,
          description: r.description,
          amount: r.amount!,
        });
      }

      if (parsed.length === 0) {
        toast({ title: "Nessuna riga valida", description: `${skipped} righe saltate.`, variant: "destructive" });
        setImporting(false);
        setStep("review");
        return;
      }

      const result = await importMutation.mutateAsync({
        transactions: parsed,
        categories,
        contoId: selectedContoId,
      });

      toast({
        title: "Importazione completata",
        description: `Importate ${result.imported} transazioni${skipped > 0 ? `, escluse ${skipped}` : ""}.`,
      });
      navigate("/transactions");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore durante l'importazione";
      toast({ title: "Errore di importazione", description: msg, variant: "destructive" });
      setStep("review");
    } finally {
      setImporting(false);
    }
  };

  const handleImport = () => {
    checkDuplicates();
  };

  const excludeAllDuplicates = () => {
    const newExcluded = new Set(excludedRows);
    for (const d of duplicates) newExcluded.add(d.fileIndex);
    setExcludedRows(newExcluded);
  };

  /* ── render helpers ── */

  const formatAmount = (amount: number) => {
    const sign = amount >= 0 ? "+" : "-";
    const color = amount >= 0 ? "text-success" : "text-destructive";
    return (
      <span className={color}>
        {sign}€{Math.abs(amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
      </span>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd/MM/yyyy");
    } catch {
      return d;
    }
  };

  const hasFile = rows.length > 0;

  /* ── REVIEW STEP ── */
  if (step === "review") {
    const dupCount = duplicates.length;
    const newCount = newRowIndices.length;
    const dupExcludedCount = duplicates.filter((d) => excludedRows.has(d.fileIndex)).length;
    const dupIncludedCount = dupCount - dupExcludedCount;
    const totalIncluded = includedCount;

    return (
      <div className="h-screen flex flex-col bg-background">
        {/* HEADER */}
        <div className="shrink-0 border-b border-border bg-card px-4 py-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setStep("preview")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Torna all'anteprima
            </Button>
            <h1 className="text-lg font-bold text-foreground">Verifica movimenti già presenti</h1>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <Badge variant="outline" className="gap-1.5 py-1">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {rows.length} righe nel file
            </Badge>
            <Badge variant="secondary" className="gap-1.5 py-1 bg-success/10 text-success border-success/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              {newCount} nuove
            </Badge>
            <Badge variant="secondary" className="gap-1.5 py-1 bg-warning/10 text-warning border-warning/20">
              <ShieldAlert className="h-3.5 w-3.5" />
              {dupCount} già presenti
            </Badge>
            {dupIncludedCount > 0 && (
              <Badge variant="secondary" className="gap-1.5 py-1">
                {dupIncludedCount} duplicati riattivati
              </Badge>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Duplicates section */}
          {dupCount > 0 && (
            <div className="border border-warning/30 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-warning/5 hover:bg-warning/10 transition-colors"
                onClick={() => setShowDuplicatesExpanded(!showDuplicatesExpanded)}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-warning" />
                  <span className="font-semibold text-foreground">
                    Movimenti già presenti ({dupCount})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    — deselezionati per default, riattivabili manualmente
                  </span>
                </div>
                {showDuplicatesExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showDuplicatesExpanded && (
                <div className="divide-y divide-border">
                  {duplicates.map((d) => {
                    const isExcluded = excludedRows.has(d.fileIndex);
                    const existingAmount =
                      d.existing.type === "expense" ? -d.existing.amount : d.existing.amount;

                    return (
                      <div
                        key={d.fileIndex}
                        className={`px-4 py-3 space-y-2 ${isExcluded ? "opacity-60" : "bg-warning/5"}`}
                      >
                        {/* File row */}
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={!isExcluded}
                            onCheckedChange={() => toggleRow(d.fileIndex)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant="outline" className="text-xs px-1.5 py-0">File</Badge>
                              <span className="text-xs text-muted-foreground">
                                {isExcluded ? "Esclusa dall'importazione" : "Sarà importata"}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-muted-foreground w-[90px]">{formatDate(d.fileRow.date)}</span>
                              <span className="flex-1 truncate">{d.fileRow.description}</span>
                              <span className="font-medium">{formatAmount(d.fileRow.amount!)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Existing row (read-only) */}
                        <div className="flex items-start gap-3 ml-7 pl-3 border-l-2 border-muted">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">DB</Badge>
                              <span className="text-xs text-muted-foreground">Movimento già esistente nel database</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="w-[90px]">{formatDate(d.existing.date)}</span>
                              <span className="flex-1 truncate">{d.existing.description || "—"}</span>
                              <span className="font-medium">{formatAmount(existingAmount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* New rows section */}
          {newCount > 0 && (
            <div className="border border-success/30 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-success/5 hover:bg-success/10 transition-colors"
                onClick={() => setShowNewExpanded(!showNewExpanded)}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-success" />
                  <span className="font-semibold text-foreground">
                    Movimenti da importare ({newCount})
                  </span>
                </div>
                {showNewExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showNewExpanded && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked disabled />
                      </TableHead>
                      <TableHead className="w-[110px]">Data</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead className="w-[130px] text-right">Importo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newRowIndices.map((idx) => {
                      const r = parsedRows[idx];
                      if (!r) return null;
                      const isExcluded = excludedRows.has(idx);
                      return (
                        <TableRow key={idx} className={isExcluded ? "opacity-40" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={!isExcluded}
                              onCheckedChange={() => toggleRow(idx)}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                          <TableCell className="text-sm">{r.description}</TableCell>
                          <TableCell className="text-sm text-right font-medium">
                            {r.amount != null ? formatAmount(r.amount) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setStep("preview")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </Button>
            {dupCount > 0 && (
              <Button variant="outline" size="sm" onClick={excludeAllDuplicates}>
                Escludi tutti i duplicati
              </Button>
            )}
          </div>
          <Button
            onClick={() => doImport()}
            disabled={importing || totalIncluded === 0}
          >
            {importing
              ? "Importazione in corso..."
              : `Conferma importazione (${totalIncluded} righe)`}
          </Button>
        </div>
      </div>
    );
  }

  /* ── PREVIEW STEP (original) ── */

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── HEADER ── */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/transactions")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Transazioni
          </Button>

          <h1 className="text-lg font-bold text-foreground">Importa Transazioni</h1>

          {fileName && (
            <Badge variant="secondary" className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload className="h-4 w-4" />
              {hasFile ? "Cambia file" : "Carica file"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.pdf" className="hidden" onChange={handleFileInput} />
          </div>
        </div>

        {hasFile && (
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1 min-w-[180px]">
              <Label className="text-xs">Conto destinazione *</Label>
              <Select value={selectedContoId} onValueChange={setSelectedContoId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleziona conto" />
                </SelectTrigger>
                <SelectContent>
                  {contiAttivi.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_conto}{c.banca ? ` (${c.banca})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs">Cerca descrizione</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Filtra..." className="h-8 text-sm pl-7" />
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs whitespace-nowrap pb-1">
              <span className="text-muted-foreground">{includedCount}/{rows.length} righe</span>
              <span className="text-success font-medium">+€{totals.income.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
              <span className="text-destructive font-medium">-€{totals.expense.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto">
        {!hasFile ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="max-w-xl w-full space-y-6">
              <div
                className="border-2 border-dashed border-border rounded-lg p-16 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1 text-lg">Trascina un file qui o clicca per selezionarlo</p>
                <p className="text-sm text-muted-foreground">Formati supportati: .xlsx, .csv, .pdf (Banca Sella)</p>
              </div>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Seleziona tutto" />
                </TableHead>
                <TableHead className="w-[110px]">Data</TableHead>
                <TableHead className="min-w-[300px]">Descrizione</TableHead>
                <TableHead className="w-[130px] text-right">Importo</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => {
                const isExcluded = excludedRows.has(r.index);
                const rowCls = r.hasError
                  ? "opacity-40 bg-destructive/5"
                  : isExcluded
                    ? "opacity-40"
                    : "";

                return (
                  <TableRow key={r.index} className={rowCls}>
                    <TableCell className="w-10">
                      <Checkbox
                        checked={!r.hasError && !isExcluded}
                        disabled={r.hasError}
                        onCheckedChange={() => toggleRow(r.index)}
                        aria-label={`Riga ${r.index + 1}`}
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {r.amount != null ? (
                        <span className={r.amount >= 0 ? "text-success" : "text-destructive"}>
                          {r.amount >= 0 ? "+" : "-"}€{Math.abs(r.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {r.hasError && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── FOOTER ── */}
      {hasFile && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/transactions")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Annulla
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedContoId || checkingDuplicates || importing || includedCount === 0}
          >
            {checkingDuplicates
              ? "Controllo duplicati..."
              : importing
                ? "Importazione in corso..."
                : `Conferma Importazione (${includedCount} righe)`}
          </Button>
        </div>
      )}
    </div>
  );
}
