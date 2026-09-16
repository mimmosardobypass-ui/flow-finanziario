import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import {
  useCreateConto,
  useUpdateConto,
  useMovimentiDopoData,
  Conto,
  TipoConto,
} from "@/hooks/useConti";
import { parseImporto } from "@/components/finanziamenti/utils";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conto?: Conto | null;
  focusSaldo?: boolean;
}

const TIPI: { value: TipoConto; label: string }[] = [
  { value: "conto_corrente", label: "Conto corrente" },
  { value: "carta", label: "Carta" },
  { value: "pos", label: "POS" },
  { value: "cassa", label: "Cassa" },
  { value: "altro", label: "Altro" },
];

const COLORI = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];

const eur = (v: number) =>
  `${v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function ContoDialog({ open, onOpenChange, conto, focusSaldo }: Props) {
  const [nomeConto, setNomeConto] = useState("");
  const [tipo, setTipo] = useState<TipoConto>("conto_corrente");
  const [banca, setBanca] = useState("");
  const [identificativo, setIdentificativo] = useState("");
  const [intestatario, setIntestatario] = useState("");
  const [colore, setColore] = useState<string>("");
  const [note, setNote] = useState("");
  const [saldoRiferimento, setSaldoRiferimento] = useState("");
  const [saldoRiferimentoData, setSaldoRiferimentoData] = useState("");
  const [verificatoDal, setVerificatoDal] = useState("");
  const [verificatoFinoAl, setVerificatoFinoAl] = useState("");
  const [saldoIniziale, setSaldoIniziale] = useState("0");
  const [attivo, setAttivo] = useState(true);
  const [avanzateAperte, setAvanzateAperte] = useState(false);

  const saldoRef = useRef<HTMLDivElement | null>(null);

  const createMutation = useCreateConto();
  const updateMutation = useUpdateConto();
  const isEditing = !!conto;

  useEffect(() => {
    if (conto) {
      setNomeConto(conto.nome_conto);
      setTipo((conto.tipo as TipoConto) || "conto_corrente");
      setBanca(conto.banca || "");
      setIdentificativo(conto.identificativo || "");
      setIntestatario(conto.intestatario || "");
      setColore(conto.colore || "");
      setNote(conto.note || "");
      setSaldoRiferimento(
        conto.saldo_riferimento === null || conto.saldo_riferimento === undefined
          ? ""
          : String(conto.saldo_riferimento).replace(".", ",")
      );
      setSaldoRiferimentoData(conto.saldo_riferimento_data || "");
      setVerificatoDal(conto.verificato_dal || "");
      setVerificatoFinoAl(conto.verificato_fino_al || "");
      setSaldoIniziale(String(conto.saldo_iniziale));
      setAttivo(conto.attivo);
    } else {
      setNomeConto("");
      setTipo("conto_corrente");
      setBanca("");
      setIdentificativo("");
      setIntestatario("");
      setColore("");
      setNote("");
      setSaldoRiferimento("");
      setSaldoRiferimentoData("");
      setVerificatoDal("");
      setVerificatoFinoAl("");
      setSaldoIniziale("0");
      setAttivo(true);
    }
    setAvanzateAperte(false);
  }, [conto, open]);

  useEffect(() => {
    if (open && focusSaldo) {
      const t = setTimeout(() => saldoRef.current?.scrollIntoView({ block: "center" }), 120);
      return () => clearTimeout(t);
    }
  }, [open, focusSaldo]);

  const saldoRifNum = saldoRiferimento.trim() ? parseImporto(saldoRiferimento) : null;
  const { data: movimentiDopo = 0 } = useMovimentiDopoData(
    conto?.id,
    saldoRiferimentoData || undefined
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeConto.trim()) return;

    if (saldoRifNum !== null && !saldoRiferimentoData) {
      toast({
        title: "Manca la data del saldo",
        description: "Indica a che data hai letto il saldo reale.",
        variant: "destructive",
      });
      return;
    }

    const dati = {
      nome_conto: nomeConto.trim(),
      tipo,
      banca: banca.trim() || null,
      identificativo: identificativo.trim() || null,
      intestatario: intestatario.trim() || null,
      colore: colore || null,
      note: note.trim() || null,
      saldo_iniziale: parseImporto(saldoIniziale) || 0,
      saldo_riferimento: saldoRifNum,
      saldo_riferimento_data: saldoRifNum === null ? null : saldoRiferimentoData,
      verificato_dal: verificatoDal || null,
      verificato_fino_al: verificatoFinoAl || null,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: conto.id, attivo, ...dati });
        toast({ title: "Conto aggiornato" });
      } else {
        await createMutation.mutateAsync(dati);
        toast({ title: "Conto creato" });
      }
      onOpenChange(false);
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile salvare il conto",
        variant: "destructive",
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica conto" : "Nuovo conto"}</DialogTitle>
          <DialogDescription>
            Dati del conto, saldo reale letto sull'estratto e periodo verificato.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dati */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Dati</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nome_conto">Nome *</Label>
                <Input
                  id="nome_conto"
                  value={nomeConto}
                  onChange={(e) => setNomeConto(e.target.value)}
                  placeholder="Es. Conto Corrente"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConto)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPI.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banca">Banca</Label>
                <Input
                  id="banca"
                  value={banca}
                  onChange={(e) => setBanca(e.target.value)}
                  placeholder="Es. Intesa Sanpaolo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="identificativo">Identificativo</Label>
                <Input
                  id="identificativo"
                  value={identificativo}
                  onChange={(e) => setIdentificativo(e.target.value)}
                  placeholder="Numero conto, carta o IBAN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intestatario">Intestatario</Label>
                <Input
                  id="intestatario"
                  value={intestatario}
                  onChange={(e) => setIntestatario(e.target.value)}
                  placeholder="Es. Mimmo"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Colore</Label>
                <div className="flex items-center gap-2">
                  {COLORI.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColore(colore === c ? "" : c)}
                      aria-label={`Colore ${c}`}
                      className={`h-7 w-7 rounded-full border-2 flex items-center justify-center ${
                        colore === c ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {colore === c && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                  {colore && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setColore("")}>
                      Nessuno
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </section>

          {/* Saldo reale */}
          <section className="space-y-4 border-t border-border pt-5" ref={saldoRef}>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Saldo reale</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Inserisci il saldo che leggi sull'estratto o sull'app della banca: l'app calcola il
                saldo attuale aggiungendo i movimenti successivi a quella data.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="saldo_riferimento">Saldo (€)</Label>
                <Input
                  id="saldo_riferimento"
                  value={saldoRiferimento}
                  onChange={(e) => setSaldoRiferimento(e.target.value)}
                  placeholder="Es. 1.234,56"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saldo_riferimento_data">Data del saldo</Label>
                <Input
                  id="saldo_riferimento_data"
                  type="date"
                  value={saldoRiferimentoData}
                  onChange={(e) => setSaldoRiferimentoData(e.target.value)}
                />
              </div>
            </div>
            {saldoRifNum !== null && saldoRiferimentoData && (
              <p className="text-sm text-muted-foreground">
                Saldo attuale risultante:{" "}
                <span className="font-semibold text-foreground">
                  {eur(saldoRifNum + movimentiDopo)}
                </span>
                {isEditing && (
                  <span className="text-xs">
                    {" "}
                    ({eur(saldoRifNum)} + {eur(movimentiDopo)} di movimenti successivi)
                  </span>
                )}
              </p>
            )}
          </section>

          {/* Verifica estratto */}
          <section className="space-y-4 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-foreground">Verifica estratto</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="verificato_dal">Verificato dal</Label>
                <Input
                  id="verificato_dal"
                  type="date"
                  value={verificatoDal}
                  onChange={(e) => setVerificatoDal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verificato_fino_al">Verificato al</Label>
                <Input
                  id="verificato_fino_al"
                  type="date"
                  value={verificatoFinoAl}
                  onChange={(e) => setVerificatoFinoAl(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Avanzate */}
          <section className="border-t border-border pt-5">
            <button
              type="button"
              onClick={() => setAvanzateAperte((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              {avanzateAperte ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Avanzate
            </button>
            {avanzateAperte && (
              <div className="space-y-2 mt-4">
                <Label htmlFor="saldo_iniziale">Saldo iniziale (€)</Label>
                <Input
                  id="saldo_iniziale"
                  value={saldoIniziale}
                  onChange={(e) => setSaldoIniziale(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Usato solo se non c'è un saldo reale.
                </p>
              </div>
            )}
          </section>

          {isEditing && (
            <div className="flex items-center justify-between border-t border-border pt-5">
              <Label htmlFor="attivo">Conto attivo</Label>
              <Switch id="attivo" checked={attivo} onCheckedChange={setAttivo} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvataggio..." : isEditing ? "Salva" : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
