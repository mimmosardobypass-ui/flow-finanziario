import { Fragment, useMemo, useState } from "react";
import { AlertTriangle, Banknote, ChevronDown, ChevronRight, MoreHorizontal, Scale, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PagaContantiDialog } from "@/components/fatture/PagaContantiDialog";
import { CompensaDialog } from "@/components/fatture/CompensaDialog";
import {
  DocumentoSaldo,
  FatturaWithRel,
  NotaCreditoCompensabile,
  useAnnullaCompensazione,
  useDocumentiSaldi,
  useDocumentoPagamenti,
  useDissociaDocumento,
  useFindNoteCreditoCompensabili,
} from "@/hooks/useFattureFornitori";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("it-IT") : "—");

type StatoKey = "da_pagare" | "scaduta" | "parziale" | "pagata" | "compensare" | "compensata";

const STATI: { key: StatoKey; label: string; color: string }[] = [
  { key: "da_pagare", label: "Da pagare", color: "#98a2b3" },
  { key: "scaduta", label: "Scaduta", color: "#f04438" },
  { key: "parziale", label: "Parziale", color: "#2563eb" },
  { key: "pagata", label: "Pagata", color: "#12b76a" },
  { key: "compensare", label: "Da compensare", color: "#7c3aed" },
  { key: "compensata", label: "Compensata", color: "#7c3aed" },
];

const TIPI = ["Fattura", "Nota Credito", "Ricevuta"] as const;
const TIPO_LABEL: Record<string, string> = {
  Fattura: "Fattura",
  "Nota Credito": "Nota di credito",
  Ricevuta: "Ricevuta",
};

function statoOf(d: DocumentoSaldo): StatoKey {
  if (d.stato_pagamento === "compensata") return "compensata";
  if (d.stato_pagamento === "nota_credito") return "compensare";
  if (d.residuo <= 0.005) return "pagata";
  if (d.stato_pagamento === "parziale" || d.imputato > 0.005) return "parziale";
  if ((d.giorni_scaduta ?? 0) > 0) return "scaduta";
  return "da_pagare";
}


function StatoBadge({ k }: { k: StatoKey }) {
  const s = STATI.find((x) => x.key === k)!;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${s.color}1a`, color: s.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

const activeBtn = {
  borderColor: "#c7d7fe",
  backgroundColor: "#eff4ff",
  color: "#1e40af",
  fontWeight: 600,
};

function FilterButton({
  label, active, children,
}: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" style={active ? activeBtn : undefined}>
          {label}
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs">
      {text}
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

interface Periodo {
  campo: "documento" | "scadenza";
  dal: string;
  al: string;
}
const PERIODO_VUOTO: Periodo = { campo: "documento", dal: "", al: "" };

const ANNI = [2026, 2025, 2024, 2023, 2022];

export function RicevuteTab({
  fatture, onSelect, anno, setAnno, search, setSearch,
}: {
  fatture: FatturaWithRel[];
  onSelect: (f: FatturaWithRel) => void;
  anno: number | "all";
  setAnno: (v: number | "all") => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const { data: docs = [], isLoading } = useDocumentiSaldi("passiva");
  const byId = useMemo(() => new Map(fatture.map((f) => [f.id, f])), [fatture]);

  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_VUOTO);
  const [periodoDraft, setPeriodoDraft] = useState<Periodo>(PERIODO_VUOTO);
  const [stati, setStati] = useState<StatoKey[]>([]);
  const [tipi, setTipi] = useState<string[]>([]);
  const [importoDa, setImportoDa] = useState("");
  const [importoA, setImportoA] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pagaDocs, setPagaDocs] = useState<DocumentoSaldo[] | null>(null);

  const periodoAttivo = !!(periodo.dal || periodo.al);
  const importoAttivo = !!(importoDa || importoA);

  const conteggiStato = useMemo(() => {
    const m: Record<StatoKey, number> = { da_pagare: 0, scaduta: 0, parziale: 0, pagata: 0, compensare: 0 };
    docs.forEach((d) => { m[statoOf(d)]++; });
    return m;
  }, [docs]);

  const conteggiTipo = useMemo(() => {
    const m: Record<string, number> = {};
    docs.forEach((d) => { m[d.tipo] = (m[d.tipo] ?? 0) + 1; });
    return m;
  }, [docs]);

  const filtrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    const da = importoDa ? Number(importoDa) : null;
    const a = importoA ? Number(importoA) : null;
    return docs.filter((d) => {
      if (q) {
        const hay = `${d.controparte ?? ""} ${d.numero_documento ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (anno !== "all") {
        if (!d.data_documento || Number(d.data_documento.slice(0, 4)) !== anno) return false;
      }
      if (periodoAttivo) {
        const val = periodo.campo === "documento" ? d.data_documento : d.data_scadenza;
        if (!val) return false;
        if (periodo.dal && val < periodo.dal) return false;
        if (periodo.al && val > periodo.al) return false;
      }
      if (stati.length && !stati.includes(statoOf(d))) return false;
      if (tipi.length && !tipi.includes(d.tipo)) return false;
      if (da !== null && d.totale < da) return false;
      if (a !== null && d.totale > a) return false;
      return true;
    });
  }, [docs, search, anno, periodo, periodoAttivo, stati, tipi, importoDa, importoA]);

  const totale = filtrati.reduce((s, d) => s + d.totale, 0);
  const residuo = filtrati
    .filter((d) => d.tipo !== "Nota Credito")
    .reduce((s, d) => s + Math.max(0, d.residuo), 0);

  const pagabile = (d: DocumentoSaldo) => d.tipo !== "Nota Credito" && d.residuo > 0.005;
  const pagabiliSelezionati = filtrati.filter((d) => sel.has(d.id) && pagabile(d));


  const azzeraTutti = () => {
    setSearch(""); setPeriodo(PERIODO_VUOTO); setPeriodoDraft(PERIODO_VUOTO); setAnno("all");
    setStati([]); setTipi([]); setImportoDa(""); setImportoA("");
  };

  const scorciatoia = (dal: string, al: string) =>
    setPeriodoDraft((p) => ({ ...p, dal, al }));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const oggi = new Date();

  const toggleSel = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const esportaSelezione = () => {
    const righe = filtrati.filter((d) => sel.has(d.id));
    const head = ["Numero", "Tipo", "Fornitore", "Data documento", "Scadenza", "Totale", "Residuo", "Stato"];
    const body = righe.map((d) => [
      d.numero_documento ?? "", d.tipo, d.controparte ?? "",
      fmtDate(d.data_documento), fmtDate(d.data_scadenza),
      d.totale.toFixed(2), d.residuo.toFixed(2),
      STATI.find((s) => s.key === statoOf(d))!.label,
    ]);
    const csv = [head, ...body].map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "documenti-selezionati.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const chips: { text: string; clear: () => void }[] = [];
  if (search.trim()) chips.push({ text: `Ricerca: "${search.trim()}"`, clear: () => setSearch("") });
  if (anno !== "all") chips.push({ text: `Anno: ${anno}`, clear: () => setAnno("all") });
  if (periodoAttivo)
    chips.push({
      text: `${periodo.campo === "documento" ? "Data documento" : "Data scadenza"}: ${
        periodo.dal ? fmtDate(periodo.dal) : "inizio"} → ${periodo.al ? fmtDate(periodo.al) : "oggi"}`,
      clear: () => { setPeriodo(PERIODO_VUOTO); setPeriodoDraft(PERIODO_VUOTO); },
    });
  if (stati.length)
    chips.push({
      text: `Stato: ${stati.map((s) => STATI.find((x) => x.key === s)!.label).join(", ")}`,
      clear: () => setStati([]),
    });
  if (importoAttivo)
    chips.push({
      text: `Importo: ${importoDa ? fmtEur(Number(importoDa)) : "0 €"} → ${importoA ? fmtEur(Number(importoA)) : "senza limite"}`,
      clear: () => { setImportoDa(""); setImportoA(""); },
    });
  if (tipi.length)
    chips.push({
      text: `Tipo documento: ${tipi.map((t) => TIPO_LABEL[t] ?? t).join(", ")}`,
      clear: () => setTipi([]),
    });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Barra filtri */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca fornitore o numero documento"
            className="h-9 w-[260px]"
          />

          <Select
            value={anno === "all" ? "all" : String(anno)}
            onValueChange={(v) => setAnno(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli anni</SelectItem>
              {ANNI.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <FilterButton label="Periodo" active={periodoAttivo}>
            <div className="inline-flex w-full rounded-md border bg-muted/40 p-1">
              {(["documento", "scadenza"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPeriodoDraft((p) => ({ ...p, campo: c }))}
                  className={`flex-1 rounded-sm px-2 py-1 text-xs transition-colors ${
                    periodoDraft.campo === c
                      ? "bg-background font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "documento" ? "Data documento" : "Data scadenza"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Dal</Label>
                <Input type="date" value={periodoDraft.dal}
                  onChange={(e) => setPeriodoDraft((p) => ({ ...p, dal: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Al</Label>
                <Input type="date" value={periodoDraft.al}
                  onChange={(e) => setPeriodoDraft((p) => ({ ...p, al: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() =>
                scorciatoia(iso(new Date(Date.now() - 30 * 86400000)), iso(oggi))}>
                Ultimi 30 giorni
              </Button>
              <Button variant="outline" size="sm" onClick={() =>
                scorciatoia(iso(new Date(Date.now() - 90 * 86400000)), iso(oggi))}>
                Ultimi 3 mesi
              </Button>
              <Button variant="outline" size="sm" onClick={() => scorciatoia("2026-01-01", "2026-12-31")}>2026</Button>
              <Button variant="outline" size="sm" onClick={() => scorciatoia("2025-01-01", "2025-12-31")}>2025</Button>
            </div>
            <div className="flex gap-2 border-t pt-2">
              <Button variant="ghost" size="sm" className="flex-1"
                onClick={() => { setPeriodoDraft(PERIODO_VUOTO); setPeriodo(PERIODO_VUOTO); }}>
                Azzera
              </Button>
              <Button size="sm" className="flex-1" onClick={() => {
                setPeriodo(periodoDraft);
                if (periodoDraft.dal || periodoDraft.al) setAnno("all");
              }}>Applica</Button>
            </div>
          </FilterButton>

          <FilterButton label="Stato" active={stati.length > 0}>
            <div className="space-y-1">
              {STATI.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60">
                  <Checkbox
                    checked={stati.includes(s.key)}
                    onCheckedChange={() =>
                      setStati((prev) => prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key])
                    }
                  />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-sm">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{conteggiStato[s.key]}</span>
                </label>
              ))}
            </div>
          </FilterButton>

          <FilterButton label="Importo" active={importoAttivo}>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Da €</Label>
                <Input type="number" step="0.01" value={importoDa} onChange={(e) => setImportoDa(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">A €</Label>
                <Input type="number" step="0.01" value={importoA} onChange={(e) => setImportoA(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setImportoDa(""); setImportoA("50"); }}>fino a 50 €</Button>
              <Button variant="outline" size="sm" onClick={() => { setImportoDa("50"); setImportoA("200"); }}>50–200 €</Button>
              <Button variant="outline" size="sm" onClick={() => { setImportoDa("200"); setImportoA(""); }}>oltre 200 €</Button>
            </div>
          </FilterButton>

          <FilterButton label="Tipo documento" active={tipi.length > 0}>
            <div className="space-y-1">
              {TIPI.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60">
                  <Checkbox
                    checked={tipi.includes(t)}
                    onCheckedChange={() =>
                      setTipi((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
                    }
                  />
                  <span className="flex-1 text-sm">{TIPO_LABEL[t]}</span>
                  <span className="text-xs text-muted-foreground">{conteggiTipo[t] ?? 0}</span>
                </label>
              ))}
            </div>
          </FilterButton>
        </div>

        {/* Chip filtri attivi */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => <Chip key={c.text} text={c.text} onRemove={c.clear} />)}
            <button type="button" onClick={azzeraTutti} className="text-xs text-primary underline">
              azzera tutti i filtri
            </button>
          </div>
        )}

        {/* Riepilogo */}
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{filtrati.length}</span> document{filtrati.length === 1 ? "o" : "i"} su {docs.length}
          {" · "}totale <span className="font-medium">{fmtEur(totale)}</span>
          {" · "}ancora da pagare <span className="font-medium">{fmtEur(residuo)}</span>
        </div>

        {/* Barra selezione */}
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-50">
            <span className="font-medium">{sel.size} document{sel.size === 1 ? "o" : "i"} selezionat{sel.size === 1 ? "o" : "i"}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary">Assegna categoria</Button>
              <Button size="sm" variant="secondary">Associa a un pagamento</Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pagabiliSelezionati.length === 0}
                onClick={() => setPagaDocs(pagabiliSelezionati)}
              >
                <Banknote className="h-4 w-4" /> Paga in contanti
              </Button>
              <Button size="sm" variant="secondary" onClick={esportaSelezione}>Esporta selezione</Button>
              <button type="button" onClick={() => setSel(new Set())} className="text-slate-300 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px]" />
                <TableHead className="w-[36px]" />
                <TableHead>Documento</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead className="whitespace-nowrap">Data documento</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="text-right">Residuo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-[44px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Caricamento…</TableCell></TableRow>
              )}
              {!isLoading && filtrati.length === 0 && (
                <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Nessun documento con i filtri attivi</TableCell></TableRow>
              )}
              {filtrati.map((d) => {
                const f = byId.get(d.id);
                const netto = f?.imponibile;
                const scaduta = (d.giorni_scaduta ?? 0) > 0 && d.residuo > 0.005;
                return (
                  <Fragment key={d.id}>
                    <TableRow>
                      <TableCell className="align-top">
                        <button type="button" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                          {expanded === d.id
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="align-top">
                        <Checkbox checked={sel.has(d.id)} onCheckedChange={() => toggleSel(d.id)} />
                      </TableCell>
                      <TableCell
                        className="cursor-pointer align-top"
                        onClick={() => f && onSelect(f)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{d.numero_documento ?? "—"}</span>
                          {d.sdi_mancante && (
                            <span
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium"
                              style={{ backgroundColor: "#fffaeb", borderColor: "#fde3a7", color: "#b54708" }}
                            >
                              <AlertTriangle className="h-3 w-3" /> manca da SdI
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {TIPO_LABEL[d.tipo] ?? d.tipo} · del {fmtDate(d.data_documento)}
                        </div>
                      </TableCell>
                      <TableCell className="align-top font-medium">{d.controparte ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap align-top">{fmtDate(d.data_documento)}</TableCell>
                      <TableCell className="align-top">
                        <div>{fmtDate(d.data_scadenza)}</div>
                        {scaduta && (
                          <div className="text-xs font-medium" style={{ color: "#f04438" }}>
                            scaduta da {d.giorni_scaduta} gg
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="font-semibold">{fmtEur(d.totale)}</div>
                        <div className="text-xs text-muted-foreground">
                          {netto === null || netto === undefined ? "netto non disponibile" : `netto ${fmtEur(Number(netto))}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {Math.abs(d.residuo) < 0.005 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className="font-semibold"
                            style={{ color: d.tipo === "Nota Credito" ? "#7c3aed" : undefined }}
                          >
                            {fmtEur(d.residuo)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top"><StatoBadge k={statoOf(d)} /></TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {f?.category?.name ?? "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {f && (
                              <DropdownMenuItem onClick={() => onSelect(f)}>
                                Apri dettaglio documento
                              </DropdownMenuItem>
                            )}
                            {pagabile(d) && (
                              <DropdownMenuItem onClick={() => setPagaDocs([d])}>
                                <Banknote className="h-4 w-4" /> Registra pagamento in contanti
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expanded === d.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={11} className="bg-muted/30 p-0">
                          <PagamentiCollegati doc={d} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pagaDocs && pagaDocs.length > 0 && (
          <PagaContantiDialog
            docs={pagaDocs}
            onClose={() => { setPagaDocs(null); setSel(new Set()); }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PagamentiCollegati({ doc }: { doc: DocumentoSaldo }) {
  const { data: pagamenti = [], isLoading } = useDocumentoPagamenti(doc.id);
  const dissocia = useDissociaDocumento();

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="text-sm font-semibold">Pagamenti collegati</div>
      {isLoading && <div className="text-sm text-muted-foreground">Caricamento…</div>}
      {!isLoading && pagamenti.length === 0 && (
        <div className="text-sm text-muted-foreground">Nessun movimento collegato a questo documento</div>
      )}
      {pagamenti.map((p) => (
        <div key={p.transaction_id} className="flex flex-wrap items-center gap-3 border-b py-1.5 text-sm last:border-b-0">
          <span className="whitespace-nowrap">{fmtDate(p.data_movimento)}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-[160px] flex-1 truncate text-muted-foreground">
                {p.descrizione_movimento ?? "—"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">{p.descrizione_movimento ?? "—"}</TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground">{p.conto ?? "—"}</span>
          <span className="font-semibold">{fmtEur(p.importo_imputato)}</span>
          <button
            type="button"
            className="text-xs text-primary underline disabled:opacity-50"
            disabled={dissocia.isPending}
            onClick={() => dissocia.mutate({ fattura_id: doc.id, transaction_id: p.transaction_id })}
          >
            stacca
          </button>
        </div>
      ))}
      {doc.residuo > 0.005 && (
        <div className="flex items-center justify-between pt-1 text-sm">
          <span className="text-muted-foreground">Residuo da coprire</span>
          <span className="font-semibold" style={{ color: "#f04438" }}>{fmtEur(doc.residuo)}</span>
        </div>
      )}
    </div>
  );
}
