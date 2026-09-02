import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Upload, Plus, Link2, Trash2, Pencil, Download, AlertTriangle, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useFattureFornitori, useFattureStats, useDeleteFattura,
  useUpdateFattura, useCreateFattura, useImportFattureExcel,
  useCollegaTransazione, FatturaWithRel,
  useFattureSdiMancanti, ORIGINE_LABELS,
  usePagamentiFatture, useCollegaPagamentiFatture, PagamentoProposta,
  useDocumentiSaldi, DocumentoSaldo, useDatePagamentoDocumenti,

} from "@/hooks/useFattureFornitori";
import {
  useFornitori, useCreateFornitore, useUpdateFornitore, useDeleteFornitore, Fornitore,
} from "@/hooks/useFornitori";
import { useCategories, useCreateCategory } from "@/hooks/useCategories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

import { useTransactions } from "@/hooks/useTransactions";
import { RicevuteTab } from "@/components/fatture/RicevuteTab";
import { SituazioneTab } from "@/components/fatture/SituazioneTab";

function EmesseTab() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Nessuna fattura emessa nel registro</p>
      </CardContent>
    </Card>
  );
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("it-IT") : "—";

const MESI = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

const giorniAttesa = (d: string | null) => {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
};

const LIVELLO_COLORS: Record<string, string> = {
  "in attesa": "#12b76a",
  "da sollecitare": "#f79009",
  critico: "#f04438",
};

function StatoBadge({ stato }: { stato: string }) {
  if (stato === "pagata") return <Badge className="bg-green-600 hover:bg-green-600">Pagata</Badge>;
  if (stato === "nota_credito") return <Badge variant="secondary">Nota credito</Badge>;
  return <Badge className="bg-red-600 hover:bg-red-600">Da pagare</Badge>;
}

function SdiMancanteBadge({ fattura }: { fattura: FatturaWithRel }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
          style={{ backgroundColor: "#fffaeb", borderColor: "#fde3a7", color: "#b54708" }}
        >
          <AlertTriangle className="h-3 w-3" />
          Manca da SdI
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1 text-xs">
          <div><span className="font-semibold">Origine:</span> {ORIGINE_LABELS[fattura.origine] ?? fattura.origine ?? "—"}</div>
          <div><span className="font-semibold">In attesa da:</span> {giorniAttesa(fattura.data_documento)} giorni</div>
          <div><span className="font-semibold">Note:</span> {fattura.note?.trim() ? fattura.note : "nessuna nota"}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function SdiMancantiCard({ search = "" }: { search?: string }) {
  const { data: allRows = [] } = useFattureSdiMancanti();
  const q = search.trim().toLowerCase();
  const rows = q
    ? allRows.filter((r) =>
        `${r.mittente ?? ""} ${r.numero_documento ?? ""}`.toLowerCase().includes(q)
      )
    : allRows;
  if (rows.length === 0) return null;

  const totale = rows.reduce((s, r) => s + Number(r.totale ?? 0), 0);
  const oltre90 = rows.filter((r) => Number(r.giorni_attesa ?? 0) > 90).length;
  const daSollecitare = rows.filter((r) => r.livello === "da sollecitare").length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 py-3" style={{ backgroundColor: "#fffaeb" }}>
        <AlertTriangle className="h-5 w-5" style={{ color: "#b54708" }} />
        <CardTitle className="text-base" style={{ color: "#b54708" }}>
          Documenti non pervenuti via SdI
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Documenti</div>
            <div className="text-2xl font-bold">{rows.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Totale</div>
            <div className="text-2xl font-bold">{fmtEur(totale)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Oltre 90 giorni</div>
            <div className="text-2xl font-bold" style={{ color: "#f04438" }}>{oltre90}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Da sollecitare</div>
            <div className="text-2xl font-bold" style={{ color: "#f79009" }}>{daSollecitare}</div>
          </div>
        </div>

        <div className="divide-y border-t">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: LIVELLO_COLORS[r.livello ?? ""] ?? "#98a2b3" }}
              />
              <span className="font-medium flex-1 min-w-[140px]">{r.mittente ?? "—"}</span>
              <span className="text-muted-foreground">{r.numero_documento ?? "—"}</span>
              <span className="text-muted-foreground">{fmtDate(r.data_documento)}</span>
              {r.stato_pagamento === "compensata" && (
                <span
                  className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: "#f5f3ff", color: "#7c3aed" }}
                >
                  Compensata
                </span>
              )}
              <span className="font-semibold">{fmtEur(Number(r.totale ?? 0))}</span>
              <span className="text-muted-foreground">{Number(r.giorni_attesa ?? 0)} gg</span>

            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
          {(["in attesa", "da sollecitare", "critico"] as const).map((l) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LIVELLO_COLORS[l] }} />
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OrigineFields({
  origine, setOrigine, sdiMancante, setSdiMancante, identificativoSdi, setIdentificativoSdi,
}: {
  origine: string;
  setOrigine: (v: string) => void;
  sdiMancante: boolean;
  setSdiMancante: (v: boolean) => void;
  identificativoSdi: string;
  setIdentificativoSdi: (v: string) => void;
}) {
  const sdiObbligatorio = origine === "sdi";
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Origine documento</Label>
        <Select value={origine} onValueChange={setOrigine}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(ORIGINE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>
          Identificativo SdI{" "}
          {!sdiObbligatorio && <span className="text-xs font-normal text-muted-foreground">(facoltativo)</span>}
        </Label>
        <Input
          value={identificativoSdi}
          onChange={(e) => setIdentificativoSdi(e.target.value)}
          placeholder={sdiObbligatorio ? "Identificativo SdI" : "Non necessario"}
        />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <Label className="cursor-pointer">Non ancora ricevuta via SdI</Label>
        <Switch checked={sdiMancante} onCheckedChange={setSdiMancante} />
      </div>
    </div>
  );
}

const troncaDesc = (s: string | null) => {
  const t = (s ?? "").trim();
  return t.length > 60 ? `${t.slice(0, 60)}…` : t || "—";
};

const fmtGiorni = (g: number | null) => {
  const n = Number(g ?? 0);
  return n < 0 ? `−${Math.abs(n)} gg` : `+${n} gg`;
};

function ConfidenzaBadge({ c }: { c: string | null }) {
  if (c === "alta") return <Badge className="bg-green-600 hover:bg-green-600">Alta</Badge>;
  if (c === "media")
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Media</Badge>
    );
  return <Badge variant="secondary">Bassa</Badge>;
}

function motivoProposta(p: PagamentoProposta): string | null {
  const g = Number(p.giorni ?? 0);
  const scarto = Number(p.scarto ?? 0);
  const cand = Number(p.candidati ?? 0);
  if (g < 0) return "pagata prima della fattura";
  if (g > 30) return `pagata dopo ${g} giorni`;
  if (scarto > 0) return `scarto di ${Math.round(scarto * 100)} centesimi`;
  if (cand > 1) return `${cand} movimenti possibili`;
  return null;
}

const keyOf = (p: PagamentoProposta) => `${p.fattura_id}|${p.transaction_id}`;

function PagamentiDaAbbinareCard({ search = "" }: { search?: string }) {
  const { data: allProposte = [] } = usePagamentiFatture();
  const collegaMut = useCollegaPagamentiFatture();
  const [open, setOpen] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const q = search.trim().toLowerCase();
  const proposte = useMemo(
    () =>
      q
        ? allProposte.filter((p) =>
            `${p.mittente ?? ""} ${p.numero_documento ?? ""}`.toLowerCase().includes(q)
          )
        : allProposte,
    [allProposte, q]
  );

  useEffect(() => {
    setSel(new Set(proposte.filter((p) => p.confidenza === "alta").map(keyOf)));
  }, [proposte]);

  if (proposte.length === 0) return null;

  const totale = proposte.reduce((s, p) => s + Number(p.totale ?? 0), 0);
  const selected = proposte.filter((p) => sel.has(keyOf(p)));

  const toggle = (p: PagamentoProposta) => {
    setSel((prev) => {
      const n = new Set(prev);
      const k = keyOf(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const handleConferma = async () => {
    if (selected.length === 0) return;
    await collegaMut.mutateAsync(
      selected.map((p) => ({ fattura_id: p.fattura_id, transaction_id: p.transaction_id }))
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 text-left"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Link2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Pagamenti da abbinare</CardTitle>
          <span className="ml-auto text-sm text-muted-foreground">
            {proposte.length} {proposte.length === 1 ? "proposta" : "proposte"} · {fmtEur(totale)}
          </span>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSel(new Set(proposte.map(keyOf)))}>
              Seleziona tutte
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSel(new Set(proposte.filter((p) => p.confidenza === "alta").map(keyOf)))}
            >
              Solo alta confidenza
            </Button>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Data fattura</TableHead>
                  <TableHead className="text-right">Importo fattura</TableHead>
                  <TableHead>Data mov.</TableHead>
                  <TableHead className="text-right">Importo mov.</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Scost.</TableHead>
                  <TableHead>Confidenza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposte.map((p) => {
                  const motivo = p.confidenza === "alta" ? null : motivoProposta(p);
                  return (
                    <TableRow key={keyOf(p)}>
                      <TableCell>
                        <Checkbox checked={sel.has(keyOf(p))} onCheckedChange={() => toggle(p)} />
                      </TableCell>
                      <TableCell className="font-medium">{p.mittente ?? "—"}</TableCell>
                      <TableCell>{p.numero_documento ?? "—"}</TableCell>
                      <TableCell>{fmtDate(p.data_documento)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtEur(Number(p.totale ?? 0))}</TableCell>
                      <TableCell>{fmtDate(p.data_pagamento)}</TableCell>
                      <TableCell className="text-right">{fmtEur(Number(p.importo_pagamento ?? 0))}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground">{troncaDesc(p.descrizione)}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">{p.descrizione ?? "—"}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtGiorni(p.giorni)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <ConfidenzaBadge c={p.confidenza} />
                          {motivo && <span className="text-[11px] text-muted-foreground">{motivo}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleConferma} disabled={selected.length === 0 || collegaMut.isPending}>
              {collegaMut.isPending
                ? "Collegamento..."
                : `Conferma abbinamenti selezionati (${selected.length})`}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}


export default function FattureFornitori() {
  const [stato, setStato] = useState("all");
  const [fornitoreId, setFornitoreId] = useState("all");
  const now = new Date();
  const [anno, setAnno] = useState<number | "all">("all");
  const [annoReport, setAnnoReport] = useState<number>(now.getFullYear());
  const [mese, setMese] = useState<number | "all">("all");
  const [selFattura, setSelFattura] = useState<FatturaWithRel | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [sdiFilter, setSdiFilter] = useState<"all" | "solo_sdi" | "attesa">("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("situazione");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docsPassivi = [] } = useDocumentiSaldi("passiva");
  const trovati = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docsPassivi.length;
    return docsPassivi.filter((d) =>
      `${d.controparte ?? ""} ${d.numero_documento ?? ""}`.toLowerCase().includes(q)
    ).length;
  }, [docsPassivi, search]);

  const { data: fattureRaw = [], isLoading } = useFattureFornitori({
    stato,
    fornitore_id: fornitoreId,
    mese: mese === "all" ? undefined : mese,
    anno: anno === "all" ? undefined : anno,
  });
  const fatture = useMemo(() => {
    if (sdiFilter === "solo_sdi") return fattureRaw.filter((f) => !f.sdi_mancante);
    if (sdiFilter === "attesa") return fattureRaw.filter((f) => f.sdi_mancante);
    return fattureRaw;
  }, [fattureRaw, sdiFilter]);
  const stats = useFattureStats();
  const { data: fornitori = [] } = useFornitori();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const importMut = useImportFattureExcel();
  const delMut = useDeleteFattura();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    importMut.mutate(f);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fatture Fornitori</h1>
            <p className="text-sm text-muted-foreground">Gestione fatture passive e fornitori</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="situazione">Situazione</TabsTrigger>
          <TabsTrigger value="ricevute">Ricevute</TabsTrigger>
          <TabsTrigger value="emesse">Emesse</TabsTrigger>
          <TabsTrigger value="fornitori">Fornitori</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca fornitore o numero documento"
              className="h-10 pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Azzera ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {trovati} document{trovati === 1 ? "o" : "i"} trovat{trovati === 1 ? "o" : "i"}
          </span>
        </div>

        <TabsContent value="situazione">
          <SituazioneTab />
        </TabsContent>

        <TabsContent value="ricevute" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
              <Upload className="h-4 w-4" /> {importMut.isPending ? "Import..." : "Importa Excel SDI"}
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" /> Nuova Fattura
            </Button>
          </div>
          <SdiMancantiCard search={search} />
          <PagamentiDaAbbinareCard search={search} />
          <RicevuteTab
            fatture={fattureRaw}
            onSelect={setSelFattura}
            anno={anno}
            setAnno={setAnno}
            search={search}
            setSearch={setSearch}
          />
        </TabsContent>

        <TabsContent value="emesse">
          <EmesseTab />
        </TabsContent>

        {/* TAB FORNITORI */}
        <TabsContent value="fornitori">
          <FornitoriTab fatture={fatture} onSelectFornitore={(id) => { setFornitoreId(id); }} />
        </TabsContent>

        {/* TAB REPORT */}
        <TabsContent value="report">
          <ReportTab
            anno={annoReport}
            setAnno={setAnnoReport}
            search={search}
            onApriRicevute={(nome) => {
              setSearch(nome);
              setTab("ricevute");
            }}
          />
        </TabsContent>
      </Tabs>


      {selFattura && (
        <FatturaDettaglioDialog
          fattura={selFattura}
          onClose={() => setSelFattura(null)}
          onDelete={async () => {
            if (!confirm("Eliminare la fattura?")) return;
            await delMut.mutateAsync(selFattura.id);
            toast.success("Fattura eliminata");
            setSelFattura(null);
          }}
          categories={categories}
          transactions={transactions}
        />
      )}

      {newOpen && <NuovaFatturaDialog onClose={() => setNewOpen(false)} fornitori={fornitori} />}
    </div>
  );
}

/* ----- Dettaglio Fattura ----- */
function FatturaDettaglioDialog({
  fattura, onClose, onDelete, categories, transactions,
}: {
  fattura: FatturaWithRel;
  onClose: () => void;
  onDelete: () => void;
  categories: any[];
  transactions: any[];
}) {
  const [categoryId, setCategoryId] = useState<string | null>(fattura.category_id);
  const [note, setNote] = useState(fattura.note ?? "");
  const [transactionId, setTransactionId] = useState<string | null>(fattura.transaction_id);
  const [origine, setOrigine] = useState<string>(fattura.origine ?? "sdi");
  const [sdiMancante, setSdiMancante] = useState<boolean>(!!fattura.sdi_mancante);
  const [identificativoSdi, setIdentificativoSdi] = useState(fattura.identificativo_sdi ?? "");
  const upd = useUpdateFattura();
  const link = useCollegaTransazione();

  const totale = Number(fattura.totale);
  const candidates = useMemo(() => {
    return transactions
      .filter((t: any) => t.type === "expense" && Math.abs(Number(t.amount) - totale) < 1)
      .slice(0, 50);
  }, [transactions, totale]);

  const expCats = categories.filter((c) => c.type === "expense");

  const handleSave = async () => {
    await upd.mutateAsync({
      id: fattura.id,
      category_id: categoryId,
      note,
      origine,
      sdi_mancante: sdiMancante,
      identificativo_sdi: identificativoSdi.trim() || null,
    });
    if (transactionId && transactionId !== fattura.transaction_id) {
      const tx = transactions.find((t: any) => t.id === transactionId);
      await link.mutateAsync({
        fattura_id: fattura.id,
        transaction_id: transactionId,
        data_pagamento: tx?.date ?? new Date().toISOString().slice(0, 10),
      });
    }
    toast.success("Fattura aggiornata");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Dettaglio fattura</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-2 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><Label>Fornitore</Label><div className="font-medium">{fattura.fornitore?.nome ?? fattura.mittente}</div></div>
            <div><Label>P.IVA</Label><div>{fattura.piva_mittente ?? "—"}</div></div>
            <div><Label>Numero</Label><div>{fattura.numero_documento ?? "—"}</div></div>
            <div><Label>Tipo</Label><div>{fattura.tipo}</div></div>
            <div><Label>Data documento</Label><div>{fmtDate(fattura.data_documento)}</div></div>
            <div><Label>Scadenza</Label><div>{fmtDate(fattura.data_scadenza)}</div></div>
            <div><Label>Imponibile</Label><div>{fattura.imponibile === null ? "—" : fmtEur(Number(fattura.imponibile))}</div></div>
            <div><Label>IVA</Label><div>{fattura.imponibile === null ? "—" : fmtEur(Number(fattura.iva ?? 0))}</div></div>

            <div><Label>Totale</Label><div className="font-semibold">{fmtEur(totale)}</div></div>
            <div><Label>Stato</Label><div><StatoBadge stato={fattura.stato_pagamento} /></div></div>
          </div>
          <OrigineFields
            origine={origine}
            setOrigine={setOrigine}
            sdiMancante={sdiMancante}
            setSdiMancante={setSdiMancante}
            identificativoSdi={identificativoSdi}
            setIdentificativoSdi={setIdentificativoSdi}
          />
          <div className="space-y-2">
            <Label>Categoria di costo</Label>
            <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna</SelectItem>
                {expCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Collega a transazione</Label>
            <Select value={transactionId ?? "none"} onValueChange={(v) => setTransactionId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nessun collegamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna</SelectItem>
                {candidates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {fmtDate(t.date)} · {fmtEur(Number(t.amount))} · {t.description ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Mostrate transazioni di spesa con importo simile a {fmtEur(totale)}</p>
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter className="border-t px-6 py-4 flex-row justify-between sm:justify-between">
          <Button variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /> Elimina</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annulla</Button>
            <Button onClick={handleSave}>Salva</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----- Combobox riutilizzabile con creazione al volo ----- */
function CreatableCombobox({
  value, options, placeholder, emptyLabel, createLabel, onSelect, onCreate,
}: {
  value: string | null;
  options: { id: string; label: string }[];
  placeholder: string;
  emptyLabel: string;
  createLabel: (q: string) => string;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const norm = (s: string) => s.trim().toLowerCase();
  const q = norm(query);
  const filtered = useMemo(
    () => (q ? options.filter((o) => norm(o.label).includes(q)) : options),
    [options, q]
  );
  const selected = options.find((o) => o.id === value);
  const showCreate = q.length > 0 && !options.some((o) => norm(o.label) === q);

  const handleCreate = async () => {
    setBusy(true);
    try {
      await onCreate(query.trim());
      setOpen(false);
      setQuery("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Cerca..." value={query} onValueChange={setQuery} />
          <CommandList>
            {filtered.length === 0 && !showCreate && <CommandEmpty>Nessun risultato</CommandEmpty>}
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onSelect(null); setOpen(false); setQuery(""); }}
              >
                {emptyLabel}
              </CommandItem>
              {filtered.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => { onSelect(o.id); setOpen(false); setQuery(""); }}
                >
                  {o.label}
                </CommandItem>
              ))}
              {showCreate && (
                <CommandItem value="__create__" disabled={busy} onSelect={handleCreate}>
                  <Plus className="h-4 w-4" />
                  {createLabel(query.trim())}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ----- Nuova Fattura ----- */
function NuovaFatturaDialog({ onClose, fornitori }: { onClose: () => void; fornitori: Fornitore[] }) {
  const [form, setForm] = useState({
    fornitore_id: "",
    numero_documento: "",
    data_documento: new Date().toISOString().slice(0, 10),
    tipo: "Fattura",
    mittente: "",
    totale: "",
    imponibile: "",
    data_scadenza: "",
  });
  const [origine, setOrigine] = useState("sdi");
  const [sdiMancante, setSdiMancante] = useState(false);
  const [identificativoSdi, setIdentificativoSdi] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const create = useCreateFattura();
  const createFornitore = useCreateFornitore();
  const createCategoria = useCreateCategory();
  const { data: categories = [] } = useCategories();

  const norm = (s: string) => s.trim().toLowerCase();
  const expCats = useMemo(
    () => categories.filter((c) => c.type === "expense").sort((a, b) => a.name.localeCompare(b.name, "it")),
    [categories]
  );

  const selezionaFornitore = (id: string | null, catId?: string | null) => {
    const f = id ? fornitori.find((x) => x.id === id) : null;
    setForm((prev) => ({
      ...prev,
      fornitore_id: id ?? "",
      mittente: f?.nome ?? prev.mittente,
    }));
    const cat = catId !== undefined ? catId : f?.category_id ?? null;
    if (cat) setCategoryId(cat);
  };

  const handleCreateFornitore = async (nome: string) => {
    const esistente = fornitori.find((f) => norm(f.nome) === norm(nome));
    if (esistente) {
      selezionaFornitore(esistente.id);
      toast.info("Fornitore già presente, l'ho selezionato");
      return;
    }
    try {
      const nuovo = await createFornitore.mutateAsync({ nome: nome.trim() });
      setForm((prev) => ({ ...prev, fornitore_id: nuovo.id, mittente: nome.trim() }));
      toast.success("Fornitore creato");
    } catch {
      toast.error("Impossibile creare il fornitore");
    }
  };

  const handleCreateCategoria = async (nome: string) => {
    const esistente = expCats.find((c) => norm(c.name) === norm(nome));
    if (esistente) {
      setCategoryId(esistente.id);
      toast.info("Categoria già presente, l'ho selezionata");
      return;
    }
    try {
      const nuova = await createCategoria.mutateAsync({ name: nome.trim(), type: "expense" });
      setCategoryId(nuova.id);
      toast.success("Categoria creata");
    } catch {
      toast.error("Impossibile creare la categoria");
    }
  };

  const handleSubmit = async () => {
    if (!form.mittente || !form.totale) {
      toast.error("Mittente e totale richiesti");
      return;
    }
    if (origine === "sdi" && !identificativoSdi.trim() && !sdiMancante) {
      toast.error("Identificativo SdI richiesto per le fatture elettroniche");
      return;
    }
    const fornitore = fornitori.find((f) => f.id === form.fornitore_id);
    await create.mutateAsync({
      fornitore_id: form.fornitore_id || null,
      numero_documento: form.numero_documento || null,
      identificativo_sdi: identificativoSdi.trim() || null,
      data_documento: form.data_documento,
      tipo: form.tipo,
      mittente: form.mittente || fornitore?.nome || "",
      piva_mittente: fornitore?.piva ?? null,
      totale: Number(form.totale),
      imponibile: form.imponibile ? Number(form.imponibile) : null,
      data_scadenza: form.data_scadenza || null,
      stato_pagamento: form.tipo === "Nota Credito" ? "nota_credito" : "da_pagare",
      origine,
      sdi_mancante: sdiMancante,
      category_id: categoryId,
    });
    toast.success("Fattura creata");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuova fattura</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Fornitore</Label>
            <CreatableCombobox
              value={form.fornitore_id || null}
              options={fornitori.map((f) => ({ id: f.id, label: f.nome }))}
              placeholder="Seleziona o cerca fornitore"
              emptyLabel="Nessun fornitore"
              createLabel={(q) => `Crea fornitore "${q}"`}
              onSelect={(id) => selezionaFornitore(id)}
              onCreate={handleCreateFornitore}
            />
          </div>

          <div className="space-y-2">
            <Label>Mittente</Label>
            <Input value={form.mittente} onChange={(e) => setForm({ ...form, mittente: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Numero</Label>
              <Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></div>
            <div className="space-y-2"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fattura">Fattura</SelectItem>
                  <SelectItem value="Nota Credito">Nota Credito</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="space-y-2"><Label>Data documento</Label>
              <Input type="date" value={form.data_documento} onChange={(e) => setForm({ ...form, data_documento: e.target.value })} /></div>
            <div className="space-y-2"><Label>Scadenza</Label>
              <Input type="date" value={form.data_scadenza} onChange={(e) => setForm({ ...form, data_scadenza: e.target.value })} /></div>
            <div className="space-y-2"><Label>Imponibile</Label>
              <Input type="number" step="0.01" value={form.imponibile} onChange={(e) => setForm({ ...form, imponibile: e.target.value })} /></div>
            <div className="space-y-2"><Label>Totale</Label>
              <Input type="number" step="0.01" value={form.totale} onChange={(e) => setForm({ ...form, totale: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Categoria di costo</Label>
            <CreatableCombobox
              value={categoryId}
              options={expCats.map((c) => ({ id: c.id, label: c.name }))}
              placeholder="Seleziona o cerca categoria"
              emptyLabel="Nessuna"
              createLabel={(q) => `Crea categoria "${q}"`}
              onSelect={setCategoryId}
              onCreate={handleCreateCategoria}
            />
          </div>

          <OrigineFields
            origine={origine}
            setOrigine={setOrigine}
            sdiMancante={sdiMancante}
            setSdiMancante={setSdiMancante}
            identificativoSdi={identificativoSdi}
            setIdentificativoSdi={setIdentificativoSdi}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>Crea</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----- Tab Fornitori ----- */
function FornitoriTab({
  fatture, onSelectFornitore,
}: { fatture: FatturaWithRel[]; onSelectFornitore: (id: string) => void }) {
  const { data: fornitori = [] } = useFornitori();
  const { data: categories = [] } = useCategories();
  const create = useCreateFornitore();
  const update = useUpdateFornitore();
  const del = useDeleteFornitore();
  const [editing, setEditing] = useState<Fornitore | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; totale: number }>();
    fatture.forEach((f) => {
      if (!f.fornitore_id) return;
      const cur = m.get(f.fornitore_id) ?? { count: 0, totale: 0 };
      cur.count++;
      cur.totale += Number(f.totale);
      m.set(f.fornitore_id, cur);
    });
    return m;
  }, [fatture]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fornitori</CardTitle>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Nuovo Fornitore</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>P.IVA</TableHead>
              <TableHead>Parola chiave</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Fatture</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornitori.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nessun fornitore</TableCell></TableRow>
            )}
            {fornitori.map((f) => {
              const s = stats.get(f.id) ?? { count: 0, totale: 0 };
              const cat = categories.find((c) => c.id === f.category_id);
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium cursor-pointer" onClick={() => onSelectFornitore(f.id)}>{f.nome}</TableCell>
                  <TableCell>{f.piva ?? "—"}</TableCell>
                  <TableCell>
                    {f.match_keyword ? (
                      f.match_keyword
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: "#fffaeb", borderColor: "#fde3a7", color: "#b54708" }}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            nessuna parola chiave
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Le fatture di questo fornitore non vengono abbinate automaticamente ai movimenti bancari.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>{cat?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">{s.count}</TableCell>
                  <TableCell className="text-right">{fmtEur(s.totale)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm(`Eliminare il fornitore "${f.nome}"?`)) return;
                      await del.mutateAsync(f.id);
                      toast.success("Fornitore eliminato");
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {(editing || openNew) && (
        <FornitoreDialog
          fornitore={editing}
          categories={categories}
          onClose={() => { setEditing(null); setOpenNew(false); }}
          onSave={async (data) => {
            if (editing) await update.mutateAsync({ id: editing.id, ...data });
            else await create.mutateAsync(data);
            toast.success("Salvato");
            setEditing(null); setOpenNew(false);
          }}
        />
      )}
    </Card>
  );
}

function FornitoreDialog({
  fornitore, categories, onClose, onSave,
}: {
  fornitore: Fornitore | null;
  categories: any[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const prefilledRef = useRef(false);
  const [form, setForm] = useState({
    nome: fornitore?.nome ?? "",
    piva: fornitore?.piva ?? "",
    codice_fiscale: fornitore?.codice_fiscale ?? "",
    match_keyword: fornitore?.match_keyword ?? "",
    category_id: fornitore?.category_id ?? "",
    note: fornitore?.note ?? "",
  });

  useEffect(() => {
    if (!fornitore && form.nome.trim() && !prefilledRef.current) {
      prefilledRef.current = true;
      setForm((prev) => ({ ...prev, match_keyword: form.nome.toUpperCase().trim() }));
    }
  }, [fornitore, form.nome]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{fornitore ? "Modifica fornitore" : "Nuovo fornitore"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>P.IVA</Label>
              <Input value={form.piva} onChange={(e) => setForm({ ...form, piva: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cod. Fiscale</Label>
              <Input value={form.codice_fiscale} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Parola chiave nei movimenti bancari</Label>
            <Input
              value={form.match_keyword}
              onChange={(e) => setForm({ ...form, match_keyword: e.target.value })}
              placeholder="Es. ELHOPE, PLENITUDE, MOXEDO"
            />
            <p className="text-xs text-muted-foreground">
              Testo cercato nella descrizione dei movimenti per proporre gli abbinamenti automatici.
              Se lo lasci vuoto, le fatture di questo fornitore non verranno abbinate automaticamente.
            </p>
          </div>
          <div className="space-y-2"><Label>Categoria default</Label>
            <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna</SelectItem>
                {categories.filter((c) => c.type === "expense").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select></div>
          <div className="space-y-2"><Label>Note</Label>
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={() => {
            if (!form.nome.trim()) { toast.error("Nome richiesto"); return; }
            onSave({
              nome: form.nome,
              piva: form.piva || null,
              codice_fiscale: form.codice_fiscale || null,
              match_keyword: form.match_keyword.trim().toUpperCase() || null,
              category_id: form.category_id || null,
              note: form.note || null,
            });
          }}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----- Tab Report ----- */
type CampoReport = "totale" | "netto";

function StatoDocBadge({ stato, tipo }: { stato: string; tipo: string }) {
  const isNota = /nota/i.test(tipo || "");
  if (isNota && stato !== "pagata")
    return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Da compensare</Badge>;
  if (stato === "pagata" || stato === "compensata")
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Pagata</Badge>;
  if (stato === "parziale")
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Parziale</Badge>;
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Da pagare</Badge>;
}

function DettaglioFornitore({
  docs,
  nome,
  onApriRicevute,
}: {
  docs: DocumentoSaldo[];
  nome: string;
  onApriRicevute: (nome: string) => void;
}) {
  const ids = useMemo(() => docs.map((d) => d.id), [docs]);
  const { data: datePag = {} } = useDatePagamentoDocumenti(ids);

  const isNota = (t: string) => /nota/i.test(t || "");
  const totale = docs.reduce((s, d) => s + (isNota(d.tipo) ? -d.totale : d.totale), 0);
  const residuo = docs.reduce((s, d) => s + (isNota(d.tipo) ? 0 : d.residuo), 0);
  const pagato = totale - residuo;

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Documenti", v: String(docs.length), c: "" },
          { l: "Totale", v: fmtEur(totale), c: "" },
          { l: "Pagato", v: fmtEur(pagato), c: "" },
          {
            l: "Ancora da pagare",
            v: fmtEur(residuo),
            c: residuo > 0 ? "text-red-600" : "text-muted-foreground",
          },
        ].map((s) => (
          <div key={s.l} className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className={`text-lg font-semibold tabular-nums ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Documento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right">Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                  Nessun documento
                </TableCell>
              </TableRow>
            )}
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{d.numero_documento ?? "—"}</span>
                    {d.sdi_mancante && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">manca da SdI</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{d.tipo}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(d.data_documento)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtEur(d.totale)}</TableCell>
                <TableCell><StatoDocBadge stato={d.stato_pagamento} tipo={d.tipo} /></TableCell>
                <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                  {datePag[d.id]
                    ? `pagata il ${fmtDate(datePag[d.id])}`
                    : `residuo ${fmtEur(d.residuo)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <button
        type="button"
        onClick={() => onApriRicevute(nome)}
        className="text-sm font-medium text-primary hover:underline"
      >
        Apri tutte le fatture di {nome} nella scheda Ricevute →
      </button>
    </div>
  );
}

function ReportTab({
  anno,
  setAnno,
  search,
  onApriRicevute,
}: {
  anno: number;
  setAnno: (n: number) => void;
  search: string;
  onApriRicevute: (nome: string) => void;
}) {
  const { data: fatture = [] } = useFattureFornitori({ anno });
  const { data: fornitori = [] } = useFornitori();
  const { data: docsPassivi = [] } = useDocumentiSaldi("passiva");
  const [campo, setCampo] = useState<CampoReport>("totale");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const labelFornitore = (id: string) =>
    id === "altri" ? "(senza fornitore)" : fornitori.find((f) => f.id === id)?.nome ?? "—";

  const matrixFornitori = useMemo(() => {
    const map = new Map<string, number[]>();
    fatture.forEach((f) => {
      const key = f.fornitore_id ?? "altri";
      if (!map.has(key)) map.set(key, Array(12).fill(0));
      const m = new Date(f.data_documento).getMonth();
      const val = campo === "totale" ? Number(f.totale ?? 0) : Number(f.imponibile ?? f.totale ?? 0);
      map.get(key)![m] += val;
    });
    return map;
  }, [fatture, campo]);

  const righe = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Array.from(matrixFornitori.entries()).filter(([k]) =>
      !q || labelFornitore(k).toLowerCase().includes(q)
    );
  }, [matrixFornitori, search, fornitori]);

  const docsPerFornitore = useMemo(() => {
    const map = new Map<string, DocumentoSaldo[]>();
    docsPassivi.forEach((d) => {
      if (!d.data_documento || Number(d.data_documento.slice(0, 4)) !== anno) return;
      const key = d.fornitore_id ?? "altri";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [docsPassivi, anno]);

  const totColonne = Array(12).fill(0);
  righe.forEach(([, arr]) => arr.forEach((v, i) => (totColonne[i] += v)));
  const totGen = totColonne.reduce((a, b) => a + b, 0);

  const exportCsv = () => {
    const rows: string[] = [];
    rows.push(`Report Fatture Fornitori ${anno} (${campo === "totale" ? "Totale documento" : "Netto"})`);
    rows.push("");
    rows.push(["Fornitore", ...MESI, "Totale"].join(";"));
    righe.forEach(([k, arr]) => {
      const tot = arr.reduce((a, b) => a + b, 0);
      rows.push([labelFornitore(k), ...arr.map((n) => n.toFixed(2)), tot.toFixed(2)].join(";"));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-fatture-${anno}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const now = new Date().getFullYear();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(anno)} onValueChange={(v) => setAnno(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4].map((d) => {
                const y = now - d;
                return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-md border p-0.5">
            {([
              { v: "totale", l: "Totale documento" },
              { v: "netto", l: "Netto" },
            ] as { v: CampoReport; l: string }[]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setCampo(o.v)}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  campo === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Esporta CSV</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Fornitori</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Fornitore</TableHead>
                {MESI.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                <TableHead className="text-right">Totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {righe.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="py-4 text-center text-muted-foreground">Nessun dato</TableCell>
                </TableRow>
              )}
              {righe.map(([k, arr]) => {
                const tot = arr.reduce((a, b) => a + b, 0);
                const aperta = openKey === k;
                return (
                  <Fragment key={k}>
                    <TableRow
                      onClick={() => setOpenKey(aperta ? null : k)}
                      className={`cursor-pointer ${aperta ? "bg-primary/5" : ""}`}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <ChevronRight
                            className={`h-4 w-4 text-muted-foreground transition-transform ${aperta ? "rotate-90" : ""}`}
                          />
                          {labelFornitore(k)}
                        </span>
                      </TableCell>
                      {arr.map((v, i) => (
                        <TableCell key={i} className="text-right tabular-nums">{v ? fmtEur(v) : "—"}</TableCell>
                      ))}
                      <TableCell className="text-right font-semibold">{fmtEur(tot)}</TableCell>
                    </TableRow>
                    {aperta && (
                      <TableRow className="bg-primary/5 hover:bg-primary/5">
                        <TableCell colSpan={14} className="p-3">
                          <DettaglioFornitore
                            docs={docsPerFornitore.get(k) ?? []}
                            nome={labelFornitore(k)}
                            onApriRicevute={onApriRicevute}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {righe.length > 0 && (
                <TableRow className="bg-muted/40">
                  <TableCell className="font-bold">Totale</TableCell>
                  {totColonne.map((v, i) => (
                    <TableCell key={i} className="text-right font-semibold">{v ? fmtEur(v) : "—"}</TableCell>
                  ))}
                  <TableCell className="text-right font-bold">{fmtEur(totGen)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
