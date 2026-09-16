import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useContiAttivi } from "@/hooks/useConti";
import { useCategoryTree } from "@/hooks/useCategories";
import {
  useCreateFinanziamento,
  useFinanziamenti,
  type RataDaCreare,
} from "@/hooks/useFinanziamenti";
import { aggiungiMesi, fmtEur, fmtData, parseImporto, oggiISO } from "./utils";

type Modo = "calcola" | "semplice" | "pdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Se valorizzato, il dialog carica il piano su un contratto già esistente. */
  contrattoId?: string | null;
  modoIniziale?: Modo;
}

const arrotonda = (v: number) => Math.round(v * 100) / 100;

export function calcolaPianoFrancese(
  capitale: number,
  tanPercento: number,
  numeroRate: number,
  primaScadenza: string,
): RataDaCreare[] {
  if (!capitale || !numeroRate || !primaScadenza) return [];
  const i = tanPercento / 1200;
  const rataBase =
    i === 0 ? capitale / numeroRate : (capitale * i) / (1 - Math.pow(1 + i, -numeroRate));
  const rata = arrotonda(rataBase);
  let residuo = capitale;
  const rate: RataDaCreare[] = [];
  for (let k = 1; k <= numeroRate; k++) {
    const interessi = arrotonda(residuo * i);
    let capitaleQuota = arrotonda(rata - interessi);
    let importo = rata;
    if (k === numeroRate) {
      capitaleQuota = arrotonda(residuo);
      importo = arrotonda(capitaleQuota + interessi);
    }
    residuo = arrotonda(residuo - capitaleQuota);
    rate.push({
      numero_rata: k,
      importo,
      data_scadenza: aggiungiMesi(primaScadenza, k - 1),
      quota_capitale: capitaleQuota,
      quota_interessi: interessi,
      debito_residuo: Math.max(residuo, 0),
    });
  }
  return rate;
}

export function calcolaPianoSemplice(
  importoRata: number,
  numeroRate: number,
  primaScadenza: string,
): RataDaCreare[] {
  if (!importoRata || !numeroRate || !primaScadenza) return [];
  return Array.from({ length: numeroRate }, (_, idx) => ({
    numero_rata: idx + 1,
    importo: arrotonda(importoRata),
    data_scadenza: aggiungiMesi(primaScadenza, idx),
    quota_capitale: arrotonda(importoRata),
    quota_interessi: null,
    debito_residuo: null,
  }));
}

export function NuovoFinanziamentoDialog({
  open,
  onOpenChange,
  contrattoId = null,
  modoIniziale = "calcola",
}: Props) {
  const { data: conti = [] } = useContiAttivi();
  const albero = useCategoryTree();
  const { data: contratti = [] } = useFinanziamenti();
  const crea = useCreateFinanziamento();

  const caricaPiano = !!contrattoId;
  const contratto = contratti.find((c) => c.id === contrattoId);

  const [ente, setEnte] = useState(contratto?.societa_finanziaria ?? "");
  const [nome, setNome] = useState(contratto?.nome ?? "");
  const [beneficiario, setBeneficiario] = useState(contratto?.beneficiario ?? "");
  const [intestatario, setIntestatario] = useState(contratto?.intestatario ?? "");
  const [contoId, setContoId] = useState(contratto?.conto_id ?? "");
  const [categoryId, setCategoryId] = useState(contratto?.category_id ?? "");
  const [numeroContratto, setNumeroContratto] = useState(contratto?.numero_contratto ?? "");
  const [testoRegola, setTestoRegola] = useState("");
  const [forma, setForma] = useState(contratto?.forma ?? "rateale");
  const [dataStipula, setDataStipula] = useState(contratto?.data_stipula ?? "");
  const [note, setNote] = useState(contratto?.note ?? "");

  const [modo, setModo] = useState<Modo>(modoIniziale);
  const [capitale, setCapitale] = useState("");
  const [tan, setTan] = useState("");
  const [numeroRate, setNumeroRate] = useState("");
  const [importoRata, setImportoRata] = useState("");
  const [primaScadenza, setPrimaScadenza] = useState(oggiISO());

  const enti = useMemo(
    () => [...new Set(contratti.map((c) => c.societa_finanziaria).filter(Boolean))],
    [contratti],
  );

  const categorie = useMemo(() => {
    const finanziamenti = albero.filter((r) =>
      (r.name ?? "").toLowerCase().includes("finanziament"),
    );
    const altre = albero.filter((r) => !finanziamenti.includes(r));
    const appiattisci = (radici: typeof albero) =>
      radici.flatMap((r) => [
        { id: r.id, label: r.name, figlio: false },
        ...(r.children ?? []).map((c) => ({ id: c.id, label: `${r.name} · ${c.name}`, figlio: true })),
      ]);
    return [...appiattisci(finanziamenti), ...appiattisci(altre)];
  }, [albero]);

  const rate = useMemo(() => {
    if (modo === "calcola")
      return calcolaPianoFrancese(
        parseImporto(capitale) ?? 0,
        parseImporto(tan) ?? 0,
        Number(numeroRate) || 0,
        primaScadenza,
      );
    if (modo === "semplice")
      return calcolaPianoSemplice(
        parseImporto(importoRata) ?? 0,
        Number(numeroRate) || 0,
        primaScadenza,
      );
    return [];
  }, [modo, capitale, tan, numeroRate, importoRata, primaScadenza]);

  const totale = rate.reduce((s, r) => s + r.importo, 0);
  const interessi = rate.reduce((s, r) => s + (r.quota_interessi ?? 0), 0);
  const dataFine = rate.length ? rate[rate.length - 1].data_scadenza : null;

  const puoSalvare =
    modo !== "pdf" &&
    rate.length > 0 &&
    (caricaPiano || (!!ente.trim() && !!contoId && !!testoRegola.trim()));

  const salva = async () => {
    const res = await crea.mutateAsync({
      scadenziario_id: contrattoId,
      origine_piano: modo === "calcola" ? "calcolato" : "semplice",
      testo_regola: testoRegola,
      rate,
      contratto: {
        societa_finanziaria: ente.trim() || contratto?.societa_finanziaria || "",
        nome: nome.trim() || null,
        beneficiario: beneficiario.trim() || null,
        intestatario: intestatario.trim() || null,
        conto_id: contoId || null,
        category_id: categoryId || null,
        numero_contratto: numeroContratto.trim() || "—",
        forma: forma || null,
        capitale: modo === "calcola" ? parseImporto(capitale) : null,
        tan: modo === "calcola" ? parseImporto(tan) : null,
        taeg: null,
        importo_rata: rate[0]?.importo ?? null,
        data_stipula: dataStipula || null,
        data_erogazione: null,
        mandato_sdd: null,
        note: note.trim() || null,
      },
    });
    toast.success(
      caricaPiano
        ? `Piano caricato · ${res.collegate} rate già collegate ai movimenti`
        : `Finanziamento creato · ${res.collegate} rate già collegate ai movimenti`,
    );
    onOpenChange(false);
  };

  const anteprima = rate.length > 7 ? [...rate.slice(0, 5), ...rate.slice(-2)] : rate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{caricaPiano ? "Carica il piano" : "Nuovo finanziamento"}</DialogTitle>
          <DialogDescription>
            {caricaPiano
              ? "Genera le rate per questo contratto."
              : "Inserisci il contratto e scegli come generare il piano delle rate."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-5">
            {!caricaPiano && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ente *</Label>
                  <Input
                    list="enti-finanziari"
                    value={ente}
                    onChange={(e) => setEnte(e.target.value)}
                    placeholder="Es. Findomestic"
                  />
                  <datalist id="enti-finanziari">
                    {enti.map((e) => (
                      <option key={e} value={e} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome breve</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Auto" />
                </div>
                <div className="space-y-1.5">
                  <Label>Per chi</Label>
                  <Input
                    value={beneficiario}
                    onChange={(e) => setBeneficiario(e.target.value)}
                    placeholder="Es. Mimmo"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Intestatario</Label>
                  <Input value={intestatario} onChange={(e) => setIntestatario(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Conto di addebito *</Label>
                  <Select value={contoId} onValueChange={setContoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli il conto" />
                    </SelectTrigger>
                    <SelectContent>
                      {conti.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.banca ? `${c.banca} ${c.nome_conto}` : c.nome_conto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli la categoria" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {categorie.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Numero contratto</Label>
                  <Input
                    value={numeroContratto}
                    onChange={(e) => setNumeroContratto(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Forma</Label>
                  <Select value={forma} onValueChange={setForma}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rateale">Rateale</SelectItem>
                      <SelectItem value="revolving">Revolving</SelectItem>
                      <SelectItem value="leasing">Leasing</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Testo da cercare nella descrizione *</Label>
                  <Input
                    value={testoRegola}
                    onChange={(e) => setTestoRegola(e.target.value)}
                    placeholder="Es. FINDOMESTIC"
                  />
                  <p className="text-xs text-muted-foreground">
                    Serve a riconoscere automaticamente l'addebito della rata nei movimenti del conto.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Data stipula</Label>
                  <Input
                    type="date"
                    value={dataStipula}
                    onChange={(e) => setDataStipula(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Note</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Come caricare il piano</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { k: "calcola" as Modo, t: "Calcola", d: "Da capitale e TAN" },
                  { k: "semplice" as Modo, t: "Rata × numero", d: "Rata fissa" },
                  { k: "pdf" as Modo, t: "Da PDF", d: "Piano dell'ente" },
                ].map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setModo(o.k)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      modo === o.k
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">{o.t}</p>
                    <p className="text-xs text-muted-foreground">{o.d}</p>
                  </button>
                ))}
              </div>
            </div>

            {modo === "calcola" && (
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Capitale (€)</Label>
                  <Input value={capitale} onChange={(e) => setCapitale(e.target.value)} placeholder="10.000,00" />
                </div>
                <div className="space-y-1.5">
                  <Label>TAN (%)</Label>
                  <Input value={tan} onChange={(e) => setTan(e.target.value)} placeholder="6,9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Numero rate</Label>
                  <Input value={numeroRate} onChange={(e) => setNumeroRate(e.target.value)} placeholder="24" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prima scadenza</Label>
                  <Input type="date" value={primaScadenza} onChange={(e) => setPrimaScadenza(e.target.value)} />
                </div>
              </div>
            )}

            {modo === "semplice" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Importo rata (€)</Label>
                  <Input value={importoRata} onChange={(e) => setImportoRata(e.target.value)} placeholder="180,50" />
                </div>
                <div className="space-y-1.5">
                  <Label>Numero rate</Label>
                  <Input value={numeroRate} onChange={(e) => setNumeroRate(e.target.value)} placeholder="24" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prima scadenza</Label>
                  <Input type="date" value={primaScadenza} onChange={(e) => setPrimaScadenza(e.target.value)} />
                </div>
              </div>
            )}

            {modo === "pdf" && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Manda il PDF del piano a Claude: lo carica lui.
              </div>
            )}

            {rate.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Rata</p>
                    <p className="font-semibold text-foreground">{fmtEur(rate[0].importo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Totale</p>
                    <p className="font-semibold text-foreground">{fmtEur(totale)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Interessi</p>
                    <p className="font-semibold text-foreground">{fmtEur(interessi)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fine</p>
                    <p className="font-semibold text-foreground">{fmtData(dataFine)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead className="text-right">Rata</TableHead>
                      <TableHead className="text-right">Capitale</TableHead>
                      <TableHead className="text-right">Interessi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anteprima.map((r) => (
                      <TableRow key={r.numero_rata}>
                        <TableCell>{r.numero_rata}</TableCell>
                        <TableCell>{fmtData(r.data_scadenza)}</TableCell>
                        <TableCell className="text-right">{fmtEur(r.importo)}</TableCell>
                        <TableCell className="text-right">{fmtEur(r.quota_capitale)}</TableCell>
                        <TableCell className="text-right">
                          {r.quota_interessi === null ? "—" : fmtEur(r.quota_interessi)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={salva} disabled={!puoSalvare || crea.isPending}>
            {crea.isPending ? "Salvataggio…" : caricaPiano ? "Carica piano" : "Crea"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
