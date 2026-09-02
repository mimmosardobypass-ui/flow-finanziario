import { useMemo, useState, useEffect } from "react";
import { Link2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  usePagamentiFatture, useCollegaPagamentiFatture, PagamentoProposta,
} from "@/hooks/useFattureFornitori";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("it-IT") : "—";

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

export function PagamentiFattureCard({ search = "" }: { search?: string }) {
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
