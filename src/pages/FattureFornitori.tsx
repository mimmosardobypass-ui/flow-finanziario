import { useMemo, useRef, useState } from "react";
import { FileText, Upload, Plus, Link2, Trash2, Pencil, Download } from "lucide-react";
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
} from "@/hooks/useFattureFornitori";
import {
  useFornitori, useCreateFornitore, useUpdateFornitore, useDeleteFornitore, Fornitore,
} from "@/hooks/useFornitori";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("it-IT") : "—";

const MESI = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function StatoBadge({ stato }: { stato: string }) {
  if (stato === "pagata") return <Badge className="bg-green-600 hover:bg-green-600">Pagata</Badge>;
  if (stato === "nota_credito") return <Badge variant="secondary">Nota credito</Badge>;
  return <Badge className="bg-red-600 hover:bg-red-600">Da pagare</Badge>;
}

export default function FattureFornitori() {
  const [stato, setStato] = useState("all");
  const [fornitoreId, setFornitoreId] = useState("all");
  const now = new Date();
  const [anno, setAnno] = useState<number>(now.getFullYear());
  const [mese, setMese] = useState<number | "all">("all");
  const [selFattura, setSelFattura] = useState<FatturaWithRel | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: fatture = [], isLoading } = useFattureFornitori({
    stato,
    fornitore_id: fornitoreId,
    mese: mese === "all" ? undefined : mese,
    anno,
  });
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

      <Tabs defaultValue="fatture" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fatture">Fatture</TabsTrigger>
          <TabsTrigger value="fornitori">Fornitori</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        {/* TAB FATTURE */}
        <TabsContent value="fatture" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Da pagare</div>
              <div className="text-2xl font-bold text-red-600">{fmtEur(stats.daPagare)}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Pagate</div>
              <div className="text-2xl font-bold text-green-600">{fmtEur(stats.pagate)}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Imponibile mese corrente</div>
              <div className="text-2xl font-bold">{fmtEur(stats.imponibileMese)}</div>
            </CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap gap-3 items-end justify-between">
                <div className="flex flex-wrap gap-2">
                  <Select value={stato} onValueChange={setStato}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="da_pagare">Da pagare</SelectItem>
                      <SelectItem value="pagata">Pagate</SelectItem>
                      <SelectItem value="nota_credito">Note credito</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={fornitoreId} onValueChange={setFornitoreId}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i fornitori</SelectItem>
                      {fornitori.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(mese)} onValueChange={(v) => setMese(v === "all" ? "all" : Number(v))}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i mesi</SelectItem>
                      {MESI.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(anno)} onValueChange={(v) => setAnno(Number(v))}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0,1,2,3,4].map((d) => {
                        const y = now.getFullYear() - d;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                  <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
                    <Upload className="h-4 w-4" /> {importMut.isPending ? "Import..." : "Importa Excel SDI"}
                  </Button>
                  <Button onClick={() => setNewOpen(true)}>
                    <Plus className="h-4 w-4" /> Nuova Fattura
                  </Button>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fornitore</TableHead>
                      <TableHead>Numero</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Imponibile</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Totale</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-center">Pag.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Caricamento...</TableCell></TableRow>
                    )}
                    {!isLoading && fatture.length === 0 && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nessuna fattura</TableCell></TableRow>
                    )}
                    {fatture.map((f) => (
                      <TableRow key={f.id} className="cursor-pointer" onClick={() => setSelFattura(f)}>
                        <TableCell>{fmtDate(f.data_documento)}</TableCell>
                        <TableCell className="font-medium">{f.fornitore?.nome ?? f.mittente}</TableCell>
                        <TableCell>{f.numero_documento ?? "—"}</TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{f.tipo}</span></TableCell>
                        <TableCell className="text-right">{fmtEur(Number(f.imponibile ?? 0))}</TableCell>
                        <TableCell className="text-right">{fmtEur(Number(f.iva ?? 0))}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtEur(Number(f.totale))}</TableCell>
                        <TableCell>{fmtDate(f.data_scadenza)}</TableCell>
                        <TableCell><StatoBadge stato={f.stato_pagamento} /></TableCell>
                        <TableCell className="text-center">
                          <Link2 className={`h-4 w-4 inline ${f.transaction_id ? "text-green-600" : "text-orange-500"}`} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB FORNITORI */}
        <TabsContent value="fornitori">
          <FornitoriTab fatture={fatture} onSelectFornitore={(id) => { setFornitoreId(id); }} />
        </TabsContent>

        {/* TAB REPORT */}
        <TabsContent value="report">
          <ReportTab anno={anno} setAnno={setAnno} />
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
    await upd.mutateAsync({ id: fattura.id, category_id: categoryId, note });
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
            <div><Label>Imponibile</Label><div>{fmtEur(Number(fattura.imponibile ?? 0))}</div></div>
            <div><Label>IVA</Label><div>{fmtEur(Number(fattura.iva ?? 0))}</div></div>
            <div><Label>Totale</Label><div className="font-semibold">{fmtEur(totale)}</div></div>
            <div><Label>Stato</Label><div><StatoBadge stato={fattura.stato_pagamento} /></div></div>
          </div>
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
  const create = useCreateFattura();

  const handleSubmit = async () => {
    if (!form.mittente || !form.totale) {
      toast.error("Mittente e totale richiesti");
      return;
    }
    const fornitore = fornitori.find((f) => f.id === form.fornitore_id);
    await create.mutateAsync({
      fornitore_id: form.fornitore_id || null,
      numero_documento: form.numero_documento || null,
      data_documento: form.data_documento,
      tipo: form.tipo,
      mittente: form.mittente || fornitore?.nome || "",
      piva_mittente: fornitore?.piva ?? null,
      totale: Number(form.totale),
      imponibile: form.imponibile ? Number(form.imponibile) : null,
      data_scadenza: form.data_scadenza || null,
      stato_pagamento: form.tipo === "Nota Credito" ? "nota_credito" : "da_pagare",
    });
    toast.success("Fattura creata");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuova fattura</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Fornitore</Label>
            <Select value={form.fornitore_id} onValueChange={(v) => {
              const f = fornitori.find((x) => x.id === v);
              setForm({ ...form, fornitore_id: v, mittente: f?.nome ?? form.mittente });
            }}>
              <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
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
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Fatture</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornitori.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nessun fornitore</TableCell></TableRow>
            )}
            {fornitori.map((f) => {
              const s = stats.get(f.id) ?? { count: 0, totale: 0 };
              const cat = categories.find((c) => c.id === f.category_id);
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium cursor-pointer" onClick={() => onSelectFornitore(f.id)}>{f.nome}</TableCell>
                  <TableCell>{f.piva ?? "—"}</TableCell>
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
  const [form, setForm] = useState({
    nome: fornitore?.nome ?? "",
    piva: fornitore?.piva ?? "",
    codice_fiscale: fornitore?.codice_fiscale ?? "",
    category_id: fornitore?.category_id ?? "",
    note: fornitore?.note ?? "",
  });
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
function ReportTab({ anno, setAnno }: { anno: number; setAnno: (n: number) => void }) {
  const { data: fatture = [] } = useFattureFornitori({ anno });
  const { data: fornitori = [] } = useFornitori();
  const { data: categories = [] } = useCategories();

  const matrixFornitori = useMemo(() => {
    const map = new Map<string, number[]>();
    fatture.forEach((f) => {
      const key = f.fornitore_id ?? "altri";
      if (!map.has(key)) map.set(key, Array(12).fill(0));
      const m = new Date(f.data_documento).getMonth();
      map.get(key)![m] += Number(f.imponibile ?? f.totale ?? 0);
    });
    return map;
  }, [fatture]);

  const matrixCategorie = useMemo(() => {
    const map = new Map<string, number[]>();
    fatture.forEach((f) => {
      const key = f.category_id ?? "altri";
      if (!map.has(key)) map.set(key, Array(12).fill(0));
      const m = new Date(f.data_documento).getMonth();
      map.get(key)![m] += Number(f.imponibile ?? f.totale ?? 0);
    });
    return map;
  }, [fatture]);

  const labelFornitore = (id: string) =>
    id === "altri" ? "(senza fornitore)" : fornitori.find((f) => f.id === id)?.nome ?? "—";
  const labelCategoria = (id: string) =>
    id === "altri" ? "(senza categoria)" : categories.find((c) => c.id === id)?.name ?? "—";

  const exportCsv = () => {
    const rows: string[] = [];
    rows.push(`Report Fatture Fornitori ${anno}`);
    rows.push("");
    rows.push("FORNITORI");
    rows.push(["Fornitore", ...MESI, "Totale"].join(";"));
    matrixFornitori.forEach((arr, k) => {
      const tot = arr.reduce((a, b) => a + b, 0);
      rows.push([labelFornitore(k), ...arr.map((n) => n.toFixed(2)), tot.toFixed(2)].join(";"));
    });
    rows.push("");
    rows.push("CATEGORIE");
    rows.push(["Categoria", ...MESI, "Totale"].join(";"));
    matrixCategorie.forEach((arr, k) => {
      const tot = arr.reduce((a, b) => a + b, 0);
      rows.push([labelCategoria(k), ...arr.map((n) => n.toFixed(2)), tot.toFixed(2)].join(";"));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-fatture-${anno}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const renderMatrix = (
    title: string,
    matrix: Map<string, number[]>,
    label: (k: string) => string
  ) => {
    const totColonne = Array(12).fill(0);
    matrix.forEach((arr) => arr.forEach((v, i) => (totColonne[i] += v)));
    const totGen = totColonne.reduce((a, b) => a + b, 0);
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">{title}</TableHead>
                {MESI.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                <TableHead className="text-right">Totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.size === 0 && (
                <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-4">Nessun dato</TableCell></TableRow>
              )}
              {Array.from(matrix.entries()).map(([k, arr]) => {
                const tot = arr.reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={k}>
                    <TableCell className="font-medium">{label(k)}</TableCell>
                    {arr.map((v, i) => (
                      <TableCell key={i} className="text-right tabular-nums">{v ? fmtEur(v) : "—"}</TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">{fmtEur(tot)}</TableCell>
                  </TableRow>
                );
              })}
              {matrix.size > 0 && (
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
    );
  };

  const now = new Date().getFullYear();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={String(anno)} onValueChange={(v) => setAnno(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0,1,2,3,4].map((d) => {
              const y = now - d;
              return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Esporta CSV</Button>
      </div>
      {renderMatrix("Fornitori", matrixFornitori, labelFornitore)}
      {renderMatrix("Categorie", matrixCategorie, labelCategoria)}
    </div>
  );
}
