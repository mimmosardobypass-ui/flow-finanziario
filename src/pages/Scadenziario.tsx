import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScadenziarioDialog } from "@/components/scadenziario/ScadenziarioDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { FinanziamentoSheet } from "@/components/finanziamenti/FinanziamentoSheet";
import { CollegaMovimentoDialog } from "@/components/finanziamenti/CollegaMovimentoDialog";
import { useScadenzeAgenda, useEntratePreviste, type ScadenzaAgenda } from "@/hooks/useScadenzeAgenda";
import { useContiRiepilogo } from "@/hooks/useConti";
import { useFinanziamenti, useSegnaRataPagataEnte, type Finanziamento, type RataFinanziamento } from "@/hooks/useFinanziamenti";
import { useDeleteScadenziario, useScadenziarioList } from "@/hooks/useScadenziario";
import { fmtEur, oggiISO } from "@/components/finanziamenti/utils";
import { toast } from "@/hooks/use-toast";
import { Kpi } from "@/components/scadenziario/agenda/Kpi";
import { FiltroConti, type ContoFiltro } from "@/components/scadenziario/agenda/FiltroConti";
import { GruppoRate } from "@/components/scadenziario/agenda/GruppoRate";
import { GraficoUscite } from "@/components/scadenziario/agenda/GraficoUscite";
import { CoperturaConti } from "@/components/scadenziario/agenda/CoperturaConti";
import { TabContratti } from "@/components/scadenziario/agenda/TabContratti";
import { TabPagate } from "@/components/scadenziario/agenda/TabPagate";
import { calcolaCoperture, calcolaKpi, calcolaMesi, filtraConto, raggruppaAgenda, sommaRate } from "@/components/scadenziario/agenda/calcoli";

const STORAGE_CONTO = "scadenziario-conto";

function rataPerDialog(r: ScadenzaAgenda): RataFinanziamento {
  return { id: r.rata_id, scadenziario_id: r.scadenziario_id, numero_rata: r.numero_rata, importo: r.importo, data_scadenza: r.data_scadenza, stato: r.stato, transaction_id: r.transaction_id, stimata: r.stimata, quota_capitale: null, quota_interessi: null, debito_residuo: null, data_pagamento: r.data_pagamento, importo_pagato: r.importo_pagato, spese: r.spese, tentativi_falliti: 0, fonte_pagamento: r.fonte_pagamento, confidenza: null, nota: r.nota, imputato: r.importo_pagato ?? 0, residuo_rata: Math.max(0, (r.importo ?? 0) - (r.importo_pagato ?? 0)), stato_effettivo: r.stato, n_movimenti: r.transaction_id ? 1 : 0, da_pagamento_cumulativo: false, movimenti_imputati: [] };
}

export default function Scadenziario() {
  const { data: agenda = [], isLoading } = useScadenzeAgenda();
  const { data: entrate = [] } = useEntratePreviste();
  const { data: conti = [] } = useContiRiepilogo();
  const { data: finanziamenti = [] } = useFinanziamenti();
  const { data: contratti = [] } = useScadenziarioList();
  const elimina = useDeleteScadenziario(); const segnaEnte = useSegnaRataPagataEnte();
  const [tab, setTab] = useState("agenda"); const [dialogOpen, setDialogOpen] = useState(false); const [conto, setConto] = useState(() => { try { return localStorage.getItem(STORAGE_CONTO) ?? "tutti"; } catch { return "tutti"; } });
  const [finanziamentoAperto, setFinanziamentoAperto] = useState<Finanziamento | null>(null); const [contrattoEspanso, setContrattoEspanso] = useState<string | null>(null); const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [rataCollega, setRataCollega] = useState<ScadenzaAgenda | null>(null); const [rataEnte, setRataEnte] = useState<ScadenzaAgenda | null>(null); const [dataEnte, setDataEnte] = useState(oggiISO()); const [notaEnte, setNotaEnte] = useState("");

  const contiFiltro = useMemo<ContoFiltro[]>(() => {
    const presenti = new Map<string, string>(); agenda.filter((r) => r.stato_agenda !== "pagata" && r.conto_id).forEach((r) => presenti.set(r.conto_id ?? "", r.nome_conto ?? "Senza conto"));
    return [...presenti.entries()].sort((a, b) => a[1].localeCompare(b[1], "it")).map(([id, nome], indiceColore) => ({ id, nome, indiceColore }));
  }, [agenda]);
  useEffect(() => { if (conto !== "tutti" && !contiFiltro.some((c) => c.id === conto)) setConto("tutti"); }, [conto, contiFiltro]);
  const cambiaConto = (id: string) => { setConto(id); try { localStorage.setItem(STORAGE_CONTO, id); } catch { /* preferenza non persistibile */ } };
  const indiceColore = (id: string | null) => {
    if (!id) return 4;
    const trovato = contiFiltro.findIndex((c) => c.id === id);
    return trovato < 0 ? 4 : trovato;
  };
  const rateFiltrate = useMemo(() => filtraConto(agenda, conto), [agenda, conto]); const gruppi = useMemo(() => raggruppaAgenda(rateFiltrate), [rateFiltrate]); const kpi = useMemo(() => calcolaKpi(rateFiltrate), [rateFiltrate]);
  const mesi = useMemo(() => calcolaMesi(rateFiltrate), [rateFiltrate]); const coperture = useMemo(() => calcolaCoperture(conti, agenda, entrate), [conti, agenda, entrate]);
  const nonCoperti = coperture.filter((c) => c.stato === "non_coperto"); const entiScaduti = new Set(kpi.scadute.map((r) => r.ente)).size; const nomi7 = [...new Set(kpi.prossime7.map((r) => r.nome_visualizzato))].slice(0, 2).join(", ");
  const stimato30 = kpi.prossime30.filter((r) => r.stimata || r.piano_stimato); const uscitaFissa = mesi[0]?.totale ? rateFiltrate.filter((r) => r.stato_agenda !== "pagata" && r.data_addebito.slice(0, 7) === mesi[0].chiave && r.ente.toLowerCase() !== "paypal a rate").reduce((s, r) => s + r.importo, 0) : 0;
  const dataOggi = format(new Date(), "EEEE d MMMM yyyy", { locale: it });

  const apri = (r: ScadenzaAgenda) => { const fin = finanziamenti.find((f) => f.id === r.scadenziario_id); if (r.tipo === "finanziamento" && fin) setFinanziamentoAperto(fin); else { setTab("contratti"); setContrattoEspanso(r.scadenziario_id); } };
  const preparaPagamentoEnte = (r: ScadenzaAgenda) => { setRataEnte(r); setDataEnte(r.data_scadenza || oggiISO()); setNotaEnte(""); };
  const segna = async () => { if (!rataEnte) return; await segnaEnte.mutateAsync({ rata_id: rataEnte.rata_id, data: dataEnte, nota: notaEnte.trim() || undefined }); toast({ title: "Rata segnata come pagata" }); setRataEnte(null); };

  return <div className="min-w-0 space-y-6 overflow-x-hidden">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold text-foreground">Scadenziario</h1><p className="text-sm text-muted-foreground"><span className="capitalize">Oggi è {dataOggi}</span> · rate di finanziamenti, dilazioni e pagamenti a rate</p></div><Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nuovo contratto</Button></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi titolo="Scadute non pagate" valore={fmtEur(sommaRate(kpi.scadute))} dettaglio={kpi.scadute.length ? `${kpi.scadute.length} rate · ${entiScaduti} enti` : "Nessuna rata scaduta"} allarme={kpi.scadute.length > 0} /><Kpi titolo="Prossimi 7 giorni" valore={fmtEur(sommaRate(kpi.prossime7))} dettaglio={kpi.prossime7.length ? `${kpi.prossime7.length} rate · ${nomi7}` : "Nessuna rata in scadenza"} /><Kpi titolo="Prossimi 30 giorni" valore={fmtEur(sommaRate(kpi.prossime30))} dettaglio={`${kpi.prossime30.length} rate${stimato30.length ? ` · di cui ${fmtEur(sommaRate(stimato30))} con data stimata` : ""}`} /><Kpi titolo="Conti da coprire" valore={String(nonCoperti.length)} dettaglio={nonCoperti.length ? `${nonCoperti[0].conto.nome_conto}: mancano ${fmtEur(-nonCoperti[0].saldoMinimo)}` : "Tutti i conti coprono le rate"} allarme={nonCoperti.length > 0} /></div>
    <Tabs value={tab} onValueChange={setTab}><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><TabsList><TabsTrigger value="agenda">Agenda</TabsTrigger><TabsTrigger value="contratti">Contratti ({contratti.length})</TabsTrigger><TabsTrigger value="pagate">Pagate</TabsTrigger></TabsList><FiltroConti conti={contiFiltro} valore={conto} onChange={cambiaConto} /></div>
      <TabsContent value="agenda" className="mt-5"><div className="grid min-w-0 gap-6 min-[1040px]:grid-cols-[minmax(0,1fr)_380px]"><div className="min-w-0 space-y-4">{isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Caricamento agenda…</p> : <><GruppoRate titolo="Scadute" sottotitolo="da pagare subito" rate={gruppi.scadute} colore="rosso" indiceColore={indiceColore} onApri={apri} onCollega={setRataCollega} onSegnaEnte={preparaPagamentoEnte} /><GruppoRate titolo="Questa settimana" sottotitolo="oggi – prossimi 7 giorni" rate={gruppi.settimana} colore="blu" indiceColore={indiceColore} onApri={apri} onCollega={setRataCollega} onSegnaEnte={preparaPagamentoEnte} /><GruppoRate titolo="Entro 30 giorni" sottotitolo="dall’ottavo al trentesimo giorno" rate={gruppi.trenta} indiceColore={indiceColore} onApri={apri} onCollega={setRataCollega} onSegnaEnte={preparaPagamentoEnte} />{gruppi.mesi.map((m) => <GruppoRate key={m.chiave} titolo={m.label} sottotitolo="Più avanti" rate={m.rate} comprimibile indiceColore={indiceColore} onApri={apri} onCollega={setRataCollega} onSegnaEnte={preparaPagamentoEnte} />)}{!rateFiltrate.some((r) => r.stato_agenda !== "pagata") && <p className="py-12 text-center text-sm text-muted-foreground">Nessuna rata futura da mostrare.</p>}</>}</div><aside className="min-w-0 space-y-4"><GraficoUscite mesi={mesi} conti={contiFiltro} /><CoperturaConti coperture={coperture} /><p className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Legenda:</strong> bordo tratteggiato = data stimata: ricavata dagli addebiti passati o da un piano non ancora caricato. Se la rata cade nel weekend si mostra il giorno reale di addebito.</p></aside></div></TabsContent>
      <TabsContent value="contratti" className="mt-5"><TabContratti contratti={contratti} agenda={agenda} finanziamenti={finanziamenti} conti={contiFiltro} contoSelezionato={conto} espanso={contrattoEspanso} onEspanso={setContrattoEspanso} onApriFinanziamento={setFinanziamentoAperto} onElimina={setDeleteTarget} uscitaFissa={uscitaFissa} /></TabsContent>
      <TabsContent value="pagate" className="mt-5"><TabPagate rate={rateFiltrate} /></TabsContent>
    </Tabs>
    <ScadenziarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={(id) => { setTab("contratti"); setContrattoEspanso(id); }} /><FinanziamentoSheet contratto={finanziamentoAperto} onOpenChange={(v) => !v && setFinanziamentoAperto(null)} /><CollegaMovimentoDialog rata={rataCollega ? rataPerDialog(rataCollega) : null} onOpenChange={(v) => !v && setRataCollega(null)} />
    <Dialog open={Boolean(rataEnte)} onOpenChange={(v) => !v && setRataEnte(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Segna pagata secondo l'ente</DialogTitle><DialogDescription>Registra il pagamento anche se non è ancora presente un movimento bancario collegato.</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1.5"><Label>Data del pagamento</Label><Input type="date" value={dataEnte} onChange={(e) => setDataEnte(e.target.value)} max={format(addDays(parseISO(oggiISO()), 1), "yyyy-MM-dd")} /></div><div className="space-y-1.5"><Label>Nota</Label><Textarea value={notaEnte} onChange={(e) => setNotaEnte(e.target.value)} rows={2} /></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRataEnte(null)}>Annulla</Button><Button onClick={segna} disabled={segnaEnte.isPending}>Conferma</Button></div></DialogContent></Dialog>
    <DeleteConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)} onConfirm={async () => { if (!deleteTarget) return; await elimina.mutateAsync(deleteTarget); setDeleteTarget(null); toast({ title: "Contratto eliminato" }); }} isLoading={elimina.isPending} title="Elimina contratto" description="Tutte le rate associate verranno eliminate. Questa azione non può essere annullata." />
  </div>;
}