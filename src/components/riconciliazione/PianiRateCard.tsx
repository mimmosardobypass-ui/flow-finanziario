import { useState, useMemo } from "react";
import { CreditCard, Loader2, Search, CheckCheck, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useFindPianiRate, useCollegaPianoRate, PianoRate } from "@/hooks/usePianiRate";

const eur = (n: number) =>
  `€${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy", { locale: it }) : "—");

function ConfidenzaExtra({ p }: { p: PianoRate }) {
  if (p.confidenza === "dubbio") {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        più fatture possibili
      </Badge>
    );
  }
  return null;
}

export function PianiRateCard() {
  const qc = useQueryClient();
  const findMut = useFindPianiRate();
  const collegaMut = useCollegaPianoRate();
  const [piani, setPiani] = useState<PianoRate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [creaScadenziario, setCreaScadenziario] = useState(true);
  const navigate = useNavigate();

  const completi = useMemo(() => (piani ?? []).filter((p) => p.stato === "completo"), [piani]);
  const inCorso = useMemo(() => (piani ?? []).filter((p) => p.stato !== "completo"), [piani]);

  const selPiani = useMemo(
    () => (piani ?? []).filter((p) => selected.has(p.fattura_id)),
    [piani, selected],
  );
  const selTotale = selPiani.reduce((s, p) => s + Number(p.importo_trovato), 0);

  const search = async () => {
    try {
      const data = await findMut.mutateAsync();
      setPiani(data);
      setSelected(new Set(data.filter((p) => p.confidenza === "alta").map((p) => p.fattura_id)));
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const conferma = async () => {
    if (selPiani.length === 0) return;
    setSaving(true);
    let ok = 0;
    let chiuse = 0;
    let inScadenziario = 0;
    try {
      for (const p of selPiani) {
        try {
          const res = await collegaMut.mutateAsync({
            fattura_id: p.fattura_id,
            transaction_ids: p.transaction_ids,
            crea_scadenziario: creaScadenziario,
          });
          ok++;
          if (res?.piano_completo || Number(res?.residuo_fattura ?? 1) <= 0.01) chiuse++;
          if (res?.scadenziario_id) inScadenziario++;
        } catch (e) {
          console.error("[Piani rate] errore piano", e);
        }
      }
      toast({
        title: "Rate collegate",
        description: (
          <span>
            {ok} piani collegati, {chiuse} fatture chiuse
            {inScadenziario > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => navigate("/scadenziario")}
                >
                  {inScadenziario} piani aggiunti allo Scadenziario
                </button>
              </>
            )}
          </span>
        ),
      });
      qc.invalidateQueries({ queryKey: ["fatture-fornitori"] });
      qc.invalidateQueries({ queryKey: ["documenti-saldi"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["movimenti-copertura"] });
      await search();
    } finally {
      setSaving(false);
    }
  };

  const renderPiano = (p: PianoRate, completo: boolean) => {
    const isSel = selected.has(p.fattura_id);
    const media = p.rate_trovate > 0 ? p.importo_trovato / p.rate_trovate : 0;
    const giorniPrimaRata =
      p.date_rate?.[0] && p.data_documento
        ? differenceInCalendarDays(new Date(p.date_rate[0]), new Date(p.data_documento))
        : null;
    const mancanti = Math.max(0, p.rate_previste - p.rate_trovate);

    return (
      <div
        key={p.fattura_id}
        className={`rounded-lg border p-3 space-y-2 ${
          completo ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40"
        }`}
      >
        <div className="flex items-start gap-3">
          <Checkbox checked={isSel} onCheckedChange={() => toggle(p.fattura_id)} className="mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium truncate">{p.controparte || "—"}</span>
              <Badge
                variant="outline"
                className={
                  completo
                    ? "border-green-300 bg-green-100 text-green-800"
                    : "border-amber-300 bg-amber-100 text-amber-800"
                }
              >
                {p.rate_trovate} rate su {p.rate_previste}
              </Badge>
              <ConfidenzaExtra p={p} />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Fattura {p.numero_documento || "—"} del {fmtDate(p.data_documento)}
              {giorniPrimaRata !== null && ` · prima rata dopo ${giorniPrimaRata} giorni`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold">{eur(p.importo_trovato)}</div>
            <div className="text-[11px] text-muted-foreground">
              {completo ? "somma delle rate" : "già addebitati"}
            </div>
          </div>
        </div>

        {!completo && (
          <Progress
            value={p.rate_previste > 0 ? (p.rate_trovate / p.rate_previste) * 100 : 0}
            className="h-1.5"
          />
        )}

        <div className="space-y-1 pt-1">
          {(p.date_rate ?? []).map((d, i) => (
            <div key={`${p.fattura_id}-r-${i}`} className="flex items-center gap-2 text-xs">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                  completo ? "bg-green-600" : "bg-amber-600"
                }`}
              >
                {i + 1}
              </span>
              <span className="w-20 shrink-0">{fmtDate(d)}</span>
              <span className="flex-1 truncate text-muted-foreground">PAYPAL *PAGA IN 3 RATE</span>
              <span className="font-medium">{eur(p.importi_rate?.[i] ?? 0)}</span>
            </div>
          ))}

          {!completo &&
            Array.from({ length: mancanti }).map((_, k) => {
              const base = p.prossima_rata_attesa ? new Date(p.prossima_rata_attesa) : null;
              const attesa = base ? addDays(base, k * 30) : null;
              return (
                <div
                  key={`${p.fattura_id}-m-${k}`}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground text-[10px]">
                    {p.rate_trovate + k + 1}
                  </span>
                  <span className="w-20 shrink-0">
                    {attesa ? `attesa ~${format(attesa, "dd/MM/yyyy", { locale: it })}` : "attesa"}
                  </span>
                  <span className="flex-1 truncate italic">non ancora addebitata</span>
                  <span>{eur(media)}</span>
                </div>
              );
            })}
        </div>

        {p.confidenza === "bassa" && (
          <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-100 p-2 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Una sola rata addebitata: l'importo da solo non identifica con certezza la fattura,
              controlla prima di confermare.
            </span>
          </div>
        )}

        {!completo && (
          <div className="rounded bg-amber-100 p-2 text-xs text-amber-900">
            Collegando ora le rate la fattura resta Parziale con{" "}
            {eur(Math.max(0, Number(p.totale_fattura) - Number(p.importo_trovato)))} da coprire.
            Quando le rate mancanti compariranno in estratto conto le ritroverai qui.
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Pagamenti a rate PayPal
          </CardTitle>
          <div className="flex items-center gap-3">
            {piani && piani.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {completi.length} completi · {inCorso.length} in corso
              </span>
            )}
            <Button variant="outline" size="sm" onClick={search} disabled={findMut.isPending}>
              {findMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Cerca piani a rate
            </Button>
          </div>
        </div>
      </CardHeader>

      {piani && (
        <CardContent className="space-y-4">
          {piani.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessun piano a rate da collegare</div>
          ) : (
            <>
              {completi.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Piani completi — la fattura si chiude</div>
                  {completi.map((p) => renderPiano(p, true))}
                </div>
              )}
              {inCorso.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Piani in corso — la fattura resta parziale</div>
                  {inCorso.map((p) => renderPiano(p, false))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <span className="text-sm text-muted-foreground">
                  Selezionati: {selPiani.length} piani · {eur(selTotale)}
                </span>
                <Button onClick={conferma} disabled={selPiani.length === 0 || saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-2" />
                  )}
                  Collega le rate selezionate
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
