import { useState, useMemo } from "react";
import { format, isBefore, isAfter, startOfDay, addDays, differenceInCalendarDays } from "date-fns";
import { Plus, ChevronDown, ChevronUp, Trash2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScadenziarioList, useDeleteScadenziario, ScadenziarioWithRate } from "@/hooks/useScadenziario";
import { ScadenziarioDialog } from "@/components/scadenziario/ScadenziarioDialog";
import { RateTable } from "@/components/scadenziario/RateTable";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";


function getContractStatus(contract: ScadenziarioWithRate) {
  const rate = contract.scadenze_rate || [];
  const pagate = rate.filter((r) => r.stato === "pagata").length;
  const scadute = rate.filter(
    (r) => r.stato !== "pagata" && r.data_scadenza && isBefore(new Date(r.data_scadenza), startOfDay(new Date()))
  ).length;

  if (pagate === rate.length && rate.length > 0) return { label: "Completato", variant: "default" as const, className: "bg-green-600 hover:bg-green-700" };
  if (scadute > 0) return { label: "Scaduto", variant: "destructive" as const, className: "" };
  return { label: "In corso", variant: "secondary" as const, className: "bg-yellow-500 hover:bg-yellow-600 text-white" };
}

const tipoLabelsMap: Record<string, string> = {
  finanziamento: "Finanziamento",
  abbonamento: "Abbonamento",
  assicurazione: "Assicurazione",
};

function getTipoLabel(tipo: string) {
  return tipoLabelsMap[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

const eur = (n: number) =>
  `€ ${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Scadenziario() {
  const { data: contratti = [], isLoading } = useScadenziarioList();
  const deleteMutation = useDeleteScadenziario();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const prossime = useMemo(() => {
    const oggi = startOfDay(new Date());
    const limite = addDays(oggi, 30);
    let totale = 0;
    let stimato = 0;
    let count = 0;
    for (const c of contratti) {
      for (const r of c.scadenze_rate || []) {
        if (r.stato === "pagata" || !r.data_scadenza) continue;
        const d = new Date(r.data_scadenza);
        if (isBefore(d, oggi) || isAfter(d, limite)) continue;
        count++;
        totale += Number(r.importo || 0);
        if (r.stimata) stimato += Number(r.importo || 0);
      }
    }
    return { totale, stimato, count };
  }, [contratti]);

  const { inCorso, cronologia } = useMemo(() => {
    const aperti: ScadenziarioWithRate[] = [];
    const chiusi: ScadenziarioWithRate[] = [];
    for (const c of contratti) {
      const rate = c.scadenze_rate || [];
      if (rate.length > 0 && rate.every((r) => r.stato === "pagata")) chiusi.push(c);
      else aperti.push(c);
    }
    aperti.sort((a, b) => (getInfo(a).prossima?.getTime() ?? Infinity) - (getInfo(b).prossima?.getTime() ?? Infinity));
    chiusi.sort((a, b) => (getInfo(b).ultima?.getTime() ?? 0) - (getInfo(a).ultima?.getTime() ?? 0));
    return { inCorso: aperti, cronologia: chiusi };
  }, [contratti]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast({ title: "Contratto eliminato" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Errore", description: "Impossibile eliminare il contratto", variant: "destructive" });
    }
  };

  const renderTable = (lista: ScadenziarioWithRate[], mode: "in_corso" | "cronologia") => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>N. Contratto</TableHead>
            <TableHead>Società</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-32">Avanzamento</TableHead>
            <TableHead className="text-right">Importo Totale</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map((c) => {
            const rate = c.scadenze_rate || [];
            const info = getInfo(c);
            const status = getContractStatus(c);
            const isExpanded = expandedId === c.id;
            const perc = info.totale > 0 ? (info.pagate / info.totale) * 100 : 0;

            return (
              <>
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <TableCell>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.numero_contratto}</div>
                    <div className="text-xs text-muted-foreground">
                      {info.pagate} di {info.totale} pagate
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.societa_finanziaria === "PayPal" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <CreditCard className="h-3.5 w-3.5" />
                        PayPal a rate
                      </span>
                    ) : (
                      c.societa_finanziaria
                    )}
                  </TableCell>
                  <TableCell>{getTipoLabel(c.tipo)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-green-600" style={{ width: `${perc}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{Math.round(perc)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{eur(c.importo_totale)}</div>
                    {mode === "in_corso" && info.prossimaRata && (
                      <div className="text-xs text-muted-foreground">
                        Prossimo pagamento:{" "}
                        <span className={info.prossimaRata.stimata ? "italic" : ""}>
                          {info.prossima ? format(info.prossima, "dd/MM/yyyy") : "—"}
                          {info.prossimaRata.stimata && " (stimata)"}
                        </span>
                      </div>
                    )}
                    {mode === "cronologia" && info.ultima && (
                      <div className="text-xs text-muted-foreground">
                        Completato il {format(info.ultima, "dd/MM/yyyy")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={status.className} variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${c.id}-detail`}>
                    <TableCell colSpan={8} className="bg-muted/30 p-4">
                      <RateTable rate={rate} />
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scadenziario</h1>
          <p className="text-muted-foreground">Gestisci i tuoi contratti e le relative rate</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Contratto
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">In scadenza nei prossimi 30 giorni</div>
          <div className="text-2xl font-bold">{eur(prossime.totale)}</div>
          <div className="text-xs text-muted-foreground">
            {prossime.count} rate
            {prossime.stimato > 0 && <> · di cui {eur(prossime.stimato)} stimati</>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="in_corso">
        <TabsList>
          <TabsTrigger value="in_corso">In corso ({inCorso.length})</TabsTrigger>
          <TabsTrigger value="cronologia">Cronologia ({cronologia.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="in_corso" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Piani in corso</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Caricamento...</p>
              ) : inCorso.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nessun piano in corso.</p>
              ) : (
                renderTable(inCorso, "in_corso")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cronologia" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Piani completati</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Caricamento...</p>
              ) : cronologia.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nessun piano completato.</p>
              ) : (
                renderTable(cronologia, "cronologia")
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      <ScadenziarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={(id) => setExpandedId(id)} />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Elimina Contratto"
        description="Sei sicuro di voler eliminare questo contratto? Tutte le rate associate verranno eliminate. Questa azione non può essere annullata."
      />
    </div>
  );
}
