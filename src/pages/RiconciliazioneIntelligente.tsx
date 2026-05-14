import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, GitMerge, Loader2, Search, CheckCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  ReconciliationRule,
  ReconciliationMatch,
} from "@/hooks/useReconciliationRules";
import { useReconcile } from "@/hooks/useReconciliation";
import { useConti } from "@/hooks/useConti";
import { toast } from "@/hooks/use-toast";

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

  const [tab, setTab] = useState("matches");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReconciliationRule | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<ReconciliationRule | null>(null);

  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState(false);

  const handleSearch = async () => {
    try {
      const data = await findMut.mutateAsync();
      setMatches(data);
      setSelected(new Set());
      toast({ title: "Ricerca completata", description: `${data.length} coppie trovate` });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

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

  const reconcilePairs = async (pairs: ReconciliationMatch[]) => {
    setReconciling(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const p of pairs) {
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
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      toast({
        title: "Riconciliazione completata",
        description: `${ok} coppie riconciliate${fail ? `, ${fail} errori` : ""}`,
      });
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
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button onClick={handleSearch} disabled={findMut.isPending}>
                  {findMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
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

          {matches.length === 0 && !findMut.isPending && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Nessuna coppia trovata. Premi "Cerca corrispondenze" per avviare la ricerca con le regole attive.
              </CardContent>
            </Card>
          )}

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
                        <span className="text-[10px] text-muted-foreground">
                          Δ {m.giorni_distanza}g · Δ€{Number(m.differenza_euro).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
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
