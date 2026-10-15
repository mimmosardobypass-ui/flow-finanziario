import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { righePezzi, useRegistraVendita, type SpDati } from "@/hooks/useSmartphone";
import { eur, pct, segnoEur } from "@/lib/smartphone/formato";
import { margine, ricarico } from "@/lib/smartphone/calcoli";
import { fmtData, fmtNum, oggiISO, parseImporto } from "@/components/finanziamenti/utils";
import { messaggioErrore } from "@/lib/erroriDatabase";
import { Riquadro } from "./ui";

export function TabVendi({ dati, pezzoIniziale, onVenduto }: { dati: SpDati; pezzoIniziale: string | null; onVenduto: () => void }) {
  const disponibili = useMemo(
    () => righePezzi(dati).filter((r) => r.pezzo.stato === "disponibile").sort((a, b) => a.articolo.descrizione.localeCompare(b.articolo.descrizione)),
    [dati]
  );
  const [pezzoId, setPezzoId] = useState<string>(pezzoIniziale ?? "");
  const [cerca, setCerca] = useState("");
  const [data, setData] = useState(oggiISO());
  const [prezzoTxt, setPrezzoTxt] = useState("");
  const [imei, setImei] = useState("");
  const registra = useRegistraVendita();

  useEffect(() => { if (pezzoIniziale) setPezzoId(pezzoIniziale); }, [pezzoIniziale]);
  const sel = disponibili.find((r) => r.pezzo.id === pezzoId) ?? null;
  useEffect(() => {
    setPrezzoTxt(sel?.articolo.prezzo_previsto != null ? fmtNum(sel.articolo.prezzo_previsto) : "");
    setImei(sel?.pezzo.imei ?? "");
  }, [sel?.pezzo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const prezzo = parseImporto(prezzoTxt);
  const prev = sel?.articolo.prezzo_previsto ?? null;
  const costo = sel?.costo ?? 0;
  const u = prezzo === null ? null : prezzo - costo;
  const uPrev = prev === null ? null : prev - costo;

  const filtrati = disponibili.filter((r) => {
    const t = cerca.trim().toLowerCase();
    return !t || [r.articolo.descrizione, r.articolo.codice_articolo, r.pezzo.imei ?? ""].some((x) => x.toLowerCase().includes(t));
  });

  const salva = async () => {
    if (!sel) { toast.error("Scegli il pezzo da vendere."); return; }
    if (prezzo === null || prezzo < 0) { toast.error("Inserisci un prezzo di vendita valido."); return; }
    if (data > oggiISO()) { toast.error("La data di vendita non può essere futura."); return; }
    try {
      await registra.mutateAsync({ pezzoId: sel.pezzo.id, data, prezzo: Math.round(prezzo * 100) / 100, imei: imei.trim() || null });
      toast.success(`Vendita registrata: ${sel.articolo.descrizione} a ${eur(prezzo)}`);
      setPezzoId(""); setPrezzoTxt(""); setImei("");
      onVenduto();
    } catch (e) { toast.error(messaggioErrore(e)); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Registra una vendita</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pezzo</Label>
            <Input placeholder="Filtra per modello, codice, IMEI" value={cerca} onChange={(e) => setCerca(e.target.value)} aria-label="Filtra pezzi" />
            <Select value={pezzoId} onValueChange={setPezzoId}>
              <SelectTrigger aria-label="Pezzo da vendere"><SelectValue placeholder={`Scegli tra ${disponibili.length} pezzi disponibili`} /></SelectTrigger>
              <SelectContent className="max-h-80">
                {filtrati.slice(0, 300).map((r) => (
                  <SelectItem key={r.pezzo.id} value={r.pezzo.id}>
                    {r.articolo.descrizione} · {r.articolo.codice_articolo} · doc. {r.documento.numero} del {fmtData(r.documento.data_documento)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="sp-data">Data vendita</Label><Input id="sp-data" type="date" value={data} max={oggiISO()} onChange={(e) => setData(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="sp-prezzo">Prezzo di vendita (€, IVA esclusa)</Label><Input id="sp-prezzo" inputMode="decimal" className="text-right tabular-nums" value={prezzoTxt} onChange={(e) => setPrezzoTxt(e.target.value)} placeholder="0,00" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="sp-imei">IMEI (facoltativo)</Label><Input id="sp-imei" value={imei} onChange={(e) => setImei(e.target.value)} /></div>
          <Button onClick={salva} disabled={registra.isPending || !sel} className="w-full">
            {registra.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registra vendita
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{sel ? sel.articolo.descrizione : "Nessun pezzo scelto"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="tg-wrap">
            <table className="tg">
              <tbody>
                <tr><td>Costo</td><td className="num">{sel ? eur(costo) : "—"}</td></tr>
                <tr><td>Prezzo previsto</td><td className="num">{eur(prev)}</td></tr>
                <tr><td>Prezzo di vendita</td><td className="num">{eur(prezzo)}</td></tr>
                <tr><td className="font-medium">Differenza dal previsto</td><td className="num font-medium">{prezzo !== null && prev !== null ? segnoEur(prezzo - prev) : "—"}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 grid-cols-3">
            <Riquadro titolo="Utile" valore={sel ? eur(u) : "—"} sotto={`previsto ${eur(uPrev)}`} />
            <Riquadro titolo="Ricarico" valore={sel && u !== null ? pct(ricarico(u, costo)) : "—"} sotto={`previsto ${uPrev === null ? "—" : pct(ricarico(uPrev, costo))}`} />
            <Riquadro titolo="Margine" valore={sel && u !== null ? pct(margine(u, prezzo ?? 0)) : "—"} sotto={`previsto ${uPrev === null ? "—" : pct(margine(uPrev, prev ?? 0))}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
