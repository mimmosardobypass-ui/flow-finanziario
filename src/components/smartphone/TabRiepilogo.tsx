import { useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { righePezzi, useEliminaVendita, type SpDati } from "@/hooks/useSmartphone";
import { totali, ricarico, margine } from "@/lib/smartphone/calcoli";
import { eur, pct, segnoEur } from "@/lib/smartphone/formato";
import { esportaExcel, r1, r2 } from "@/lib/smartphone/esporta";
import { fmtData, oggiISO } from "@/components/finanziamenti/utils";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { messaggioErrore } from "@/lib/erroriDatabase";
import { Riquadro } from "./ui";

const nomeMese = (m: string) => { const s = format(parseISO(`${m}-01`), "MMMM yyyy", { locale: it }); return s[0].toUpperCase() + s.slice(1); };

export function TabRiepilogo({ dati }: { dati: SpDati }) {
  const vendute = useMemo(() => righePezzi(dati).filter((r) => r.vendita), [dati]);
  const mesi = useMemo(() => {
    const s = new Set(vendute.map((r) => r.vendita!.data_vendita.slice(0, 7)));
    s.add(oggiISO().slice(0, 7));
    return [...s].sort().reverse();
  }, [vendute]);
  const [mese, setMese] = useState(oggiISO().slice(0, 7));
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const elimina = useEliminaVendita();

  const righe = vendute.filter((r) => r.vendita!.data_vendita.startsWith(mese)).sort((a, b) => b.vendita!.data_vendita.localeCompare(a.vendita!.data_vendita));
  const real = totali(righe.map((r) => ({ costo: r.costo, incasso: r.venduto! })));
  const conPrev = righe.filter((r) => r.previsto !== null);
  const prev = totali(conPrev.map((r) => ({ costo: r.costo, incasso: r.previsto! })));
  const scostamento = conPrev.reduce((s, r) => s + (r.venduto! - r.previsto!), 0);

  const esporta = () => esportaExcel(`smartphone_vendite_${mese}`, [{
    nome: "Vendite",
    righe: righe.map((r) => {
      const u = r.venduto! - r.costo;
      return {
        Data: fmtData(r.vendita!.data_vendita), Pezzo: r.articolo.descrizione, Codice: r.articolo.codice_articolo, IMEI: r.vendita!.imei ?? r.pezzo.imei ?? "",
        Costo: r2(r.costo), Previsto: r2(r.previsto), Venduto: r2(r.venduto), Scostamento: r.previsto === null ? null : r2(r.venduto! - r.previsto),
        Utile: r2(u), "Ricarico %": r1(ricarico(u, r.costo)), "Margine %": r1(margine(u, r.venduto!)),
      };
    }),
  }]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mese} onValueChange={setMese}>
          <SelectTrigger className="w-52" aria-label="Mese"><SelectValue /></SelectTrigger>
          <SelectContent>{mesi.map((m) => <SelectItem key={m} value={m}>{nomeMese(m)}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" className="ml-auto" onClick={esporta}><Download className="mr-2 h-4 w-4" />Esporta Excel</Button>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Riquadro titolo="Incassato" valore={eur(real.incasso)} sotto={`previsto ${eur(prev.incasso)}`} />
        <Riquadro titolo="Utile realizzato" valore={eur(real.utile)} sotto={`previsto ${eur(prev.utile)}`} />
        <Riquadro titolo="Scostamento dal previsto" valore={segnoEur(scostamento)} sotto={`su ${conPrev.length} pezzi con prezzo previsto`} />
        <Riquadro titolo="Ricarico medio" valore={pct(real.ricarico)} sotto={`previsto ${pct(prev.ricarico)}`} />
        <Riquadro titolo="Margine medio" valore={pct(real.margine)} sotto={`previsto ${pct(prev.margine)}`} />
      </div>
      <div className="tg-wrap">
        <table className="tg min-w-[950px]">
          <thead><tr>
            <th>Data</th><th>Pezzo</th><th className="num">Costo</th><th className="num">Previsto</th><th className="num">Venduto</th>
            <th className="num">Scostamento</th><th className="num">Utile</th><th className="num">Ricarico</th><th className="num">Margine</th><th></th>
          </tr></thead>
          <tbody>
            {righe.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">Nessuna vendita nel mese</td></tr>}
            {righe.map((r) => {
              const u = r.venduto! - r.costo;
              return (
                <tr key={r.vendita!.id}>
                  <td className="whitespace-nowrap">{fmtData(r.vendita!.data_vendita)}</td>
                  <td><div className="font-medium">{r.articolo.descrizione}</div><div className="text-xs text-muted-foreground">{r.articolo.marca} · {r.articolo.codice_articolo}{(r.vendita!.imei ?? r.pezzo.imei) ? ` · IMEI ${r.vendita!.imei ?? r.pezzo.imei}` : ""}</div></td>
                  <td className="num">{eur(r.costo)}</td><td className="num">{eur(r.previsto)}</td><td className="num">{eur(r.venduto)}</td>
                  <td className="num">{r.previsto === null ? "—" : segnoEur(r.venduto! - r.previsto)}</td>
                  <td className="num">{eur(u)}</td><td className="num">{pct(ricarico(u, r.costo))}</td><td className="num">{pct(margine(u, r.venduto!))}</td>
                  <td className="text-right"><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Elimina vendita" onClick={() => setDaEliminare(r.vendita!.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr>
            <td>Totale</td><td>{righe.length} pezzi</td><td className="num">{eur(real.costo)}</td><td className="num">{eur(prev.incasso)}</td>
            <td className="num">{eur(real.incasso)}</td><td className="num">{segnoEur(scostamento)}</td><td className="num">{eur(real.utile)}</td>
            <td className="num">{pct(real.ricarico)}</td><td className="num">{pct(real.margine)}</td><td></td>
          </tr></tfoot>
        </table>
      </div>
      <DeleteConfirmDialog
        open={!!daEliminare}
        onOpenChange={(o) => !o && setDaEliminare(null)}
        title="Eliminare la vendita?"
        description="Il pezzo tornerà disponibile in magazzino."
        onConfirm={() => daEliminare && elimina.mutate(daEliminare, {
          onSuccess: () => { toast.success("Vendita eliminata: il pezzo è di nuovo disponibile"); setDaEliminare(null); },
          onError: (e) => toast.error(messaggioErrore(e)),
        })}
      />
    </div>
  );
}
