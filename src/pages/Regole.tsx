import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Play, Zap, Loader2, AlertTriangle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { RuleDialog } from "@/components/RuleDialog";
import {
  useCategorizationRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
  useApplyRuleToExisting,
  useRuleMatchCounts,
  countRuleMatches,
  CategorizationRule,
} from "@/hooks/useCategorizationRules";
import { useCategories } from "@/hooks/useCategories";
import { useConti } from "@/hooks/useConti";
import { toast } from "@/hooks/use-toast";

export default function Regole() {
  const { data: rules = [], isLoading } = useCategorizationRules();
  const { data: categories = [] } = useCategories();
  const { data: conti = [] } = useConti();
  const { data: matchCounts = {} } = useRuleMatchCounts(rules);
  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();
  const deleteMutation = useDeleteRule();
  const toggleMutation = useToggleRule();
  const applyMutation = useApplyRuleToExisting();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<CategorizationRule | null>(null);

  // Confirmation dialog state
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<CategorizationRule | null>(null);
  const [applyCount, setApplyCount] = useState<number | null>(null);
  const [countingMatches, setCountingMatches] = useState(false);

  // Bulk apply state
  const [bulkApplying, setBulkApplying] = useState(false);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  const handleBulkApply = async () => {
    setConfirmBulkOpen(false);
    setBulkApplying(true);
    const activeRules = [...rules]
      .filter((r) => r.active)
      .sort((a, b) => (b.priority - a.priority) || a.created_at.localeCompare(b.created_at));
    let totalUpdated = 0;
    const perRule: Record<string, number> = {};
    try {
      for (const rule of activeRules) {
        try {
          const n = await applyMutation.mutateAsync(rule);
          perRule[rule.name] = n;
          totalUpdated += n;
        } catch (e) {
          console.error("[Bulk Apply] errore regola", rule.name, e);
        }
      }
      console.log("[Bulk Apply] Risultati per regola:", perRule);
      console.log("[Bulk Apply] Totale aggiornati:", totalUpdated);
      toast({
        title: "Regole applicate",
        description: `${totalUpdated} moviment${totalUpdated === 1 ? "o aggiornato" : "i aggiornati"} su ${activeRules.length} regol${activeRules.length === 1 ? "a" : "e"}.`,
      });
    } finally {
      setBulkApplying(false);
    }
  };

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const contoMap = useMemo(() => {
    const m = new Map<string, string>();
    conti.forEach((c) => m.set(c.id, c.nome_conto));
    return m;
  }, [conti]);

  const incomeRules = rules.filter((r) => r.match_type === "income");
  const expenseRules = rules.filter((r) => r.match_type === "expense");
  const bothRules = rules.filter((r) => r.match_type === "both");

  const handleSave = async (data: any) => {
    try {
      if (selectedRule) {
        await updateMutation.mutateAsync({ id: selectedRule.id, ...data });
        toast({ title: "Regola aggiornata" });
      } else {
        const created = await createMutation.mutateAsync(data);
        // Build a complete rule object merging DB response with our data
        // to ensure all fields (keywords, exclude_keywords, etc.) are correct
        const fullRule: CategorizationRule = {
          id: created.id,
          user_id: created.user_id,
          name: data.name,
          keywords: data.keywords || [],
          exclude_keywords: data.exclude_keywords || [],
          match_type: data.match_type,
          conto_id: data.conto_id,
          category_id: data.category_id,
          priority: data.priority,
          apply_to_categorized: data.apply_to_categorized,
          active: data.active,
          created_at: created.created_at,
          updated_at: created.updated_at,
        };
        console.log("[Regole] Created rule, applying to existing:", fullRule);
        // Auto-apply the new rule to existing transactions
        if (fullRule.active) {
          try {
            const count = await applyMutation.mutateAsync(fullRule);
            toast({ title: `Regola creata e categoria assegnata a ${count} moviment${count === 1 ? "o" : "i"}` });
          } catch (applyErr) {
            console.error("[Regole] Apply error:", applyErr);
            toast({ title: "Regola creata ma errore nell'applicazione automatica", variant: "destructive" });
          }
        } else {
          toast({ title: "Regola creata (disattivata, non applicata)" });
        }
      }
      setDialogOpen(false);
      setSelectedRule(null);
    } catch {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    }
  };

  const handleRequestApply = async (rule: CategorizationRule) => {
    if (!rule.active) {
      toast({ title: "La regola è disattivata. Attivala prima di applicarla.", variant: "destructive" });
      return;
    }
    setApplyTarget(rule);
    setApplyCount(null);
    setCountingMatches(true);
    setConfirmApplyOpen(true);
    try {
      const count = await countRuleMatches(rule);
      setApplyCount(count);
    } catch {
      setApplyCount(0);
    } finally {
      setCountingMatches(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!applyTarget) return;
    try {
      const count = await applyMutation.mutateAsync(applyTarget);
      toast({ title: `Regola applicata a ${count} moviment${count === 1 ? "o" : "i"}` });
    } catch {
      toast({ title: "Errore nell'applicazione", variant: "destructive" });
    }
    setConfirmApplyOpen(false);
    setApplyTarget(null);
  };

  const handleApplyFromDialog = async () => {
    if (!selectedRule) return;
    setDialogOpen(false);
    handleRequestApply(selectedRule);
  };

  const handleDelete = async () => {
    if (!selectedRule) return;
    try {
      await deleteMutation.mutateAsync(selectedRule.id);
      toast({ title: "Regola eliminata" });
      setDeleteOpen(false);
      setSelectedRule(null);
    } catch {
      toast({ title: "Errore nell'eliminazione", variant: "destructive" });
    }
  };

  const handleToggle = async (rule: CategorizationRule) => {
    try {
      await toggleMutation.mutateAsync({ id: rule.id, active: !rule.active });
      toast({ title: rule.active ? "Regola disattivata" : "Regola attivata" });
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 100) return <Badge className="bg-destructive text-destructive-foreground font-bold">{priority}</Badge>;
    if (priority >= 50) return <Badge className="bg-primary text-primary-foreground font-semibold">{priority}</Badge>;
    if (priority >= 10) return <Badge variant="secondary" className="font-medium">{priority}</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">{priority}</Badge>;
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case "income": return <Badge variant="outline" className="text-success border-success/30">Entrata</Badge>;
      case "expense": return <Badge variant="outline" className="text-destructive border-destructive/30">Uscita</Badge>;
      default: return <Badge variant="outline">Entrambi</Badge>;
    }
  };

  const renderRuleTable = (rulesList: CategorizationRule[]) => {
    if (rulesList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nessuna regola in questa sezione</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">Priorità</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Parole chiave</TableHead>
              <TableHead>Conto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="w-[80px] text-center">Match</TableHead>
              <TableHead className="w-[60px]">Stato</TableHead>
              <TableHead className="w-[120px]">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rulesList.map((rule) => (
              <TableRow key={rule.id} className={!rule.active ? "opacity-50" : ""}>
                <TableCell className="text-center">
                  {getPriorityBadge(rule.priority)}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{rule.name}</span>
                    {rule.apply_to_categorized && (
                      <span className="text-[10px] text-muted-foreground">Sovrascrive categoria</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getMatchTypeLabel(rule.match_type)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {rule.keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs font-mono">{kw}</Badge>
                    ))}
                    {(rule.exclude_keywords || []).map((kw) => (
                      <Badge key={`ex-${kw}`} variant="destructive" className="text-xs font-mono">−{kw}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {rule.conto_id ? contoMap.get(rule.conto_id) || "-" : <span className="text-muted-foreground">Tutti</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{categoryMap.get(rule.category_id) || "-"}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`text-sm font-medium ${(matchCounts[rule.id] || 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {matchCounts[rule.id] ?? "…"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Movimenti attualmente corrispondenti</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.active}
                    onCheckedChange={() => handleToggle(rule)}
                    disabled={toggleMutation.isPending}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRequestApply(rule)}
                          disabled={applyMutation.isPending || !rule.active}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Applica ai movimenti esistenti</TooltipContent>
                    </Tooltip>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedRule(rule); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedRule(rule); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Regole di categorizzazione</h1>
          <p className="text-muted-foreground mt-1">
            Automatizza la classificazione dei movimenti con regole personalizzate
          </p>
        </div>
        <Button className="gap-2" onClick={() => { setSelectedRule(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova Regola</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-muted-foreground">{rules.length} regol{rules.length === 1 ? "a" : "e"} totali</span>
        <span className="text-success font-medium">{rules.filter((r) => r.active).length} attive</span>
        <span className="text-muted-foreground">{rules.filter((r) => !r.active).length} disattivate</span>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tutte ({rules.length})</TabsTrigger>
          <TabsTrigger value="income">Entrate ({incomeRules.length})</TabsTrigger>
          <TabsTrigger value="expense">Uscite ({expenseRules.length})</TabsTrigger>
          <TabsTrigger value="both">Entrambi ({bothRules.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">{renderRuleTable(rules)}</TabsContent>
        <TabsContent value="income" className="mt-4">{renderRuleTable(incomeRules)}</TabsContent>
        <TabsContent value="expense" className="mt-4">{renderRuleTable(expenseRules)}</TabsContent>
        <TabsContent value="both" className="mt-4">{renderRuleTable(bothRules)}</TabsContent>
      </Tabs>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedRule(null); }}
        onSave={handleSave}
        onApplyToExisting={selectedRule ? handleApplyFromDialog : undefined}
        isSaving={createMutation.isPending || updateMutation.isPending}
        rule={selectedRule}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => { setDeleteOpen(open); if (!open) setSelectedRule(null); }}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />

      {/* Confirmation dialog for applying rule */}
      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Conferma applicazione regola
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-2">
                {applyTarget && (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Regola:</span>
                      <span className="font-medium">{applyTarget.name}</span>
                      <span className="text-muted-foreground">Categoria:</span>
                      <span className="font-medium">{categoryMap.get(applyTarget.category_id) || "-"}</span>
                      <span className="text-muted-foreground">Sovrascrive già categorizzati:</span>
                      <span className="font-medium">{applyTarget.apply_to_categorized ? "Sì" : "No"}</span>
                    </div>
                    <div className="rounded-md bg-muted px-3 py-2 text-sm">
                      {countingMatches ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Conteggio movimenti in corso...
                        </span>
                      ) : (
                        <span className="font-semibold">
                          {applyCount === 0
                            ? "Nessun movimento corrisponde a questa regola."
                            : `${applyCount} moviment${applyCount === 1 ? "o verrà aggiornato" : "i verranno aggiornati"}.`
                          }
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApply}
              disabled={countingMatches || applyCount === 0 || applyMutation.isPending}
            >
              {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Applica
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
