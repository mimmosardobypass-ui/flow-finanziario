import { useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2, Search, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TransactionWithCategory } from "@/hooks/useTransactions";
import {
  useDocumentiPerMovimento,
  useCombinazioniDocumenti,
  useAssociaDocumentiMovimento,
  DocumentoPerMovimento,
} from "@/hooks/useDocumentiMovimento";
import { useDissociaDocumento } from "@/hooks/useFattureFornitori";

const eur = (n: number) =>
  `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const fdate = (d: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy", { locale: it }) : "—";

interface Props {
  transaction: TransactionWithCategory;
  onDone?: () => void;
}

export function DocumentiMovimentoTab({ transaction, onDone }: Props) {
  const [query, setQuery] = useState("");
  const [includiAssociati, setIncludiAssociati] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [splitOpen, setSplitOpen] = useState<Record<string, boolean>>({});

  const { data: documenti = [], isLoading } = useDocumentiPerMovimento(
    transaction.id,
    query,
    includiAssociati,
  );
  const { data: combinazioni = [] } = useCombinazioniDocumenti(transaction.id);
  const associa = useAssociaDocumentiMovimento();
  const dissocia = useDissociaDocumento();

  const docMap = useMemo(() => {
    const m = new Map<string, DocumentoPerMovimento>();
    documenti.forEach((d) => m.set(d.fattura_id, d));
    return m;
  }, [documenti]);

  const isSelected = (d: DocumentoPerMovimento) =>
    selected[d.fattura_id] !== undefined || (d.gia_associato && selected[d.fattura_id] !== -1);

  const importoOf = (d: DocumentoPerMovimento) => {
    const v = selected[d.fattura_id];
    return v !== undefined && v >= 0 ? v : Math.abs(d.effetto);
  };

  const toggle = (d: DocumentoPerMovimento, on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (on) next[d.fattura_id] = Math.abs(d.effetto);
      else if (d.gia_associato) next[d.fattura_id] = -1;
      else delete next[d.fattura_id];
      return next;
    });
  };

  const selectedDocs = useMemo(
    () => documenti.filter((d) => isSelected(d)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documenti, selected],
  );

  const sommaEffetti = selectedDocs.reduce(
    (s, d) => s + (d.effetto >= 0 ? 1 : -1) * importoOf(d),
    0,
  );
  const residuoMovimento = Math.round((Math.abs(transaction.amount) - sommaEffetti) * 100) / 100;

  const nDebito = selectedDocs.filter((d) => d.tipo !== "Nota Credito").length;
  const nCredito = selectedDocs.filter((d) => d.tipo === "Nota Credito").length;

  const suggeriti = documenti.filter((d) => d.suggerito);
  const altri = documenti.filter((d) => !d.suggerito);

  const gruppi = (list: DocumentoPerMovimento[]) => {
    const map = new Map<string, DocumentoPerMovimento[]>();
    list.forEach((d) => {
      const k = d.controparte ?? "—";
      map.set(k, [...(map.get(k) ?? []), d]);
    });
    return Array.from(map.entries());
  };

  const combinazione = combinazioni[0];
  const combinazioneSelezionata =
    !!combinazione && combinazione.out_ids.every((id) => selected[id] !== undefined && selected[id] >= 0);

  const toggleCombinazione = (on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      combinazione?.out_ids.forEach((id) => {
        const d = docMap.get(id);
        if (on) next[id] = d ? Math.abs(d.effetto) : 0;
        else delete next[id];
      });
      return next;
    });
  };

  const handleConferma = async () => {
    const docs = selectedDocs.filter((d) => !d.gia_associato || selected[d.fattura_id] >= 0);
    if (!docs.length) return;
    await associa.mutateAsync({
      transaction_id: transaction.id,
      fattura_ids: docs.map((d) => d.fattura_id),
      importi: docs.map((d) => importoOf(d)),
    });
    setSelected({});
    setSplitOpen({});
    onDone?.();
  };

  const handleStacca = async (d: DocumentoPerMovimento) => {
    await dissocia.mutateAsync({ fattura_id: d.fattura_id, transaction_id: transaction.id });
    setSelected((prev) => {
      const next = { ...prev };
      delete next[d.fattura_id];
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Movimento selezionato */}
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Movimento selezionato</p>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium break-words">{transaction.description || "—"}</p>
              <p className="text-sm text-muted-foreground">
                {transaction.conti?.nome_conto} · {fdate(transaction.date)}
              </p>
            </div>
            <span
              className={`font-semibold whitespace-nowrap ${
                transaction.type === "income" ? "text-success" : "text-destructive"
              }`}
            >
              {transaction.type === "income" ? "+" : "−"}
              {eur(Math.abs(transaction.amount))}
            </span>
          </div>
        </div>

        {/* Ricerca */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cerca azienda o numero di documento"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="includi-associati"
              checked={includiAssociati}
              onCheckedChange={setIncludiAssociati}
            />
            <Label htmlFor="includi-associati" className="text-sm font-normal">
              Mostra anche documenti già associati
            </Label>
          </div>
        </div>

        {/* Combinazione esatta */}
        {combinazione && (
          <div
            className="rounded-lg p-3 space-y-1"
            style={{ border: "1px solid #c7d7fe", background: "#eff4ff" }}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={combinazioneSelezionata}
                onCheckedChange={(v) => toggleCombinazione(!!v)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {combinazione.out_ids.length} documenti che coprono esattamente il movimento
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {combinazione.out_controparte} · {combinazione.out_numeri.join(", ")}
                </p>
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">
                {eur(combinazione.out_somma)}
              </span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento documenti…
          </div>
        )}

        {!isLoading && documenti.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun documento aperto trovato.</p>
        )}

        {[
          { title: "Suggeriti", list: suggeriti },
          { title: "Altri documenti aperti", list: altri },
        ].map(({ title, list }) =>
          list.length ? (
            <div key={title} className="space-y-3">
              <p className="text-sm font-semibold">{title}</p>
              {gruppi(list).map(([controparte, docs]) => (
                <div key={controparte} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
                    <p className="text-sm font-medium truncate">{controparte}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      saldo partite aperte {eur(docs.reduce((s, d) => s + d.effetto, 0))}
                    </p>
                  </div>
                  {docs.map((d) => (
                    <DocRow
                      key={d.fattura_id}
                      doc={d}
                      selected={isSelected(d)}
                      importo={importoOf(d)}
                      splitOpen={!!splitOpen[d.fattura_id]}
                      onToggle={(on) => toggle(d, on)}
                      onToggleSplit={() =>
                        setSplitOpen((p) => ({ ...p, [d.fattura_id]: !p[d.fattura_id] }))
                      }
                      onImporto={(v) => setSelected((p) => ({ ...p, [d.fattura_id]: v }))}
                      onStacca={() => handleStacca(d)}
                      staccaPending={dissocia.isPending}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null,
        )}
      </div>

      {/* Footer fisso */}
      <div className="border-t border-border pt-3 mt-3 space-y-2 bg-background">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Importo da riconciliare</span>
          <span
            className={`font-semibold ${residuoMovimento < 0 ? "text-destructive" : ""}`}
          >
            {eur(residuoMovimento)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {residuoMovimento === 0
            ? "il movimento è coperto per intero"
            : residuoMovimento > 0
              ? `resterebbe un acconto di ${eur(residuoMovimento)}`
              : "hai superato l'importo del movimento"}
        </p>
        {nDebito > 0 && nCredito > 0 && (
          <p className="text-xs" style={{ color: "#7f56d9" }}>
            Compensazione: {nDebito} documenti a debito e {nCredito} note di credito della stessa
            controparte, verranno chiusi insieme su questo movimento
          </p>
        )}
        <Button
          className="w-full"
          disabled={residuoMovimento < 0 || selectedDocs.length === 0 || associa.isPending}
          onClick={handleConferma}
        >
          {associa.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Conferma
        </Button>
      </div>
    </div>
  );
}

function DocRow({
  doc,
  selected,
  importo,
  splitOpen,
  onToggle,
  onToggleSplit,
  onImporto,
  onStacca,
  staccaPending,
}: {
  doc: DocumentoPerMovimento;
  selected: boolean;
  importo: number;
  splitOpen: boolean;
  onToggle: (on: boolean) => void;
  onToggleSplit: () => void;
  onImporto: (v: number) => void;
  onStacca: () => void;
  staccaPending: boolean;
}) {
  const isCredito = doc.tipo === "Nota Credito";
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={(v) => onToggle(!!v)} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold">
              {doc.tipo} {doc.numero_documento || "—"}
            </span>
            {isCredito && (
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ color: "#7f56d9", borderColor: "#d9d0fb" }}
              >
                a tuo credito
              </Badge>
            )}
            {doc.sdi_mancante && (
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ color: "#b54708", borderColor: "#fedf89" }}
              >
                manca da SdI
              </Badge>
            )}
            {doc.giorni_scaduta !== null && doc.giorni_scaduta > 0 && (
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ color: "#b54708", borderColor: "#fedf89" }}
              >
                scaduta da {doc.giorni_scaduta} gg
              </Badge>
            )}
            {doc.direzione === "attiva" && (
              <Badge variant="secondary" className="text-[10px]">
                attiva
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            del {fdate(doc.data_documento)} · importo {eur(doc.totale)} ·{" "}
            {doc.data_scadenza ? `scadenza ${fdate(doc.data_scadenza)}` : "nessuna scadenza"}
          </p>
          {splitOpen && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                className="h-8 w-32"
                value={importo}
                onChange={(e) => onImporto(Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">importo da imputare</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <span
            className={`text-sm font-semibold whitespace-nowrap ${
              doc.effetto < 0 ? "text-success" : ""
            }`}
          >
            {doc.effetto < 0 ? "+" : "−"}
            {eur(Math.abs(doc.effetto))}
          </span>
          <div className="mt-1">
            {doc.gia_associato ? (
              <button
                type="button"
                className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                onClick={onStacca}
                disabled={staccaPending}
              >
                <Unlink className="h-3 w-3" /> stacca
              </button>
            ) : (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={onToggleSplit}
              >
                Dividi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
