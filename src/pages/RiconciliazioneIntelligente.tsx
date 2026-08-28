import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, GitMerge, Loader2, Search, CheckCheck, AlertTriangle, Layers, ArrowLeftRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ReconciliationRuleDialog } from "@/components/ReconciliationRuleDialog";
import {
  useReconciliationRules,
  useCreateReconciliationRule,
  useUpdateReconciliationRule,
  useDeleteReconciliationRule,
  useToggleReconciliationRule,
  useFindReconciliationMatches,
  useReconcileSumupPairs,
  useFindReconciliationAggregates,
  useReconcileSumupGroups,
  useCommissioniSumup,
  useFindContropartiteMancanti,
  useCreateContropartiteBatch,
  ReconciliationRule,
  ReconciliationMatch,
  ReconciliationAggregateEnriched,
  ContropartitaMancante,
} from "@/hooks/useReconciliationRules";
import { useReconcile } from "@/hooks/useReconciliation";
import { useConti } from "@/hooks/useConti";
import { toast } from "@/hooks/use-toast";

const FUORI_NORMA_MSG =
  "Percentuale diversa da quelle abituali: potrebbe essere una carta con tariffa diversa. Controlla prima di confermare.";

const eur = (n: number) =>
  `€${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number) =>
  `${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function PercentBadge({ percentuale, fuoriNorma }: { percentuale: number; fuoriNorma: boolean }) {
  if (!fuoriNorma) return <span>{pct(percentuale)}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          {pct(percentuale)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{FUORI_NORMA_MSG}</TooltipContent>
    </Tooltip>
  );
}


function scoreColor(score: number): string {
  if (score > 90) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200";
  if (score >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200";
  return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200";
}

function fmtAmount(n: number, type: string) {
  const sign = type === "income" ? "+" : "−";
  const cls = type === "income" ? "text-green-600" : "text-destructive";
  return <span className={`font-semibold ${cls}`}>{sign}€{Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>;
}

function ruleDescription(r: ReconciliationRule, conti: { id: string; nome_conto: string }[]): string {
  const co = r.conto_origine_id ? conti.find((c) => c.id === r.conto_origine_id)?.nome_conto : null;
  const cd = r.conto_dest_id ? conti.find((c) => c.id === r.conto_dest_id)?.nome_conto : null;
  const left = r.keywords_origine?.[0] || co || "Origine";
  const right = r.keywords_dest?.[0] || cd || "Destinazione";
  const parts = [`${left} → ${right}`];
  if (r.importo_match === "percent" && r.commissione_percent > 0) {
    parts.push(`commissione ${r.commissione_percent}%`);
  }
  parts.push(`entro ${r.giorni_max} giorni`);
  return parts.join(", ");
}

export default function RiconciliazioneIntelligente() {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useReconciliationRules();
  const { data: conti = [] } = useConti();
  const createMut = useCreateReconciliationRule();
  const updateMut = useUpdateReconciliationRule();
  const deleteMut = useDeleteReconciliationRule();
  const toggleMut = useToggleReconciliationRule();
  const findMut = useFindReconciliationMatches();
  const reconcileMut = useReconcile();
  const sumupMut = useReconcileSumupPairs();
  const aggMut = useFindReconciliationAggregates();
  const groupsMut = useReconcileSumupGroups();
  const contropartiteMut = useFindContropartiteMancanti();
  const creaContropartiteMut = useCreateContropartiteBatch();
  const { data: commissioni = [], refetch: refetchCommissioni } = useCommissioniSumup();

  const [tab, setTab] = useState("matches");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReconciliationRule | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<ReconciliationRule | null>(null);

  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);
  const [aggregates, setAggregates] = useState<ReconciliationAggregateEnriched[]>([]);
  const [selectedAggs, setSelectedAggs] = useState<Set<string>>(new Set());
  const [reconcilingAggs, setReconcilingAggs] = useState(false);
  const [contropartite, setContropartite] = useState<ContropartitaMancante[]>([]);
  const [selectedContro, setSelectedContro] = useState<Set<string>>(new Set());
  const [creatingContro, setCreatingContro] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState(false);
  const [autoSearching, setAutoSearching] = useState(true);
  const autoSearchDone = useRef(false);

  const runSearch = async (silent = false) => {
    try {
      const [data, aggs, contro] = await Promise.all([
        findMut.mutateAsync(),
        aggMut.mutateAsync(),
        contropartiteMut.mutateAsync(),
      ]);
      setMatches(data);
      setAggregates(aggs);
      setContropartite(contro);
      setSelected(new Set());
      setSelectedAggs(new Set());
      setSelectedContro(new Set());
      if (!silent) {
        toast({
          title: "Ricerca completata",
          description: `${data.length} coppie trovate${aggs.length ? ` · ${aggs.length} accorpamenti` : ""}${
            contro.length ? ` · ${contro.length} ricariche senza uscita` : ""
          }`,
        });
      }
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleSearch = () => runSearch(false);


  // Ricerca automatica una sola volta all'apertura della pagina
  useEffect(() => {
    if (autoSearchDone.current) return;
    autoSearchDone.current = true;
    (async () => {
      await runSearch(true);
      setAutoSearching(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedMatches = useMemo(() => {
    const map = new Map<string, ReconciliationMatch[]>();
    matches.forEach((m) => {
      const k = m.rule_name;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    });
    return Array.from(map.entries());
  }, [matches]);

  const matchKey = (m: ReconciliationMatch) => `${m.source_id}_${m.dest_id}`;

  const toggleSelect = (m: ReconciliationMatch) => {
    const k = matchKey(m);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const SUMUP_RULE_NAME = "SumUp POS → Payout Postepay";

  const sumupMatches = useMemo(
    () => matches.filter((m) => m.rule_name === SUMUP_RULE_NAME),
    [matches]
  );
  const sumupIncassiTotal = useMemo(
    () => sumupMatches.reduce((s, m) => s + Number(m.source_amount), 0),
    [sumupMatches]
  );
  const sumupPayoutTotal = useMemo(
    () => sumupMatches.reduce((s, m) => s + Number(m.dest_amount), 0),
    [sumupMatches]
  );
  const sumupCommissionTotal = useMemo(
    () => sumupIncassiTotal - sumupPayoutTotal,
    [sumupIncassiTotal, sumupPayoutTotal]
  );

  /* ─── Riquadro di controllo commissioni (da v_commissioni_sumup) ─── */
  const commSummary = useMemo(() => {
    if (commissioni.length === 0) return null;
    const incassato = commissioni.reduce((s, r) => s + Number(r.incassato || 0), 0);
    const commTot = commissioni.reduce((s, r) => s + Number(r.commissione || 0), 0);
    const perc = commissioni
      .map((r) => Number(r.percentuale || 0))
      .filter((p) => p > 0);
    const byMonth = new Map<string, { incassato: number; commissione: number }>();
    commissioni.forEach((r) => {
      const m = r.mese ? String(r.mese).slice(0, 7) : "—";
      const cur = byMonth.get(m) || { incassato: 0, commissione: 0 };
      cur.incassato += Number(r.incassato || 0);
      cur.commissione += Number(r.commissione || 0);
      byMonth.set(m, cur);
    });
    const mesi = Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6);
    return {
      liquidazioni: commissioni.length,
      incassato,
      commTot,
      pctMedia: incassato > 0 ? (commTot / incassato) * 100 : 0,
      pctMin: perc.length ? Math.min(...perc) : 0,
      pctMax: perc.length ? Math.max(...perc) : 0,
      mesi,
    };
  }, [commissioni]);

  /* ─── Accorpamenti ─── */
  const toggleAgg = (dest_id: string) => {
    setSelectedAggs((prev) => {
      const next = new Set(prev);
      if (next.has(dest_id)) next.delete(dest_id); else next.add(dest_id);
      return next;
    });
  };

  const reloadAll = async () => {
    await runSearch(true);
    await refetchCommissioni();
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const handleReconcileAggregates = async () => {
    const sel = aggregates.filter((a) => selectedAggs.has(a.dest_id));
    if (sel.length === 0) return;
    setReconcilingAggs(true);
    try {
      const res = await groupsMut.mutateAsync(
        sel.map((a) => ({ source_ids: a.source_ids, dest_id: a.dest_id, rule_id: a.rule_id }))
      );
      toast({
        title: "Accorpamenti riconciliati",
        description: `${res?.accorpamenti ?? sel.length} accorpamenti · Commissioni: ${eur(
          Number(res?.totale_commissioni ?? sel.reduce((s, a) => s + Number(a.commissione_euro), 0))
        )}`,
      });
      await reloadAll();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setReconcilingAggs(false);
    }
  };

  /* ─── Contropartite mancanti (ricariche senza uscita dalla Cassa) ─── */
  const toggleContro = (dest_id: string) => {
    setSelectedContro((prev) => {
      const next = new Set(prev);
      if (next.has(dest_id)) next.delete(dest_id); else next.add(dest_id);
      return next;
    });
  };

  const controSafe = useMemo(
    () => contropartite.filter((c) => !c.gia_esiste_simile),
    [contropartite]
  );
  const allSafeSelected =
    controSafe.length > 0 && controSafe.every((c) => selectedContro.has(c.dest_id));

  const toggleAllContro = () => {
    setSelectedContro((prev) => {
      if (allSafeSelected) {
        const next = new Set(prev);
        controSafe.forEach((c) => next.delete(c.dest_id));
        return next;
      }
      const next = new Set(prev);
      controSafe.forEach((c) => next.add(c.dest_id));
      return next;
    });
  };

  const handleCreateContropartite = async () => {
    const sel = contropartite.filter((c) => selectedContro.has(c.dest_id));
    if (sel.length === 0) return;
    setCreatingContro(true);
    try {
      const res = await creaContropartiteMut.mutateAsync(
        sel.map((c) => ({ rule_id: c.rule_id, dest_id: c.dest_id }))
      );
      const n = Number(res?.create ?? sel.length);
      const tot = Number(
        res?.totale ?? sel.reduce((s, c) => s + Number(c.origine_importo), 0)
      );
      const conto = sel[0]?.origine_conto || "Cassa";
      toast({
        title: "Movimenti creati",
        description: `${n} movimenti creati in ${conto} · ${eur(tot)}`,
      });
      await reloadAll();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setCreatingContro(false);
    }
  };


  const reconcilePairs = async (pairs: ReconciliationMatch[]) => {
    setReconciling(true);
    let ok = 0;
    let fail = 0;
    let commissioniTotal = 0;
    let payoutTotal = 0;
    try {
      const sumupPairs = pairs.filter((p) => p.rule_name === SUMUP_RULE_NAME);
      const otherPairs = pairs.filter((p) => p.rule_name !== SUMUP_RULE_NAME);

      if (sumupPairs.length > 0) {
        try {
          await sumupMut.mutateAsync(
            sumupPairs.map((p) => ({ source_id: p.source_id, dest_id: p.dest_id, rule_id: p.rule_id }))
          );
          ok += sumupPairs.length;
          commissioniTotal = sumupPairs.reduce(
            (s, p) => s + (Number(p.source_amount) - Number(p.dest_amount)),
            0
          );
          payoutTotal = sumupPairs.reduce((s, p) => s + Number(p.dest_amount), 0);

        } catch (e) {
          console.error("[Riconciliazione SumUp] errore batch", e);
          fail += sumupPairs.length;
        }
      }

      for (const p of otherPairs) {
        try {
          await reconcileMut.mutateAsync({
            transactionIds: [p.source_id, p.dest_id],
            reconciliationType: "transfer",
          });
          ok++;
        } catch (e) {
          console.error("[Riconciliazione] errore coppia", e);
          fail++;
        }
      }
      // Remove reconciled pairs from view
      const reconciledKeys = new Set(pairs.map(matchKey));
      setMatches((prev) => prev.filter((m) => !reconciledKeys.has(matchKey(m))));
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      const commStr = commissioniTotal > 0
        ? ` · Commissioni SumUp generate: ${eur(commissioniTotal)}`
        : "";
      const payoutStr = payoutTotal > 0 ? ` · Payout generati: ${eur(payoutTotal)}` : "";
      toast({
        title: "Riconciliazione completata",
        description: `${ok} coppie riconciliate${fail ? `, ${fail} errori` : ""}${commStr}${payoutStr}`,
      });
      await reloadAll();
    } finally {
      setReconciling(false);
    }

  };

  const handleReconcileSelected = () => {
    const sel = matches.filter((m) => selected.has(matchKey(m)));
    if (sel.length === 0) return;
    reconcilePairs(sel);
  };

  const handleReconcileAll = () => {
    if (matches.length === 0) return;
    reconcilePairs(matches);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <GitMerge className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Riconciliazione Intelligente</h1>
          <p className="text-sm text-muted-foreground">Trova e riconcilia automaticamente i movimenti collegati con regole personalizzate</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="matches">Coppie trovate</TabsTrigger>
          <TabsTrigger value="rules">Regole</TabsTrigger>
        </TabsList>

        {/* TAB: COPPIE TROVATE */}
        <TabsContent value="matches" className="space-y-4">
          {commSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Controllo commissioni SumUp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Liquidazioni</div>
                    <div className="font-semibold">{commSummary.liquidazioni}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Totale incassato</div>
                    <div className="font-semibold">{eur(commSummary.incassato)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Commissioni pagate</div>
                    <div className="font-semibold text-destructive">{eur(commSummary.commTot)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Percentuale media</div>
                    <div className="font-semibold">{pct(commSummary.pctMedia)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Minima osservata</div>
                    <div className="font-semibold">{pct(commSummary.pctMin)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Massima osservata</div>
                    <div className="font-semibold">{pct(commSummary.pctMax)}</div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Ultimi 6 mesi</div>
                  {commSummary.mesi.map(([mese, v]) => (
                    <div key={mese} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{mese}</span>
                      <span className="text-muted-foreground">
                        Incassato {eur(v.incassato)} · Commissioni {eur(v.commissione)} ·{" "}
                        {pct(v.incassato > 0 ? (v.commissione / v.incassato) * 100 : 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>

            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button onClick={handleSearch} disabled={(findMut.isPending || aggMut.isPending)}>
                  {(findMut.isPending || aggMut.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Cerca corrispondenze
                </Button>
                {matches.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {matches.length} coppie trovate · {selected.size} selezionate
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleReconcileSelected}
                  disabled={selected.size === 0 || reconciling}
                >
                  {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
                  Riconcilia selezionate ({selected.size})
                </Button>
                <Button onClick={handleReconcileAll} disabled={matches.length === 0 || reconciling}>
                  {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
                  Riconcilia tutto
                </Button>
              </div>
            </CardContent>
          </Card>

          {sumupMatches.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 text-sm space-y-1">
                <div className="font-semibold">SumUp POS → Payout Postepay: {sumupMatches.length} coppie trovate</div>
                <div>
                  Incassi POS che restano nei ricavi:{" "}
                  <span className="font-semibold">
                    €{sumupIncassiTotal.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  Commissioni SumUp che verranno create:{" "}
                  <span className="font-semibold">
                    €{sumupCommissionTotal.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>{" "}
                  (categoria Commissioni SumUp)
                </div>
                <div>
                  Payout in uscita dal conto SumUp:{" "}
                  <span className="font-semibold">
                    €{sumupPayoutTotal.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>{" "}
                  (categoria Giroconti, esclusi dal bilancio)
                </div>
                <div className="text-xs text-muted-foreground">
                  La commissione è la differenza tra incassato e accreditato. Il payout azzera il saldo SumUp: i soldi si spostano sul conto di destinazione.
                </div>
              </CardContent>
            </Card>
          )}

          {((findMut.isPending || aggMut.isPending) || autoSearching) ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : matches.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Nessuna coppia trovata. Premi "Cerca corrispondenze" per rifare la ricerca con le regole attive.
              </CardContent>
            </Card>
          ) : null}


          {groupedMatches.map(([ruleName, list]) => (
            <Card key={ruleName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline">{list.length}</Badge>
                  {ruleName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.map((m) => {
                  const k = matchKey(m);
                  const isSel = selected.has(k);
                  return (
                    <div
                      key={k}
                      className={`border rounded-lg p-3 flex items-center gap-3 transition-colors ${isSel ? "bg-primary/5 border-primary/30" : ""}`}
                    >
                      <Checkbox checked={isSel} onCheckedChange={() => toggleSelect(m)} />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                        {/* Source */}
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{m.source_conto} · {format(new Date(m.source_date), "dd/MM/yy", { locale: it })}</div>
                          <div className="text-sm truncate font-medium">{m.source_desc || "—"}</div>
                          <div className="text-sm">{fmtAmount(m.source_amount, m.source_type)}</div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden md:block" />
                        {/* Dest */}
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{m.dest_conto} · {format(new Date(m.dest_date), "dd/MM/yy", { locale: it })}</div>
                          <div className="text-sm truncate font-medium">{m.dest_desc || "—"}</div>
                          <div className="text-sm">{fmtAmount(m.dest_amount, m.dest_type)}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`border ${scoreColor(Number(m.score))}`}>Score {Number(m.score).toFixed(0)}</Badge>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          Δ {m.giorni_distanza}g · {eur(Number(m.commissione_euro))} ·{" "}
                          <PercentBadge percentuale={Number(m.percentuale)} fuoriNorma={!!m.fuori_norma} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {/* ACCORPAMENTI */}
          {aggregates.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <Badge variant="outline">{aggregates.length}</Badge>
                  Bonifici che liquidano più incassi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aggregates.map((a) => {
                  const isSel = selectedAggs.has(a.dest_id);
                  return (
                    <div
                      key={a.dest_id}
                      className={`border rounded-lg p-3 space-y-2 transition-colors ${isSel ? "bg-primary/5 border-primary/30" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isSel} onCheckedChange={() => toggleAgg(a.dest_id)} />
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">
                              {a.source_conto} · {a.source_count} incassi
                            </div>
                            <div className="space-y-0.5 mt-1">
                              {a.sources.map((s) => (
                                <div key={s.id} className="flex justify-between gap-3 text-xs">
                                  <span className="text-muted-foreground">
                                    {format(new Date(s.date), "dd/MM/yy", { locale: it })}
                                  </span>
                                  <span className="font-medium">{eur(s.amount)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-1 border-t pt-1 flex justify-between gap-3 text-xs font-semibold">
                              <span>Totale incassi</span>
                              <span className="text-green-600">{eur(Number(a.source_totale))}</span>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden md:block" />
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">
                              {a.dest_conto} · {format(new Date(a.dest_date), "dd/MM/yy", { locale: it })}
                            </div>
                            <div className="text-sm truncate font-medium">{a.dest_desc || "—"}</div>
                            <div className="text-sm">{fmtAmount(a.dest_amount, "income")}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
                        <span>Commissione {eur(Number(a.commissione_euro))}</span>
                        <span>·</span>
                        <PercentBadge percentuale={Number(a.percentuale)} fuoriNorma={!!a.fuori_norma} />
                        <span>·</span>
                        <span>Δ {a.giorni}g</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleReconcileAggregates}
                    disabled={selectedAggs.size === 0 || reconcilingAggs}
                  >
                    {reconcilingAggs ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4 mr-2" />
                    )}
                    Riconcilia accorpamenti selezionati ({selectedAggs.size})
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>


        {/* TAB: REGOLE */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nuova regola
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Nessuna regola di riconciliazione. Crea la prima per iniziare.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Switch
                      checked={r.active}
                      onCheckedChange={(checked) => toggleMut.mutate({ id: r.id, active: checked })}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{r.name}</h3>
                        {!r.active && <Badge variant="secondary">Disattiva</Badge>}
                        {r.priority > 0 && <Badge variant="outline">Priorità {r.priority}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{ruleDescription(r, conti)}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingRule(r); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingRule(r); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ReconciliationRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        isSaving={createMut.isPending || updateMut.isPending}
        onSave={(data) => {
          if (editingRule) {
            updateMut.mutate({ id: editingRule.id, ...data }, {
              onSuccess: () => { setDialogOpen(false); toast({ title: "Regola aggiornata" }); },
              onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
            });
          } else {
            createMut.mutate(data, {
              onSuccess: () => { setDialogOpen(false); toast({ title: "Regola creata" }); },
              onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
            });
          }
        }}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Elimina regola"
        description={`Sei sicuro di voler eliminare la regola "${deletingRule?.name}"?`}
        onConfirm={() => {
          if (deletingRule) {
            deleteMut.mutate(deletingRule.id, {
              onSuccess: () => { setDeleteOpen(false); toast({ title: "Regola eliminata" }); },
              onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
            });
          }
        }}
      />
    </div>
  );
}
