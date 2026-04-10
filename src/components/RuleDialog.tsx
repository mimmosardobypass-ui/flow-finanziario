import { useState, useEffect, useMemo } from "react";
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
import { X, Plus, Loader2, Ban } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useCategories } from "@/hooks/useCategories";
import { useConti } from "@/hooks/useConti";
import { useRulePreview, CategorizationRule, normalize, matchesExcludeKeywords } from "@/hooks/useCategorizationRules";

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (rule: {
    name: string;
    keywords: string[];
    exclude_keywords: string[];
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

/** Highlight matched keyword stems in a description */
function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (!text || keywords.length === 0) return text;
  // Build stems from all keyword words
  const stems = keywords
    .flatMap(kw => normalize(kw).split(" ").filter(w => w.length > 0))
    .map(w => (w.length >= 4 ? w.slice(0, -1) : w))
    .filter(s => s.length > 0);
  if (stems.length === 0) return text;
  const pattern = new RegExp(`(${stems.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{part}</mark> : part
  );
}

export function RuleDialog({ open, onOpenChange, onSave, onApplyToExisting, isSaving, rule }: RuleDialogProps) {
  const { data: categories = [] } = useCategories();
  const { data: conti = [] } = useConti();

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [excludeInput, setExcludeInput] = useState("");
  const [matchType, setMatchType] = useState<"income" | "expense" | "both">("both");
  const [contoId, setContoId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState(0);
  const [applyToCategorized, setApplyToCategorized] = useState(false);
  const [active, setActive] = useState(true);
  const [debouncedInput, setDebouncedInput] = useState("");
  const [debouncedExclude, setDebouncedExclude] = useState("");

  // Debounce the keyword input for live preview (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(keywordInput), 400);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedExclude(excludeInput), 400);
    return () => clearTimeout(timer);
  }, [excludeInput]);

  // Combine saved keywords + pending typed input for live preview
  const previewKeywords = useMemo(() => {
    const all = [...keywords];
    const pending = debouncedInput.trim();
    if (pending && !all.includes(pending)) all.push(pending);
    return all;
  }, [keywords, debouncedInput]);

  const previewExcludeKeywords = useMemo(() => {
    const all = [...excludeKeywords];
    const pending = debouncedExclude.trim();
    if (pending && !all.includes(pending)) all.push(pending);
    return all;
  }, [excludeKeywords, debouncedExclude]);

  const hasPreviewKeywords = previewKeywords.some(k => k.trim().length > 0);

  const { data: preview = [], isLoading: previewLoading } = useRulePreview(
    hasPreviewKeywords ? previewKeywords : [],
    matchType,
    contoId,
    previewExcludeKeywords
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
      setDebouncedInput("");
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

            {/* Live Preview */}
            <div className="space-y-2">
              {hasPreviewKeywords && (
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
                        <p className="text-sm font-medium mb-3">
                          {preview.length} moviment{preview.length === 1 ? "o" : "i"} corrispondent{preview.length === 1 ? "e" : "i"}
                        </p>
                        <ScrollArea className="max-h-64">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b text-muted-foreground">
                                <th className="text-left py-1.5 px-2 font-medium w-[72px]">Data</th>
                                <th className="text-left py-1.5 px-2 font-medium">Descrizione</th>
                                <th className="text-right py-1.5 px-2 font-medium w-[90px]">Importo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.map((t: any) => (
                                <tr key={t.id} className="border-b border-border/40 hover:bg-muted/50">
                                  <td className="py-2 px-2 text-muted-foreground whitespace-nowrap align-top">
                                    {format(new Date(t.date), "dd/MM/yy", { locale: it })}
                                  </td>
                                  <td className="py-2 px-2 break-words whitespace-pre-wrap align-top">
                                    {highlightKeywords(t.description || "-", previewKeywords)}
                                  </td>
                                  <td className={`py-2 px-2 text-right font-medium whitespace-nowrap align-top ${t.type === "income" ? "text-green-600" : "text-destructive"}`}>
                                    {t.type === "income" ? "+" : "−"}€{Number(t.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
