import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useCategories } from "@/hooks/useCategories";
import { useConti } from "@/hooks/useConti";
import { useRulePreview, CategorizationRule } from "@/hooks/useCategorizationRules";

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (rule: {
    name: string;
    keywords: string[];
    match_type: "income" | "expense" | "both";
    conto_id: string | null;
    category_id: string;
    priority: number;
    apply_to_categorized: boolean;
    active: boolean;
  }) => void;
  onApplyToExisting?: () => void;
  isSaving?: boolean;
  rule?: CategorizationRule | null;
}

export function RuleDialog({ open, onOpenChange, onSave, onApplyToExisting, isSaving, rule }: RuleDialogProps) {
  const { data: categories = [] } = useCategories();
  const { data: conti = [] } = useConti();

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [matchType, setMatchType] = useState<"income" | "expense" | "both">("both");
  const [contoId, setContoId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState(0);
  const [applyToCategorized, setApplyToCategorized] = useState(false);
  const [active, setActive] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const { data: preview = [], isLoading: previewLoading } = useRulePreview(
    showPreview ? keywords : [],
    matchType,
    contoId
  );

  useEffect(() => {
    if (open) {
      if (rule) {
        setName(rule.name);
        setKeywords(rule.keywords || []);
        setMatchType(rule.match_type as any);
        setContoId(rule.conto_id);
        setCategoryId(rule.category_id);
        setPriority(rule.priority);
        setApplyToCategorized(rule.apply_to_categorized);
        setActive(rule.active);
      } else {
        setName("");
        setKeywords([]);
        setKeywordInput("");
        setMatchType("both");
        setContoId(null);
        setCategoryId("");
        setPriority(0);
        setApplyToCategorized(false);
        setActive(true);
      }
      setShowPreview(false);
    }
  }, [open, rule]);

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords((prev) => [...prev, kw]);
    }
    setKeywordInput("");
  };

  // Auto-add pending keyword before save or preview
  const flushKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      const next = [...keywords, kw];
      setKeywords(next);
      setKeywordInput("");
      return next;
    }
    return keywords;
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  // Build category options with hierarchy
  const parentCategories = categories.filter((c) => !c.parent_id);
  const getCategoryOptions = () => {
    const options: { value: string; label: string; indent: boolean }[] = [];
    parentCategories.forEach((parent) => {
      options.push({ value: parent.id, label: parent.name, indent: false });
      const children = categories.filter((c) => c.parent_id === parent.id);
      children.forEach((child) => {
        options.push({ value: child.id, label: child.name, indent: true });
      });
    });
    return options;
  };

  const hasKeywords = keywords.length > 0 || keywordInput.trim().length > 0;
  const canSave = name.trim() && hasKeywords && categoryId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{rule ? "Modifica Regola" : "Nuova Regola"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5 pb-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Nome regola</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Bonifici stipendio" />
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label>Parole chiave (la descrizione deve contenere almeno una)</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Aggiungi parola chiave..."
                  onBlur={addKeyword}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Match type */}
              <div className="space-y-2">
                <Label>Tipo movimento</Label>
                <Select value={matchType} onValueChange={(v) => setMatchType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Entrambi</SelectItem>
                    <SelectItem value="income">Entrate</SelectItem>
                    <SelectItem value="expense">Uscite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conto */}
              <div className="space-y-2">
                <Label>Conto</Label>
                <Select value={contoId || "__all__"} onValueChange={(v) => setContoId(v === "__all__" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutti i conti</SelectItem>
                    {conti.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_conto}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Categoria da assegnare</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Seleziona categoria..." /></SelectTrigger>
                <SelectContent>
                  {getCategoryOptions().map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.indent ? `  ↳ ${opt.label}` : opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-2">
                <Label>Priorità (più alto = prima)</Label>
                <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Applica anche a movimenti già categorizzati</Label>
                <Switch checked={applyToCategorized} onCheckedChange={setApplyToCategorized} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Regola attiva</Label>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>

            <Separator />

            {/* Preview */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => { flushKeyword(); setShowPreview(!showPreview); }}
                disabled={!hasKeywords}
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Nascondi anteprima" : "Anteprima movimenti corrispondenti"}
              </Button>

              {showPreview && (
                <Card className="border-dashed">
                  <CardContent className="p-3">
                    {previewLoading ? (
                      <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Ricerca in corso...
                      </div>
                    ) : preview.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nessun movimento corrispondente trovato
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-medium mb-2">
                          {preview.length} moviment{preview.length === 1 ? "o" : "i"} corrispondent{preview.length === 1 ? "e" : "i"}
                        </p>
                        <ScrollArea className="max-h-48">
                          <div className="space-y-1">
                            {preview.map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50">
                                <div className="flex-1 min-w-0 mr-3">
                                  <span className="text-muted-foreground mr-2">
                                    {format(new Date(t.date), "dd/MM/yy", { locale: it })}
                                  </span>
                                  <span className="truncate">{t.description || "-"}</span>
                                </div>
                                <span className={`font-medium whitespace-nowrap ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                                  {t.type === "income" ? "+" : "-"}€{Number(t.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4">
          {rule && onApplyToExisting && (
            <Button type="button" variant="outline" onClick={onApplyToExisting}>
              Applica ai movimenti esistenti
            </Button>
          )}
          <Button onClick={() => {
            const finalKeywords = flushKeyword();
            onSave({
              name: name.trim(),
              keywords: finalKeywords,
              match_type: matchType,
              conto_id: contoId,
              category_id: categoryId,
              priority,
              apply_to_categorized: applyToCategorized,
              active,
            });
          }} disabled={!canSave || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {rule ? "Salva modifiche" : "Crea regola"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
