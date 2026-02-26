import { useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { parse, isValid, format } from "date-fns";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  useEnsureClassificationCategories,
  useImportTransactions,
  ParsedTransaction,
} from "@/hooks/useImportTransactions";
import { useContiAttivi } from "@/hooks/useConti";

type Step = "upload" | "preview" | "result";

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
    } catch { /* ignore */ }
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportTransactionsDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    categoryId: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedContoId, setSelectedContoId] = useState("");

  const ensureCategoriesMutation = useEnsureClassificationCategories();
  const importMutation = useImportTransactions();
  const { data: contiAttivi = [] } = useContiAttivi();

  const includedCount = useMemo(() => rows.length - excludedRows.size, [rows.length, excludedRows.size]);
  const allSelected = excludedRows.size === 0 && rows.length > 0;

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setRows([]);
    setExcludedRows(new Set());
    setImportResult(null);
    setImporting(false);
    setSelectedContoId("");
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const toggleRow = useCallback((index: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setExcludedRows(new Set(rows.map((_, i) => i)));
    } else {
      setExcludedRows(new Set());
    }
  }, [allSelected, rows]);

  const processFile = useCallback((file: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/vnd.ms-excel",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && ext !== "xlsx" && ext !== "csv") {
      toast({ title: "Formato non supportato", description: "Carica un file .xlsx o .csv", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        if (workbook.SheetNames.length === 0) {
          toast({ title: "File vuoto", description: "Il file non contiene fogli di lavoro", variant: "destructive" });
          return;
        }

        const result = parseWorkbook(workbook);

        if (typeof result === "string") {
          toast({ title: "Colonne non trovate", description: result, variant: "destructive" });
          return;
        }

        if (result.length === 0) {
          toast({ title: "Nessun dato", description: "Nessuna riga dati trovata dopo l'intestazione.", variant: "destructive" });
          return;
        }

        setRows(result);
        setFileName(file.name);
        setExcludedRows(new Set());
        setStep("preview");
      } catch {
        toast({ title: "Errore di lettura", description: "Il file potrebbe essere corrotto o in un formato non supportato", variant: "destructive" });
      }
    };
    reader.onerror = () => {
      toast({ title: "Errore", description: "Impossibile leggere il file", variant: "destructive" });
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

  const handleImport = async () => {
    if (!selectedContoId) return;
    setImporting(true);

    try {
      const categories = await ensureCategoriesMutation.mutateAsync();
      const parsed: ParsedTransaction[] = [];
      let skipped = 0;

      for (let i = 0; i < rows.length; i++) {
        if (excludedRows.has(i)) continue;
        const row = rows[i];
        if (!row.date || row.amount == null || row.amount === 0) {
          skipped++;
          continue;
        }
        parsed.push({ date: row.date, description: row.description, amount: row.amount });
      }

      if (parsed.length === 0) {
        toast({ title: "Nessuna riga valida", description: `${skipped} righe non importate.`, variant: "destructive" });
        setImporting(false);
        return;
      }

      const result = await importMutation.mutateAsync({ transactions: parsed, categories, contoId: selectedContoId });

      setImportResult({
        imported: result.imported,
        skipped: skipped + result.skipped,
        categoryId: result.classificationCategoryId,
      });
      setStep("result");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore durante l'importazione";
      toast({ title: "Errore di importazione", description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Importa Transazioni"}
            {step === "preview" && "Anteprima Importazione"}
            {step === "result" && "Importazione completata"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Carica un file Excel (.xlsx) o CSV per importare le transazioni."}
            {step === "preview" && `File: ${fileName} — ${rows.length} righe trovate`}
            {step === "result" && "Le transazioni sono state importate con successo."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium mb-1">Trascina un file qui o clicca per selezionarlo</p>
              <p className="text-sm text-muted-foreground">Formati supportati: .xlsx, .csv</p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileInput} />
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-6">
            {/* Conto destinazione */}
            <div className="space-y-2">
              <Label>Conto destinazione *</Label>
              <Select value={selectedContoId} onValueChange={setSelectedContoId}>
                <SelectTrigger>
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

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{includedCount} di {rows.length} righe selezionate</p>
            </div>

            <ScrollArea className="h-[300px] rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Seleziona tutto" />
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-xs">Data 📅</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">Descrizione 📝</TableHead>
                    <TableHead className="whitespace-nowrap text-xs text-right">Importo 💰</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const isExcluded = excludedRows.has(i);
                    const hasError = !row.date || row.amount == null || row.amount === 0;

                    return (
                      <TableRow key={i} className={isExcluded ? "opacity-40" : hasError ? "opacity-40 bg-destructive/5" : ""}>
                        <TableCell className="w-10">
                          <Checkbox checked={!isExcluded} onCheckedChange={() => toggleRow(i)} aria-label={`Riga ${i + 1}`} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.date ? format(new Date(row.date), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{row.description}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-right">
                          {row.amount != null ? (
                            <span className={row.amount >= 0 ? "text-green-600" : "text-red-600"}>
                              {row.amount >= 0 ? "+" : ""}{row.amount.toFixed(2)} €
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { reset(); setStep("upload"); }}>Indietro</Button>
              <Button onClick={handleImport} disabled={!selectedContoId || importing || includedCount === 0}>
                {importing ? "Importazione in corso..." : `Importa ${includedCount} righe`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && importResult && (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <div>
              <p className="text-lg font-semibold text-foreground">{importResult.imported} transazioni importate</p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <AlertCircle className="h-4 w-4" />
                  {importResult.skipped} righe saltate (dati non validi)
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">Tutte le transazioni hanno categoria "Da classificare".</p>
            </div>
            <DialogFooter className="justify-center gap-2 sm:justify-center">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Chiudi</Button>
              <Button onClick={() => { handleOpenChange(false); navigate(`/transactions?categoryId=${importResult.categoryId}`); }}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Vai a classificare
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
