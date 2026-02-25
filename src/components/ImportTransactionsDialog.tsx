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

type Step = "upload" | "mapping" | "result";

interface MappingState {
  data: string;
  descrizione: string;
  importo: string;
  addebiti: string;
  accrediti: string;
}

const AUTO_MAP_KEYS: Partial<Record<keyof MappingState, string[]>> = {
  data: ["data", "date", "fecha", "datum", "data contabile"],
  descrizione: ["descrizione", "description", "desc", "causale", "nota", "note", "descrizione operazioni"],
  importo: ["importo", "amount", "importo (eur)", "importo (euro)", "ammontare", "valore", "value"],
  addebiti: ["addebiti", "addebiti (euro)", "dare"],
  accrediti: ["accrediti", "accrediti (euro)", "avere"],
};

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
  // Italian format: 1.234,56 → remove thousand dots, then swap decimal comma
  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
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
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<MappingState>({ data: "", descrizione: "", importo: "", addebiti: "", accrediti: "" });
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
    setColumns([]);
    setRows([]);
    setMapping({ data: "", descrizione: "", importo: "", addebiti: "", accrediti: "" });
    setExcludedRows(new Set());
    setImportResult(null);
    setImporting(false);
    setSelectedContoId("");
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
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
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          toast({ title: "File vuoto", description: "Il file non contiene fogli di lavoro", variant: "destructive" });
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

        let headerRowIndex = -1;
        const scanLimit = Math.min(rawRows.length, 20);
        for (let i = 0; i < scanLimit; i++) {
          const row = rawRows[i];
          if (
            Array.isArray(row) &&
            row.some(
              (cell) =>
                typeof cell === "string" &&
                cell.toLowerCase().includes("data contabile")
            )
          ) {
            headerRowIndex = i;
            break;
          }
        }

        const json: Record<string, unknown>[] =
          headerRowIndex >= 0
            ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerRowIndex })
            : XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (json.length === 0) {
          toast({ title: "Nessun dato", description: "Il foglio non contiene righe di dati", variant: "destructive" });
          return;
        }
        const cols = Object.keys(json[0]);
        setColumns(cols);
        setRows(json);
        setFileName(file.name);
        setExcludedRows(new Set());

        // auto-map
        const autoMapping: MappingState = { data: "", descrizione: "", importo: "", addebiti: "", accrediti: "" };
        for (const [field, keywords] of Object.entries(AUTO_MAP_KEYS)) {
          const match = cols.find((c) => keywords.includes(c.toLowerCase().trim()));
          if (match) autoMapping[field as keyof MappingState] = match;
        }
        setMapping(autoMapping);
        setStep("mapping");
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

  const isSplitMode = !mapping.importo && !!mapping.addebiti && !!mapping.accrediti;

  const isMappingValid = mapping.data && mapping.descrizione && selectedContoId &&
    (mapping.importo || (mapping.addebiti && mapping.accrediti));

  const handleImport = async () => {
    if (!isMappingValid) return;
    setImporting(true);

    try {
      const categories = await ensureCategoriesMutation.mutateAsync();

      const parsed: ParsedTransaction[] = [];
      let skipped = 0;

      for (let i = 0; i < rows.length; i++) {
        if (excludedRows.has(i)) continue;

        const row = rows[i];
        const date = tryParseDate(row[mapping.data]);
        let amount: number | null = null;
        if (isSplitMode) {
          const addebito = tryParseAmount(row[mapping.addebiti]);
          const accredito = tryParseAmount(row[mapping.accrediti]);
          if (addebito != null && addebito !== 0) {
            amount = -Math.abs(addebito);
          } else if (accredito != null && accredito !== 0) {
            amount = Math.abs(accredito);
          }
        } else {
          amount = tryParseAmount(row[mapping.importo]);
        }
        const description = row[mapping.descrizione] != null ? String(row[mapping.descrizione]).trim() : "";

        if (!date || amount == null || amount === 0) {
          skipped++;
          continue;
        }
        parsed.push({ date, description, amount });
      }

      if (parsed.length === 0) {
        toast({
          title: "Nessuna riga valida",
          description: `${skipped} righe non sono state importate perché contengono dati non validi.`,
          variant: "destructive",
        });
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
            {step === "mapping" && "Mappa le colonne"}
            {step === "result" && "Importazione completata"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Carica un file Excel (.xlsx) o CSV per importare le transazioni."}
            {step === "mapping" && `File: ${fileName} — ${rows.length} righe trovate`}
            {step === "result" && "Le transazioni sono state importate con successo."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div
            className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">
              Trascina un file qui o clicca per selezionarlo
            </p>
            <p className="text-sm text-muted-foreground">
              Formati supportati: .xlsx, .csv
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <div className="space-y-6">
            {/* Column mapping */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(isSplitMode
                ? (["data", "descrizione", "addebiti", "accrediti"] as const)
                : (["data", "descrizione", "importo"] as const)
              ).map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field} *</Label>
                  <Select
                    value={mapping[field]}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona colonna" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

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

            {/* Row counter */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {includedCount} di {rows.length} righe selezionate
              </p>
            </div>

            {/* Preview table with checkboxes */}
            <ScrollArea className="h-[300px] rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Seleziona tutto"
                      />
                    </TableHead>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap text-xs">
                        {col}
                        {col === mapping.data && " 📅"}
                        {col === mapping.descrizione && " 📝"}
                        {col === mapping.importo && " 💰"}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const isExcluded = excludedRows.has(i);

                    return (
                      <TableRow
                        key={i}
                        className={isExcluded ? "opacity-40" : ""}
                      >
                        <TableCell className="w-10">
                          <Checkbox
                            checked={!isExcluded}
                            onCheckedChange={() => toggleRow(i)}
                            aria-label={`Riga ${i + 1}`}
                          />
                        </TableCell>
                        {columns.map((col) => {
                          const raw = row[col] != null ? String(row[col]) : "";

                          // Show interpreted values for mapped columns
                          if (col === mapping.importo && !isExcluded) {
                            const amt = tryParseAmount(row[col]);
                            return (
                              <TableCell key={col} className="whitespace-nowrap text-xs">
                                <span className={amt != null ? (amt >= 0 ? "text-green-600" : "text-red-600") : ""}>
                                  {amt != null ? `${amt >= 0 ? "+" : ""}${amt.toFixed(2)} €` : raw}
                                </span>
                              </TableCell>
                            );
                          }

                          if (col === mapping.data && !isExcluded) {
                            const parsed = tryParseDate(row[col]);
                            return (
                              <TableCell key={col} className="whitespace-nowrap text-xs">
                                {parsed ? format(new Date(parsed), "dd/MM/yyyy") : raw}
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell key={col} className="whitespace-nowrap text-xs">
                              {raw}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { reset(); setStep("upload"); }}>
                Indietro
              </Button>
              <Button onClick={handleImport} disabled={!isMappingValid || importing || includedCount === 0}>
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
              <p className="text-lg font-semibold text-foreground">
                {importResult.imported} transazioni importate
              </p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <AlertCircle className="h-4 w-4" />
                  {importResult.skipped} righe saltate (dati non validi)
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Tutte le transazioni hanno categoria "Da classificare".
              </p>
            </div>
            <DialogFooter className="justify-center gap-2 sm:justify-center">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Chiudi
              </Button>
              <Button
                onClick={() => {
                  handleOpenChange(false);
                  navigate(`/transactions?categoryId=${importResult.categoryId}`);
                }}
              >
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
