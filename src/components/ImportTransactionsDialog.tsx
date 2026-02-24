import { useState, useCallback, useRef } from "react";
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
import { toast } from "@/hooks/use-toast";
import {
  useEnsureClassificationCategories,
  useImportTransactions,
  ParsedTransaction,
} from "@/hooks/useImportTransactions";

type Step = "upload" | "mapping" | "result";

interface MappingState {
  data: string;
  descrizione: string;
  importo: string;
}

const AUTO_MAP_KEYS: Record<keyof MappingState, string[]> = {
  data: ["data", "date", "fecha", "datum"],
  descrizione: ["descrizione", "description", "desc", "causale", "nota", "note"],
  importo: ["importo", "amount", "importo (eur)", "ammontare", "valore", "value"],
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

  // Handle Excel serial date numbers
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

  // fallback: native Date
  const fallback = new Date(str);
  if (isValid(fallback) && fallback.getFullYear() > 1900) {
    return format(fallback, "yyyy-MM-dd");
  }

  return null;
}

function tryParseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  const str = String(raw).trim().replace(/[€$£\s]/g, "").replace(",", ".");
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
  const [mapping, setMapping] = useState<MappingState>({ data: "", descrizione: "", importo: "" });
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    categoryId: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const ensureCategoriesMutation = useEnsureClassificationCategories();
  const importMutation = useImportTransactions();

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setColumns([]);
    setRows([]);
    setMapping({ data: "", descrizione: "", importo: "" });
    setImportResult(null);
    setImporting(false);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

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
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]);
        if (json.length === 0) {
          toast({ title: "Nessun dato", description: "Il foglio non contiene righe di dati", variant: "destructive" });
          return;
        }
        const cols = Object.keys(json[0]);
        setColumns(cols);
        setRows(json);
        setFileName(file.name);

        // auto-map
        const autoMapping: MappingState = { data: "", descrizione: "", importo: "" };
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

  const isMappingValid = mapping.data && mapping.descrizione && mapping.importo;

  const handleImport = async () => {
    if (!isMappingValid) return;
    setImporting(true);

    try {
      const categories = await ensureCategoriesMutation.mutateAsync();

      const parsed: ParsedTransaction[] = [];
      let skipped = 0;

      for (const row of rows) {
        const date = tryParseDate(row[mapping.data]);
        const amount = tryParseAmount(row[mapping.importo]);
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

      const result = await importMutation.mutateAsync({ transactions: parsed, categories });

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

  const previewRows = rows.slice(0, 5);

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
              {(["data", "descrizione", "importo"] as const).map((field) => (
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

            {/* Preview table */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Anteprima (prime {previewRows.length} righe)
              </p>
              <div className="rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((col) => (
                          <TableCell key={col} className="whitespace-nowrap text-xs">
                            {row[col] != null ? String(row[col]) : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { reset(); setStep("upload"); }}>
                Indietro
              </Button>
              <Button onClick={handleImport} disabled={!isMappingValid || importing}>
                {importing ? "Importazione in corso..." : `Importa ${rows.length} righe`}
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
