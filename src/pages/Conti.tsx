import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Landmark,
  CreditCard,
  Smartphone,
  Wallet,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Check,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  ListOrdered,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContoDialog } from "@/components/ContoDialog";
import {
  useContiRiepilogo,
  useAndamentoConti,
  useToggleContoAttivo,
  ContoRiepilogo,
  TipoConto,
} from "@/hooks/useConti";
import { fmtEur, fmtData, fmtMeseAnno } from "@/components/finanziamenti/utils";
import { toast } from "@/hooks/use-toast";

const ICONE: Record<TipoConto, LucideIcon> = {
  conto_corrente: Landmark,
  carta: CreditCard,
  pos: Smartphone,
  cassa: Wallet,
  altro: Landmark,
};

const iconaTipo = (tipo: TipoConto | null) => ICONE[(tipo ?? "altro") as TipoConto] ?? Landmark;

const mascheraIdentificativo = (v: string | null) => {
  if (!v) return null;
  const pulito = v.replace(/\s+/g, "");
  if (pulito.length <= 4) return pulito;
  return `···· ${pulito.slice(-4)}`;
};

const fmtDataOra = (v: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return `${d.toLocaleDateString("it-IT")} ${d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

function Variazione({ attuale, precedente }: { attuale: number; precedente: number }) {
  if (!precedente) return null;
  const pct = ((attuale - precedente) / Math.abs(precedente)) * 100;
  if (!isFinite(pct)) return null;
  const su = pct >= 0;
  const Icon = su ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function StatCard({
  titolo,
  valore,
  sotto,
  warning,
}: {
  titolo: string;
  valore: string;
  sotto?: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{titolo}</p>
        <p
          className={`text-2xl font-bold mt-1 ${
            warning ? "text-[hsl(var(--warning))]" : "text-foreground"
          }`}
        >
          {valore}
        </p>
        {sotto && <div className="mt-1 text-xs text-muted-foreground">{sotto}</div>}
      </CardContent>
    </Card>
  );
}

export default function Conti() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusSaldo, setFocusSaldo] = useState(false);
  const [selectedConto, setSelectedConto] = useState<ContoRiepilogo | null>(null);

  const { data: conti = [], isLoading } = useContiRiepilogo();
  const { data: andamento = [] } = useAndamentoConti();
  const toggleMutation = useToggleContoAttivo();

  const handleEdit = (conto: ContoRiepilogo, saldo = false) => {
    setSelectedConto(conto);
    setFocusSaldo(saldo);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedConto(null);
    setFocusSaldo(false);
    setDialogOpen(true);
  };

  const handleToggle = async (conto: ContoRiepilogo) => {
    try {
      await toggleMutation.mutateAsync({ id: conto.id, attivo: !conto.attivo });
      toast({ title: conto.attivo ? "Conto disattivato" : "Conto attivato" });
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    }
  };

  const attivi = conti.filter((c) => c.attivo);

  const liquidi = attivi.filter((c) => c.tipo === "conto_corrente" || c.tipo === "carta");
  const liquidita = liquidi.reduce((s, c) => s + c.saldo_attuale, 0);
  const confermati = liquidi.filter((c) => c.saldo_confermato).length;

  const entrateMese = attivi.reduce((s, c) => s + c.entrate_mese, 0);
  const entrateMesePrec = attivi.reduce((s, c) => s + c.entrate_mese_prec, 0);
  const usciteMese = attivi.reduce((s, c) => s + c.uscite_mese, 0);
  const usciteMesePrec = attivi.reduce((s, c) => s + c.uscite_mese_prec, 0);
  const daSistemare = attivi.reduce((s, c) => s + c.da_classificare + c.da_riconciliare, 0);

  const ordinati = useMemo(
    () => [...conti].sort((a, b) => Number(b.attivo) - Number(a.attivo)),
    [conti]
  );

  const serieSaldi = useMemo(() => {
    const perConto = new Map<string, { mese: string; netto: number }[]>();
    andamento.forEach((r) => {
      const arr = perConto.get(r.conto_id) ?? [];
      arr.push({ mese: r.mese, netto: r.netto });
      perConto.set(r.conto_id, arr);
    });

    const risultato = new Map<string, { mese: string; saldo: number }[]>();
    conti.forEach((c) => {
      const righe = (perConto.get(c.id) ?? [])
        .slice()
        .sort((a, b) => a.mese.localeCompare(b.mese))
        .slice(-12);
      if (righe.length < 2) return;
      const saldi: number[] = new Array(righe.length);
      saldi[righe.length - 1] = c.saldo_attuale;
      for (let i = righe.length - 2; i >= 0; i--) {
        saldi[i] = saldi[i + 1] - righe[i + 1].netto;
      }
      risultato.set(
        c.id,
        righe.map((r, i) => ({ mese: r.mese, saldo: saldi[i] }))
      );
    });
    return risultato;
  }, [andamento, conti]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Conti</h1>
          <p className="text-muted-foreground mt-1">
            Saldi, movimenti e stato di aggiornamento di conti, carte, POS e cassa.
          </p>
        </div>
        <Button className="gap-2" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuovo conto</span>
        </Button>
      </div>

      {conti.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Landmark className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nessun conto</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Crea il tuo primo conto per iniziare a gestire le tue finanze.
            </p>
            <Button className="gap-2" onClick={handleAddNew}>
              <Plus className="h-4 w-4" />
              Crea il primo conto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Riepilogo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              titolo="Liquidità su conti e carte"
              valore={fmtEur(liquidita)}
              sotto={
                <>
                  <div>
                    {confermati} saldi confermati su {liquidi.length}
                  </div>
                  {confermati < liquidi.length && (
                    <div className="text-[hsl(var(--warning))]">alcuni saldi sono stimati</div>
                  )}
                </>
              }
            />
            <StatCard
              titolo="Entrate del mese"
              valore={fmtEur(entrateMese)}
              sotto={
                <span className="inline-flex items-center gap-1">
                  <Variazione attuale={entrateMese} precedente={entrateMesePrec} />
                  <span>rispetto al mese scorso</span>
                </span>
              }
            />
            <StatCard
              titolo="Uscite del mese"
              valore={fmtEur(usciteMese)}
              sotto={
                <span className="inline-flex items-center gap-1">
                  <Variazione attuale={usciteMese} precedente={usciteMesePrec} />
                  <span>rispetto al mese scorso</span>
                </span>
              }
            />
            <StatCard
              titolo="Da sistemare"
              valore={String(daSistemare)}
              warning={daSistemare > 0}
              sotto="movimenti da classificare o da riconciliare"
            />
          </div>

          {/* Card conti */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ordinati.map((conto) => {
              const Icona = iconaTipo(conto.tipo);
              const serie = serieSaldi.get(conto.id) ?? [];
              const giorni = conto.giorni_da_ultimo_movimento;
              const idMask = mascheraIdentificativo(conto.identificativo);
              const negativoSospetto =
                !conto.saldo_confermato &&
                conto.saldo_attuale < 0 &&
                ["conto_corrente", "carta", "cassa"].includes(conto.tipo ?? "");

              return (
                <Card
                  key={conto.id}
                  className={`bg-card border-border overflow-hidden ${
                    !conto.attivo ? "opacity-60" : ""
                  }`}
                  style={
                    conto.colore
                      ? { borderLeftWidth: 3, borderLeftColor: conto.colore }
                      : undefined
                  }
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Intestazione */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icona className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {conto.nome_conto}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {[conto.banca, idMask].filter(Boolean).join(" · ") || "—"}
                          </p>
                          {conto.intestatario && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conto.intestatario}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={conto.attivo ? "default" : "secondary"}>
                        {conto.attivo ? "Attivo" : "Inattivo"}
                      </Badge>
                    </div>

                    {/* Saldo */}
                    <div>
                      <p
                        className={`text-2xl font-bold ${
                          conto.saldo_attuale < 0 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {fmtEur(conto.saldo_attuale)}
                      </p>
                      {conto.saldo_confermato ? (
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                          <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                          confermato al {fmtData(conto.saldo_riferimento_data)}
                        </p>
                      ) : (
                        <p className="text-xs text-[hsl(var(--warning))] mt-0.5">
                          saldo stimato dai movimenti ·{" "}
                          <button
                            type="button"
                            className="underline"
                            onClick={() => handleEdit(conto, true)}
                          >
                            Imposta saldo reale
                          </button>
                        </p>
                      )}
                      {negativoSospetto && (
                        <p className="text-xs text-muted-foreground inline-flex items-start gap-1 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0 mt-px" />
                          Negativo: probabilmente mancano movimenti o il saldo reale non è
                          impostato
                        </p>
                      )}
                    </div>

                    {/* Sparkline */}
                    {serie.length >= 2 && (
                      <div className="h-12 -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={serie} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                            <RTooltip
                              contentStyle={{
                                background: "hsl(var(--popover))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              labelFormatter={(v) => fmtMeseAnno(String(v))}
                              formatter={(v: number) => [fmtEur(v), "Saldo"]}
                            />
                            <Area
                              type="monotone"
                              dataKey="saldo"
                              stroke={conto.colore || "hsl(var(--primary))"}
                              fill={conto.colore || "hsl(var(--primary))"}
                              fillOpacity={0.15}
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Entrate / uscite mese */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Entrate mese</p>
                        <p className="font-semibold text-[hsl(var(--success))]">
                          {fmtEur(conto.entrate_mese)}
                        </p>
                        <Variazione
                          attuale={conto.entrate_mese}
                          precedente={conto.entrate_mese_prec}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Uscite mese</p>
                        <p className="font-semibold text-destructive">
                          {fmtEur(conto.uscite_mese)}
                        </p>
                        <Variazione
                          attuale={conto.uscite_mese}
                          precedente={conto.uscite_mese_prec}
                        />
                      </div>
                    </div>

                    {/* Stato aggiornamento */}
                    <div className="space-y-1 border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          Ultimo movimento {fmtData(conto.ultimo_movimento) || "—"}
                        </span>
                        {giorni !== null &&
                          (giorni <= 7 ? (
                            <Badge className="bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]">
                              Aggiornato
                            </Badge>
                          ) : giorni <= 30 ? (
                            <Badge className="bg-[hsl(var(--warning))] text-white hover:bg-[hsl(var(--warning))]">
                              Da aggiornare
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Fermo da {giorni} giorni</Badge>
                          ))}
                      </div>
                      {conto.ultimo_import && (
                        <p className="text-xs text-muted-foreground">
                          Ultimo import: {fmtDataOra(conto.ultimo_import)}
                        </p>
                      )}
                      {(conto.verificato_dal || conto.verificato_fino_al) && (
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                          Verificato con l'estratto dal {fmtData(conto.verificato_dal) || "—"} al{" "}
                          {fmtData(conto.verificato_fino_al) || "—"}
                        </p>
                      )}
                    </div>

                    {/* Chip contatori */}
                    {(conto.da_classificare > 0 || conto.da_riconciliare > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {conto.da_classificare > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/transactions?conto=${conto.id}&categoria=da-classificare`)
                            }
                            className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs hover:bg-accent"
                          >
                            {conto.da_classificare} da classificare
                          </button>
                        )}
                        {conto.da_riconciliare > 0 && (
                          <button
                            type="button"
                            onClick={() => navigate("/riconciliazione-intelligente")}
                            className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs hover:bg-accent"
                          >
                            {conto.da_riconciliare} da riconciliare
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <ListOrdered className="h-3.5 w-3.5" />
                      {conto.n_movimenti} movimenti
                      {conto.primo_movimento ? ` dal ${fmtData(conto.primo_movimento)}` : ""}
                    </p>

                    {/* Azioni */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/transactions?conto=${conto.id}`)}
                      >
                        Movimenti
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(conto)}>
                        <Pencil className="h-4 w-4 mr-1" /> Modifica
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(conto)}>
                        {conto.attivo ? (
                          <>
                            <ToggleRight className="h-4 w-4 mr-1" /> Disattiva
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 mr-1" /> Attiva
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ContoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        conto={selectedConto}
        focusSaldo={focusSaldo}
      />
    </div>
  );
}
