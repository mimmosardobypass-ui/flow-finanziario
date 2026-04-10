import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Play, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { RuleDialog } from "@/components/RuleDialog";
import {
  useCategorizationRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
  useApplyRuleToExisting,
  CategorizationRule,
} from "@/hooks/useCategorizationRules";
import { useCategories } from "@/hooks/useCategories";
import { useConti } from "@/hooks/useConti";
import { toast } from "@/hooks/use-toast";

export default function Regole() {
  const { data: rules = [], isLoading } = useCategorizationRules();
  const { data: categories = [] } = useCategories();
  const { data: conti = [] } = useConti();
  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();
  const deleteMutation = useDeleteRule();
  const toggleMutation = useToggleRule();
  const applyMutation = useApplyRuleToExisting();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<CategorizationRule | null>(null);

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
        await createMutation.mutateAsync(data);
        toast({ title: "Regola creata" });
      }
      setDialogOpen(false);
      setSelectedRule(null);
    } catch {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    }
  };

  const handleApplyToExisting = async () => {
    if (!selectedRule) return;
    try {
      const count = await applyMutation.mutateAsync(selectedRule);
      toast({ title: `Regola applicata a ${count} moviment${count === 1 ? "o" : "i"}` });
    } catch {
      toast({ title: "Errore nell'applicazione", variant: "destructive" });
    }
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
              <TableHead>Priorità</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Parole chiave</TableHead>
              <TableHead>Conto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-[140px]">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rulesList.map((rule) => (
              <TableRow key={rule.id} className={!rule.active ? "opacity-50" : ""}>
                <TableCell>
                  <Badge variant="outline">{rule.priority}</Badge>
                </TableCell>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {rule.keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{rule.conto_id ? contoMap.get(rule.conto_id) || "-" : "Tutti"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{categoryMap.get(rule.category_id) || "-"}</Badge>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Applica ai movimenti esistenti"
                      onClick={() => {
                        applyMutation.mutate(rule, {
                          onSuccess: (count) => toast({ title: `Applicata a ${count} movimenti` }),
                          onError: () => toast({ title: "Errore", variant: "destructive" }),
                        });
                      }}
                      disabled={applyMutation.isPending}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setSelectedRule(rule); setDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setSelectedRule(rule); setDeleteOpen(true); }}
                    >
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

      {/* Summary */}
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

        <TabsContent value="all" className="mt-4">
          {renderRuleTable(rules)}
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          {renderRuleTable(incomeRules)}
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          {renderRuleTable(expenseRules)}
        </TabsContent>
        <TabsContent value="both" className="mt-4">
          {renderRuleTable(bothRules)}
        </TabsContent>
      </Tabs>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedRule(null); }}
        onSave={handleSave}
        onApplyToExisting={selectedRule ? handleApplyToExisting : undefined}
        isSaving={createMutation.isPending || updateMutation.isPending}
        rule={selectedRule}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => { setDeleteOpen(open); if (!open) setSelectedRule(null); }}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
