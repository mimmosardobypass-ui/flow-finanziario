import { useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { parse, isValid, format } from "date-fns";
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  Search,
  AlertTriangle,
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

/* ── helpers ────────────────────────────────────────── */

interface MappingState {
  data: string;
  descrizione: string;
  importo: string;
  addebiti: string;
  accrediti: string;
}

const AUTO_MAP_KEYS: Partial<Record<keyof MappingState, string[]>> = {
  data: ["data", "date", "fecha", "datum", "data contabile"],
  descrizione: [
    "descrizione",
    "description",
    "desc",
    "causale",
    "nota",
    "note",
    "descrizione operazioni",
  ],
  importo: [
    "importo",
    "amount",
    "importo (eur)",
    "importo (euro)",
    "ammontare",
    "valore",
    "value",
  ],
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

/* ── component ──────────────────────────────────────── */

export default function ImportTransazioni() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<MappingState>({
    data: "",
    descrizione: "",
    importo: "",
    addebiti: "",
    accrediti: "",
  });
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [selectedContoId, setSelectedContoId] = useState("");
  const [searchText, setSearchText] = useState("");

  const ensureCategoriesMutation = useEnsureClassificationCategories();
  const importMutation = useImportTransactions();
  const { data: contiAttivi = [] } = useContiAttivi();

  /* ── derived data ── */

  const isSplitMode = useMemo(
    () => !mapping.importo && !!mapping.addebiti && !!mapping.accrediti,
    [mapping.importo, mapping.addebiti, mapping.accrediti]
  );

  const parsedRows = useMemo(() => {
    if (!mapping.data) return [];
    if (!isSplitMode && !mapping.importo) return [];
    if (isSplitMode && (!mapping.addebiti || !mapping.accrediti)) return [];

    return rows.map((row, i) => {
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

      const description = mapping.descrizione
        ? row[mapping.descrizione] != null
          ? String(row[mapping.descrizione]).trim()
          : ""
        : "";
      const hasError = !date || amount == null || amount === 0;
      return { index: i, date, amount, description, hasError, raw: row };
    });
  }, [rows, mapping, isSplitMode]);

  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return parsedRows;
    const q = searchText.toLowerCase();
    return parsedRows.filter((r) => r.description.toLowerCase().includes(q));
  }, [parsedRows, searchText]);

  // Exclude errored rows from selection
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

  const allSelected =
    selectableCount > 0 && includedCount === selectableCount;

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
      // deselect all selectable
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
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type) && ext !== "xlsx" && ext !== "csv") {
      toast({
        title: "Formato non supportato",
        description: "Carica un file .xlsx o .csv",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          toast({
            title: "File vuoto",
            description: "Il file non contiene fogli",
            variant: "destructive",
          });
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

        // Scan first 20 rows for a header row containing "Data Contabile"
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
          toast({
            title: "Nessun dato",
            description: "Il foglio non contiene righe",
            variant: "destructive",
          });
          return;
        }
        const cols = Object.keys(json[0]);
        setColumns(cols);
        setRows(json);
        setFileName(file.name);
        setExcludedRows(new Set());
        setSearchText("");

        // auto-map
        const autoMapping: MappingState = {
          data: "",
          descrizione: "",
          importo: "",
          addebiti: "",
          accrediti: "",
        };
        for (const [field, keywords] of Object.entries(AUTO_MAP_KEYS)) {
          const match = cols.find((c) =>
            keywords.includes(c.toLowerCase().trim())
          );
          if (match) autoMapping[field as keyof MappingState] = match;
        }
        setMapping(autoMapping);
      } catch {
        toast({
          title: "Errore di lettura",
          description: "File corrotto o formato non supportato",
          variant: "destructive",
        });
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

  const isMappingValid =
    mapping.data && mapping.descrizione && selectedContoId &&
    (mapping.importo || (mapping.addebiti && mapping.accrediti));

  const handleImport = async () => {
    if (!isMappingValid) return;
    setImporting(true);
    try {
      const categories = await ensureCategoriesMutation.mutateAsync();
      const parsed: ParsedTransaction[] = [];
      let skipped = 0;

      for (const r of parsedRows) {
        if (excludedRows.has(r.index) || r.hasError) {
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
        toast({
          title: "Nessuna riga valida",
          description: `${skipped} righe saltate.`,
          variant: "destructive",
        });
        setImporting(false);
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
      const msg =
        err instanceof Error ? err.message : "Errore durante l'importazione";
      toast({
        title: "Errore di importazione",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  /* ── render ── */

  const hasFile = rows.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── HEADER ── */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 space-y-3">
        {/* Top row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/transactions")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Transazioni
          </Button>

          <h1 className="text-lg font-bold text-foreground">
            Importa Transazioni
          </h1>

          {fileName && (
            <Badge variant="secondary" className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              {hasFile ? "Cambia file" : "Carica file"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </div>

        {/* Settings row — visible when file is loaded */}
        {hasFile && (
          <div className="flex items-end gap-4 flex-wrap">
            {/* Conto */}
            <div className="space-y-1 min-w-[180px]">
              <Label className="text-xs">Conto destinazione *</Label>
              <Select
                value={selectedContoId}
                onValueChange={setSelectedContoId}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleziona conto" />
                </SelectTrigger>
                <SelectContent>
                  {contiAttivi.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_conto}
                      {c.banca ? ` (${c.banca})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Column mapping */}
            {(isSplitMode
              ? (["data", "descrizione", "addebiti", "accrediti"] as const)
              : (["data", "descrizione", "importo"] as const)
            ).map((field) => (
              <div key={field} className="space-y-1 min-w-[150px]">
                <Label className="text-xs capitalize">{field} *</Label>
                <Select
                  value={mapping[field]}
                  onValueChange={(v) =>
                    setMapping((m) => ({ ...m, [field]: v }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Colonna" />
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

            {/* Search */}
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs">Cerca descrizione</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Filtra..."
                  className="h-8 text-sm pl-7"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs whitespace-nowrap pb-1">
              <span className="text-muted-foreground">
                {includedCount}/{rows.length} righe
              </span>
              <span className="text-success font-medium">
                +€
                {totals.income.toLocaleString("it-IT", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="text-destructive font-medium">
                -€
                {totals.expense.toLocaleString("it-IT", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto">
        {!hasFile ? (
          /* Upload area */
          <div className="flex items-center justify-center h-full p-8">
            <div
              className="border-2 border-dashed border-border rounded-lg p-16 text-center cursor-pointer hover:border-primary/50 transition-colors max-w-xl w-full"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium mb-1 text-lg">
                Trascina un file qui o clicca per selezionarlo
              </p>
              <p className="text-sm text-muted-foreground">
                Formati supportati: .xlsx, .csv
              </p>
            </div>
          </div>
        ) : (
          /* Preview table */
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Seleziona tutto"
                  />
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
                      {r.date
                        ? format(new Date(r.date), "dd/MM/yyyy")
                        : String(r.raw[mapping.data] ?? "")}
                    </TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {r.amount != null ? (
                        <span
                          className={
                            r.amount >= 0
                              ? "text-success"
                              : "text-destructive"
                          }
                        >
                          {r.amount >= 0 ? "+" : "-"}€
                          {Math.abs(r.amount).toLocaleString("it-IT", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        String(r.raw[mapping.importo] ?? "")
                      )}
                    </TableCell>
                    <TableCell>
                      {r.hasError && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
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
          <Button
            variant="outline"
            onClick={() => navigate("/transactions")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Annulla
          </Button>
          <Button
            onClick={handleImport}
            disabled={!isMappingValid || importing || includedCount === 0}
          >
            {importing
              ? "Importazione in corso..."
              : `Conferma Importazione (${includedCount} righe)`}
          </Button>
        </div>
      )}
    </div>
  );
}
