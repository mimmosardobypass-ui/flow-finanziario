import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Loader2 } from "lucide-react";
import { useConti } from "@/hooks/useConti";
import { ReconciliationRule, ReconciliationRuleInsert } from "@/hooks/useReconciliationRules";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rule?: ReconciliationRule | null;
  onSave: (r: ReconciliationRuleInsert) => void;
  isSaving?: boolean;
}

type TipoMov = "income" | "expense" | "any";

export function ReconciliationRuleDialog({ open, onOpenChange, rule, onSave, isSaving }: Props) {
  const { data: conti = [] } = useConti();

  const [name, setName] = useState("");
  const [contoOrigine, setContoOrigine] = useState<string | null>(null);
  const [keywordsOrigine, setKeywordsOrigine] = useState<string[]>([]);
  const [kwOrigInput, setKwOrigInput] = useState("");
  const [typeOrigine, setTypeOrigine] = useState<TipoMov>("any");
  const [contoDest, setContoDest] = useState<string | null>(null);
  const [keywordsDest, setKeywordsDest] = useState<string[]>([]);
  const [kwDestInput, setKwDestInput] = useState("");
  const [typeDest, setTypeDest] = useState<TipoMov>("any");
  const [importoMatch, setImportoMatch] = useState<"exact" | "percent">("exact");
  const [commissione, setCommissione] = useState(0);
  const [tolleranza, setTolleranza] = useState(0.05);
  const [giorniMin, setGiorniMin] = useState(0);
  const [giorniMax, setGiorniMax] = useState(3);
  const [priority, setPriority] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (rule) {
      setName(rule.name);
      setContoOrigine(rule.conto_origine_id);
      setKeywordsOrigine(rule.keywords_origine || []);
      setTypeOrigine((rule.type_origine as TipoMov) || "any");
      setContoDest(rule.conto_dest_id);
      setKeywordsDest(rule.keywords_dest || []);
      setTypeDest((rule.type_dest as TipoMov) || "any");
      setImportoMatch((rule.importo_match as "exact" | "percent") || "exact");
      setCommissione(Number(rule.commissione_percent) || 0);
      setTolleranza(Number(rule.tolleranza_euro) || 0);
      setGiorniMin(rule.giorni_min);
      setGiorniMax(rule.giorni_max);
      setPriority(rule.priority);
      setActive(rule.active);
    } else {
      setName(""); setContoOrigine(null); setKeywordsOrigine([]); setKwOrigInput("");
      setTypeOrigine("any"); setContoDest(null); setKeywordsDest([]); setKwDestInput("");
      setTypeDest("any"); setImportoMatch("exact"); setCommissione(0); setTolleranza(0.05);
      setGiorniMin(0); setGiorniMax(3); setPriority(0); setActive(true);
    }
  }, [open, rule]);

  const addKw = (val: string, list: string[], setList: (v: string[]) => void, setInput: (s: string) => void) => {
    const k = val.trim();
    if (k && !list.includes(k)) setList([...list, k]);
    setInput("");
  };

  const flushKw = (val: string, list: string[]): string[] => {
    const k = val.trim();
    if (k && !list.includes(k)) return [...list, k];
    return list;
  };

  const canSave = name.trim().length > 0 && (keywordsOrigine.length > 0 || kwOrigInput.trim().length > 0);

  const handleSave = () => {
    const finalOrig = flushKw(kwOrigInput, keywordsOrigine);
    const finalDest = flushKw(kwDestInput, keywordsDest);
    onSave({
      name: name.trim(),
      conto_origine_id: contoOrigine,
      keywords_origine: finalOrig,
      type_origine: typeOrigine,
      conto_dest_id: contoDest,
      keywords_dest: finalDest,
      type_dest: typeDest,
      importo_match: importoMatch,
      commissione_percent: importoMatch === "percent" ? commissione : 0,
      tolleranza_euro: importoMatch === "percent" ? tolleranza : 0,
      giorni_min: giorniMin,
      giorni_max: giorniMax,
      reconciliation_type: "transfer",
      active,
      priority,
    });
  };

  const KwField = ({ value, onChange, list, setList, placeholder }: any) => (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onBlur={() => addKw(value, list, setList, onChange)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(value, list, setList, onChange); } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => addKw(value, list, setList, onChange)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((kw: string) => (
            <Badge key={kw} variant="secondary" className="gap-1 pr-1">
              {kw}
              <button onClick={() => setList(list.filter((k: string) => k !== kw))} className="ml-1 hover:bg-muted rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{rule ? "Modifica regola di riconciliazione" : "Nuova regola di riconciliazione"}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Nome regola</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. SumUp → Postepay" />
            </div>

            <Separator />
            <h4 className="font-semibold text-sm">Movimento origine</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Conto origine</Label>
                <Select value={contoOrigine || "__all__"} onValueChange={(v) => setContoOrigine(v === "__all__" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Qualsiasi</SelectItem>
                    {conti.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_conto}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo origine</Label>
                <Select value={typeOrigine} onValueChange={(v) => setTypeOrigine(v as TipoMov)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualsiasi</SelectItem>
                    <SelectItem value="income">Entrata</SelectItem>
                    <SelectItem value="expense">Uscita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Parole chiave origine</Label>
              <KwField
                value={kwOrigInput} onChange={setKwOrigInput}
                list={keywordsOrigine} setList={setKeywordsOrigine}
                placeholder="es. SUMUP"
              />
            </div>

            <Separator />
            <h4 className="font-semibold text-sm">Movimento destinazione</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Conto destinazione</Label>
                <Select value={contoDest || "__all__"} onValueChange={(v) => setContoDest(v === "__all__" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Qualsiasi</SelectItem>
                    {conti.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_conto}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo destinazione</Label>
                <Select value={typeDest} onValueChange={(v) => setTypeDest(v as TipoMov)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualsiasi</SelectItem>
                    <SelectItem value="income">Entrata</SelectItem>
                    <SelectItem value="expense">Uscita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Parole chiave destinazione</Label>
              <KwField
                value={kwDestInput} onChange={setKwDestInput}
                list={keywordsDest} setList={setKeywordsDest}
                placeholder="es. POSTEPAY"
              />
            </div>

            <Separator />
            <h4 className="font-semibold text-sm">Corrispondenza importo</h4>

            <div className="space-y-2">
              <Select value={importoMatch} onValueChange={(v) => setImportoMatch(v as "exact" | "percent")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Esatto</SelectItem>
                  <SelectItem value="percent">Con commissione %</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {importoMatch === "percent" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Commissione %</Label>
                  <Input type="number" step="0.01" value={commissione} onChange={(e) => setCommissione(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Tolleranza €</Label>
                  <Input type="number" step="0.01" value={tolleranza} onChange={(e) => setTolleranza(Number(e.target.value))} />
                </div>
              </div>
            )}

            <Separator />
            <h4 className="font-semibold text-sm">Finestra temporale</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Giorni minimo</Label>
                <Input type="number" value={giorniMin} onChange={(e) => setGiorniMin(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Giorni massimo</Label>
                <Input type="number" value={giorniMax} onChange={(e) => setGiorniMax(Number(e.target.value))} />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priorità</Label>
                <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
              </div>
              <div className="flex items-end justify-between">
                <Label>Regola attiva</Label>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {rule ? "Salva modifiche" : "Crea regola"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
