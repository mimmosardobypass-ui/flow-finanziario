import { useMemo, useRef, useState } from "react";
import { FileText, Upload, UserCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useDocumentiSaldi, DocumentoSaldo, useImportFattureEmesseExcel,
  useIncassiFattureEmesse, useConfermaIncassoFatturaEmessa, IncassoProposta,
} from "@/hooks/useFattureFornitori";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("it-IT") : "—");
const corta = (s: string | null, n = 60) => (!s ? "—" : s.length > n ? s.slice(0, n) + "…" : s);

export function filtraEmesse(docs: DocumentoSaldo[], search: string) {
  const q = search.trim().toLowerCase();
  const list = q
    ? docs.filter((d) => `${d.controparte ?? ""} ${d.numero_documento ?? ""}`.toLowerCase().includes(q))
    : docs;
  return [...list].sort((a, b) => (b.data_documento ?? "").localeCompare(a.data_documento ?? ""));
}

function StatoEmessa({ d }: { d: DocumentoSaldo }) {
  if (d.residuo <= 0.005) return <Badge className="bg-success text-success-foreground hover:bg-success">Incassata</Badge>;
  const scaduta = (d.giorni_scaduta ?? 0) > 0;
  return (
    <div className="flex flex-wrap gap-1">
      {d.imputato > 0 ? <Badge variant="secondary">Parziale</Badge> : <Badge variant="outline">Da incassare</Badge>}
      {scaduta && <Badge variant="destructive">Scaduta</Badge>}
    </div>
  );
}

function PropostaFattura({ items }: { items: IncassoProposta[] }) {
  const f = items[0];
  const [sel, setSel] = useState(items[0].transaction_id);
  const conferma = useConfermaIncassoFatturaEmessa();
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="text-sm">
        <span className="font-semibold">{f.numero_documento ?? "—"}</span> · {f.cliente ?? "—"} · {fmtDate(f.data_documento)} ·
        residuo <span className="font-semibold whitespace-nowrap">{fmtEur(f.residuo)}</span>
      </div>
      <RadioGroup value={sel} onValueChange={setSel} className="gap-1">
        {items.map((m) => (
          <label key={m.transaction_id} className="flex items-start gap-2 rounded px-2 py-1 text-sm hover:bg-muted cursor-pointer">
            {items.length > 1 && <RadioGroupItem value={m.transaction_id} className="mt-0.5" />}
            {items.length === 1 && <ArrowRight className="h-4 w-4 mt-0.5 text-muted-foreground" />}
            <span className="flex-1">
              {fmtDate(m.data_movimento)} · {m.conto ?? "—"} ·{" "}
              <span className="font-semibold text-success whitespace-nowrap">{fmtEur(m.importo_movimento)}</span>
              <span className="text-muted-foreground"> · {corta(m.descrizione)}</span>
              {m.nome_in_descrizione && (
                <Badge variant="outline" className="ml-2 gap-1 text-xs">
                  <UserCheck className="h-3 w-3" /> nome cliente nel bonifico
                </Badge>
              )}
            </span>
          </label>
        ))}
      </RadioGroup>
      <div className="flex justify-end">
        <Button size="sm" disabled={conferma.isPending}
          onClick={() => conferma.mutate({ fattura_id: f.fattura_id, transaction_id: sel })}>
          Conferma
        </Button>
      </div>
    </div>
  );
}

function IncassiDaConfermare() {
  const { data = [] } = useIncassiFattureEmesse();
  const gruppi = useMemo(() => {
    const m = new Map<string, IncassoProposta[]>();
    data.forEach((r) => m.set(r.fattura_id, [...(m.get(r.fattura_id) ?? []), r]));
    return [...m.values()];
  }, [data]);
  if (!gruppi.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Incassi da confermare ({gruppi.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {gruppi.map((g) => <PropostaFattura key={g[0].fattura_id} items={g} />)}
      </CardContent>
    </Card>
  );
}

export function EmesseTab({ search }: { search: string }) {
  const { data: docs = [], isLoading } = useDocumentiSaldi("attiva");
  const lista = useMemo(() => filtraEmesse(docs, search), [docs, search]);
  const fileRef = useRef<HTMLInputElement>(null);
  const imp = useImportFattureEmesseExcel();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) imp.mutate(f); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={imp.isPending}>
          <Upload className="h-4 w-4" /> {imp.isPending ? "Import..." : "Importa Excel SDI (emesse)"}
        </Button>
      </div>
      <IncassiDaConfermare />
      {!isLoading && lista.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nessuna fattura emessa nel registro</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead className="text-right">Incassato</TableHead>
                  <TableHead className="text-right">Residuo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(d.data_documento)}</TableCell>
                    <TableCell>{d.numero_documento ?? "—"}</TableCell>
                    <TableCell>{d.controparte ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtEur(d.totale)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtEur(d.imputato)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">{fmtEur(Math.max(0, d.residuo))}</TableCell>
                    <TableCell><StatoEmessa d={d} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
