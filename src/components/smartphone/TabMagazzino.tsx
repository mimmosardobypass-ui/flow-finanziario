import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { righePezzi, useAggiornaPrezzoPrevisto, type SpDati } from "@/hooks/useSmartphone";
import { eur } from "@/lib/smartphone/formato";
import { giorniTra } from "@/lib/smartphone/calcoli";
import { fmtData, oggiISO } from "@/components/finanziamenti/utils";
import { messaggioErrore } from "@/lib/erroriDatabase";
import { Riquadro, Segmentato, CampoPrezzo } from "./ui";

type Filtro = "tutti" | "smartphone" | "accessori" | "venduti";

export function TabMagazzino({ dati, onVendi, soloSenzaPrezzoDoc }: { dati: SpDati; onVendi: (pezzoId: string) => void; soloSenzaPrezzoDoc?: string | null }) {
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [q, setQ] = useState("");
  const aggiorna = useAggiornaPrezzoPrevisto();
  const oggi = oggiISO();
  const tutte = useMemo(() => righePezzi(dati), [dati]);

  const disp = tutte.filter((r) => r.pezzo.stato === "disponibile");
  const dispPrezzo = disp.filter((r) => r.articolo.prezzo_previsto !== null);
  const utilePrevMag = dispPrezzo.reduce((s, r) => s + (r.articolo.prezzo_previsto! - r.costo), 0);

  const righe = tutte
    .filter((r) => {
      if (soloSenzaPrezzoDoc && (r.documento.id !== soloSenzaPrezzoDoc || r.articolo.prezzo_previsto !== null || r.pezzo.stato !== "disponibile")) return false;
      if (filtro === "venduti") return r.pezzo.stato === "venduto";
      if (r.pezzo.stato !== "disponibile") return false;
      if (filtro === "smartphone") return r.articolo.categoria === "Smartphone";
      if (filtro === "accessori") return r.articolo.categoria !== "Smartphone";
      return true;
    })
    .filter((r) => {
      const t = q.trim().toLowerCase();
      if (!t) return true;
      return [r.articolo.descrizione, r.articolo.modello, r.articolo.codice_articolo, r.pezzo.imei ?? "", r.vendita?.imei ?? ""].some((x) => x.toLowerCase().includes(t));
    })
    .sort((a, b) => b.documento.data_documento.localeCompare(a.documento.data_documento) || a.articolo.descrizione.localeCompare(b.articolo.descrizione));

  const totCosto = righe.reduce((s, r) => s + r.costo, 0);
  const totPrev = righe.filter((r) => r.articolo.prezzo_previsto !== null).reduce((s, r) => s + (r.articolo.prezzo_previsto! - r.costo), 0);

  const salva = (articoloId: string, v: number | null) =>
    aggiorna.mutate({ articoloId, prezzo: v }, { onSuccess: () => toast.success("Prezzo previsto aggiornato"), onError: (e) => toast.error(messaggioErrore(e)) });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Riquadro titolo="Pezzi disponibili" valore={disp.length} />
        <Riquadro titolo="Valore magazzino a costo" valore={eur(disp.reduce((s, r) => s + r.costo, 0))} />
        <Riquadro titolo="Utile previsto sul magazzino" valore={eur(utilePrevMag)} sotto={`su ${dispPrezzo.length} di ${disp.length} pezzi con prezzo previsto`} />
        <Riquadro titolo="Pezzi venduti" valore={tutte.length - disp.length} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmentato<Filtro> valore={filtro} onChange={setFiltro} opzioni={[
          { v: "tutti", l: "Tutti" }, { v: "smartphone", l: "Smartphone" }, { v: "accessori", l: "Accessori e cellulari" }, { v: "venduti", l: "Venduti" },
        ]} />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Cerca" placeholder="Cerca modello, codice, IMEI" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
      </div>
      {soloSenzaPrezzoDoc && <p className="text-sm text-muted-foreground">Mostro solo i pezzi del documento ancora senza prezzo previsto.</p>}

      <div className="tg-wrap">
        <table className="tg min-w-[900px]">
          <thead>
            <tr>
              <th>Descrizione</th><th>Carico</th><th className="num">Giacenza</th><th className="num">Costo</th>
              <th className="num">Prezzo previsto</th><th className="num">Utile previsto</th><th>Stato</th><th></th>
            </tr>
          </thead>
          <tbody>
            {righe.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nessun pezzo</td></tr>}
            {righe.map((r) => (
              <tr key={r.pezzo.id}>
                <td>
                  <div className="font-medium">{r.articolo.descrizione || r.articolo.modello}</div>
                  <div className="text-xs text-muted-foreground">{r.articolo.marca} · {r.articolo.codice_articolo}{r.pezzo.imei ? ` · IMEI ${r.pezzo.imei}` : ""}</div>
                </td>
                <td className="whitespace-nowrap">n. {r.documento.numero}<div className="text-xs text-muted-foreground">{fmtData(r.documento.data_documento)}</div></td>
                <td className="num">{giorniTra(r.documento.data_documento, r.vendita?.data_vendita ?? oggi)} gg</td>
                <td className="num">{eur(r.costo)}</td>
                <td className="num"><CampoPrezzo valore={r.articolo.prezzo_previsto} onSalva={(v) => salva(r.articolo.id, v)} className="ml-auto" /></td>
                <td className="num">{r.articolo.prezzo_previsto === null ? "—" : eur(r.articolo.prezzo_previsto - r.costo)}</td>
                <td>{r.pezzo.stato === "venduto" ? <Badge variant="secondary">Venduto</Badge> : <Badge variant="outline">Disponibile</Badge>}</td>
                <td className="text-right">
                  {r.pezzo.stato === "disponibile" && <Button size="sm" className="h-7" onClick={() => onVendi(r.pezzo.id)}>Vendi</Button>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Totale {righe.length} pezzi</td><td></td><td></td><td className="num">{eur(totCosto)}</td><td></td><td className="num">{eur(totPrev)}</td><td></td><td></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
