import { useRef, useState, useMemo } from "react";
import { Upload, Loader2, Wand2, AlertTriangle, CopyCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIE, leggiFileCarico, type CaricoLetto, type Categoria, type RigaCarico } from "@/lib/smartphone/parserCarico";
import { totali, utile, ricarico, margine } from "@/lib/smartphone/calcoli";
import { eur, pct } from "@/lib/smartphone/formato";
import { documentoEsiste, useImportaCarico, type SpDati } from "@/hooks/useSmartphone";
import { messaggioErrore } from "@/lib/erroriDatabase";
import { Riquadro, CampoPrezzo } from "./ui";
import { fmtData } from "@/components/finanziamenti/utils";

interface Riga extends RigaCarico { prezzo: number | null }

export function TabImporta({ dati, onImportato }: { dati: SpDati | undefined; onImportato: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lettura, setLettura] = useState(false);
  const [carico, setCarico] = useState<CaricoLetto | null>(null);
  const [righe, setRighe] = useState<Riga[]>([]);
  const [nomeFile, setNomeFile] = useState("");
  const [numero, setNumero] = useState("");
  const [dataDoc, setDataDoc] = useState("");
  const [tipo, setTipo] = useState("");
  const [doppione, setDoppione] = useState<boolean | null>(null);
  const [trascina, setTrascina] = useState(false);
  const importa = useImportaCarico();

  const ultimoPrezzo = useMemo(() => {
    const m = new Map<string, number>();
    const ord = [...(dati?.articoli ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const a of ord) if (a.prezzo_previsto !== null) m.set(a.codice_articolo, a.prezzo_previsto);
    return m;
  }, [dati]);

  const verificaDoppione = async (n: string, d: string) => {
    if (!n || !d) { setDoppione(null); return; }
    setDoppione(await documentoEsiste(n, d));
  };

  const leggi = async (file: File) => {
    setLettura(true);
    try {
      const c = await leggiFileCarico(file);
      setCarico(c);
      setNomeFile(file.name);
      setTipo(c.tipo || "CARICO");
      setNumero(c.numero ?? "");
      setDataDoc(c.data_documento ?? "");
      setRighe(c.righe.map((r) => ({ ...r, prezzo: ultimoPrezzo.get(r.codice_articolo) ?? null })));
      await verificaDoppione(c.numero ?? "", c.data_documento ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "File non leggibile");
    } finally {
      setLettura(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const annulla = () => { setCarico(null); setRighe([]); setDoppione(null); };
  const aggiorna = (chiave: string, patch: Partial<Riga>) => setRighe((rs) => rs.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)));

  const pezziTot = righe.reduce((s, r) => s + r.quantita, 0);
  const costoTot = righe.reduce((s, r) => s + r.quantita * r.costo_unitario, 0);
  const conPrezzo = righe.filter((r) => r.prezzo !== null);
  const prev = totali(conPrezzo.map((r) => ({ costo: r.quantita * r.costo_unitario, incasso: r.quantita * (r.prezzo ?? 0), pezzi: r.quantita })));
  const prezziInseriti = mostraRiepilogoNull(prev);
  const ripetute = righe.filter((r) => r.righeFile > 1);
  const preso = prezzoPrecedente(righe, ultimoPrezzo);

  const conferma = async () => {
    if (!numero || !dataDoc) { toast.error("Inserisci numero e data del documento."); return; }
    if (doppione) { toast.error(`Il documento n. ${numero} del ${fmtData(dataDoc)} è già stato importato.`); return; }
    try {
      const r = await importa.mutateAsync({
        tipo, numero, data_documento: dataDoc, nome_file: nomeFile,
        articoli: righe.map((x) => ({
          marca: x.marca, codice_articolo: x.codice_articolo, modello: x.modello, descrizione: x.descrizione,
          categoria: x.categoria, costo_unitario: x.costo_unitario, aliquota_iva: x.aliquota_iva, prezzo_previsto: x.prezzo, quantita: x.quantita,
        })),
      });
      toast.success(`Importati ${r.pezzi} pezzi del documento n. ${numero}`);
      annulla();
      onImportato();
    } catch (e) {
      toast.error(messaggioErrore(e));
    }
  };

  if (!carico) {
    return (
      <Card>
        <CardContent className="p-6">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setTrascina(true); }}
            onDragLeave={() => setTrascina(false)}
            onDrop={(e) => { e.preventDefault(); setTrascina(false); const f = e.dataTransfer.files[0]; if (f) leggi(f); }}
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${trascina ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
          >
            {lettura ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-primary" />}
            <div className="font-medium">Trascina qui il file del carico oppure clicca per sceglierlo</div>
            <div className="text-sm text-muted-foreground">File .xls esportato dal gestionale (anche se è una pagina web), .xlsx o .html</div>
          </button>
          <input ref={inputRef} type="file" accept=".xls,.xlsx,.html,.htm" className="hidden" onChange={(e) => e.target.files?.[0] && leggi(e.target.files[0])} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          <div className="text-xs text-muted-foreground">Documento</div>
          <Input aria-label="Tipo documento" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-7 text-[13px]" />
          <div className="flex gap-1.5">
            <Input aria-label="Numero documento" placeholder="N." value={numero} onChange={(e) => setNumero(e.target.value)} onBlur={() => verificaDoppione(numero, dataDoc)} className="h-7 text-[13px]" />
            <Input aria-label="Data documento" type="date" value={dataDoc} onChange={(e) => { setDataDoc(e.target.value); verificaDoppione(numero, e.target.value); }} className="h-7 text-[13px]" />
          </div>
        </div>
        <Riquadro titolo="Articoli / pezzi" valore={`${righe.length} / ${pezziTot}`} sotto={nomeFile} />
        <Riquadro titolo="Valore a costo" valore={eur(costoTot)} sotto="IVA esclusa" />
        <Riquadro
          titolo="Controllo doppioni"
          valore={doppione === null ? "—" : doppione ? "Già importato" : "Nuovo documento"}
          sotto={doppione ? "Questo documento esiste già: importazione bloccata" : "Numero e data non presenti"}
          className={doppione ? "border-destructive" : undefined}
        />
      </div>

      {(carico.correzioni.length > 0 || carico.avvisi.length > 0 || ripetute.length > 0 || preso > 0) && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium"><Wand2 className="h-4 w-4 text-primary" />Sistemato in automatico durante la lettura</div>
          <ul className="list-disc pl-6 text-muted-foreground">
            {carico.correzioni.map((c) => <li key={c}>{c}</li>)}
            {preso > 0 && <li>Prezzo previsto proposto dall'ultimo carico per {preso} articoli.</li>}
          </ul>
          {carico.avvisi.map((a) => (
            <div key={a} className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" />{a}</div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Anteprima: una riga per codice articolo</CardTitle></CardHeader>
        <CardContent>
          <div className="tg-wrap">
            <table className="tg min-w-[900px]">
              <thead>
                <tr>
                  <th>Articolo</th><th className="num">Pezzi</th><th className="num">Costo unitario</th><th className="num">Prezzo previsto (€)</th>
                  <th className="num">Utile previsto</th><th className="num">Ricarico</th><th className="num">Margine</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => {
                  const u = r.prezzo === null ? null : utile(r.prezzo, r.costo_unitario);
                  return (
                    <tr key={r.chiave}>
                      <td>
                        <div className="font-medium">{r.descrizione || r.modello}</div>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          {r.marca} · {r.codice_articolo} ·
                          <Select value={r.categoria} onValueChange={(v) => aggiorna(r.chiave, { categoria: v as Categoria })}>
                            <SelectTrigger aria-label="Categoria" className="h-6 w-[120px] text-xs px-2"><SelectValue /></SelectTrigger>
                            <SelectContent>{CATEGORIE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {r.righeFile > 1 && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                            <CopyCheck className="h-3.5 w-3.5" />{r.righeFile} righe identiche nel file – conferma che sono {r.quantita} pezzi
                          </div>
                        )}
                      </td>
                      <td className="num">{r.quantita}</td>
                      <td className="num">{eur(r.costo_unitario)}</td>
                      <td className="num"><CampoPrezzo valore={r.prezzo} onSalva={(v) => aggiorna(r.chiave, { prezzo: v })} className="ml-auto" /></td>
                      <td className="num">{u === null ? "—" : eur(u * r.quantita)}</td>
                      <td className="num">{u === null ? "—" : pct(ricarico(u, r.costo_unitario))}</td>
                      <td className="num">{u === null ? "—" : pct(margine(u, r.prezzo ?? 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Totale</td><td className="num">{pezziTot}</td><td className="num">{eur(costoTot)}</td>
                  <td className="num">{prezziInseriti ? eur(prev.incasso) : "—"}</td>
                  <td className="num">{prezziInseriti ? eur(prev.utile) : "—"}</td>
                  <td className="num">{pct(prev.ricarico)}</td><td className="num">{pct(prev.margine)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Previsione dell'intero carico</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Riquadro titolo="Costo carico" valore={eur(costoTot)} />
            <Riquadro titolo="Incasso previsto" valore={eur(prev.incasso)} />
            <Riquadro titolo="Utile previsto" valore={eur(prev.utile)} />
            <Riquadro titolo="Ricarico medio" valore={pct(prev.ricarico)} />
            <Riquadro titolo="Margine medio" valore={pct(prev.margine)} />
          </div>
          <p className="text-xs text-muted-foreground">Prezzo previsto inserito per {prev.pezzi} pezzi su {pezziTot} · la previsione conta solo quelli. Importi IVA esclusa.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={annulla}>Annulla</Button>
        <Button onClick={conferma} disabled={importa.isPending || !!doppione || pezziTot === 0}>
          {importa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importa {pezziTot} pezzi
        </Button>
      </div>
    </div>
  );
}

function mostraRiepilogoNull(t: { pezzi: number }) { return t.pezzi > 0; }
function prezzoPrecedente(righe: Riga[], m: Map<string, number>) { return righe.filter((r) => m.has(r.codice_articolo)).length; }
