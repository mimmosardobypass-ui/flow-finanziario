import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContiAttivi } from "@/hooks/useConti";
import {
  useEstinguiFinanziamento,
  useSalvaRegola,
  useUpdateFinanziamento,
  type Finanziamento,
  type RegolaFinanziamento,
} from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData, parseImporto } from "./utils";

interface Props {
  contratto: Finanziamento;
  regole: RegolaFinanziamento[];
}

function Valore({ etichetta, valore }: { etichetta: string; valore: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2">
      <span className="text-sm text-muted-foreground">{etichetta}</span>
      {valore ? (
        <span className="text-right text-sm font-medium text-foreground">{valore}</span>
      ) : (
        <span className="text-right text-sm italic text-warning">Da inserire</span>
      )}
    </div>
  );
}

export function ContrattoTab({ contratto, regole }: Props) {
  const { data: conti = [] } = useContiAttivi();
  const aggiorna = useUpdateFinanziamento();
  const estingui = useEstinguiFinanziamento();
  const salvaRegola = useSalvaRegola();

  const [modifica, setModifica] = useState(false);
  const [confermaEstinzione, setConfermaEstinzione] = useState(false);
  const [regolaAperta, setRegolaAperta] = useState<Partial<RegolaFinanziamento> | null>(null);

  const [form, setForm] = useState({
    nome: contratto.nome ?? "",
    societa_finanziaria: contratto.societa_finanziaria ?? "",
    numero_contratto: contratto.numero_contratto ?? "",
    intestatario: contratto.intestatario ?? "",
    beneficiario: contratto.beneficiario ?? "",
    forma: contratto.forma ?? "rateale",
    capitale: contratto.capitale?.toString().replace(".", ",") ?? "",
    fido: contratto.fido?.toString().replace(".", ",") ?? "",
    tan: contratto.tan?.toString().replace(".", ",") ?? "",
    taeg: contratto.taeg?.toString().replace(".", ",") ?? "",
    importo_rata: contratto.importo_rata?.toString().replace(".", ",") ?? "",
    giorno_addebito: contratto.giorno_addebito?.toString() ?? "",
    data_stipula: contratto.data_stipula ?? "",
    data_erogazione: contratto.data_erogazione ?? "",
    mandato_sdd: contratto.mandato_sdd ?? "",
    note: contratto.note ?? "",
    conto_id: contratto.conto_id ?? "",
  });

  const salvaContratto = async () => {
    await aggiorna.mutateAsync({
      id: contratto.id,
      dati: {
        nome: form.nome.trim() || null,
        societa_finanziaria: form.societa_finanziaria.trim(),
        numero_contratto: form.numero_contratto.trim() || "—",
        intestatario: form.intestatario.trim() || null,
        beneficiario: form.beneficiario.trim() || null,
        forma: form.forma || null,
        capitale: parseImporto(form.capitale),
        fido: parseImporto(form.fido),
        tan: parseImporto(form.tan),
        taeg: parseImporto(form.taeg),
        importo_rata: parseImporto(form.importo_rata),
        giorno_addebito: form.giorno_addebito ? Number(form.giorno_addebito) : null,
        data_stipula: form.data_stipula || null,
        data_erogazione: form.data_erogazione || null,
        mandato_sdd: form.mandato_sdd.trim() || null,
        note: form.note.trim() || null,
        conto_id: form.conto_id || null,
      },
    });
    toast.success("Dati del contratto aggiornati");
    setModifica(false);
  };

  const nomeConto = (id: string | null) =>
    conti.find((c) => c.id === id)?.nome_conto ?? (id ? "—" : "Tutti i conti");

  return (
    <div className="space-y-6">
      <div>
        <Valore etichetta="Ente" valore={contratto.societa_finanziaria || null} />
        <Valore etichetta="Nome" valore={contratto.nome} />
        <Valore etichetta="Forma" valore={contratto.forma} />
        <Valore etichetta="Numero contratto" valore={contratto.numero_contratto} />
        <Valore
          etichetta="Numero utilizzo"
          valore={contratto.numero_utilizzo?.toString() ?? null}
        />
        <Valore etichetta="Intestatario" valore={contratto.intestatario} />
        <Valore etichetta="Per chi" valore={contratto.beneficiario} />
        <Valore etichetta="Categoria" valore={contratto.categoria_nome} />
        <Valore
          etichetta="Conto di addebito"
          valore={
            contratto.nome_conto
              ? [contratto.banca, contratto.nome_conto].filter(Boolean).join(" ")
              : null
          }
        />
        <Valore etichetta="Capitale" valore={contratto.capitale ? fmtEur(contratto.capitale) : null} />
        <Valore etichetta="Fido" valore={contratto.fido ? fmtEur(contratto.fido) : null} />
        <Valore etichetta="TAN" valore={contratto.tan !== null ? `${contratto.tan} %` : null} />
        <Valore etichetta="TAEG" valore={contratto.taeg !== null ? `${contratto.taeg} %` : null} />
        <Valore
          etichetta="Importo rata"
          valore={contratto.importo_rata ? fmtEur(contratto.importo_rata) : null}
        />
        <Valore
          etichetta="Giorno di addebito"
          valore={contratto.giorno_addebito?.toString() ?? null}
        />
        <Valore
          etichetta="Data stipula"
          valore={contratto.data_stipula ? fmtData(contratto.data_stipula) : null}
        />
        <Valore
          etichetta="Data erogazione"
          valore={contratto.data_erogazione ? fmtData(contratto.data_erogazione) : null}
        />
        <Valore
          etichetta="Data estinzione"
          valore={contratto.data_estinzione ? fmtData(contratto.data_estinzione) : null}
        />
        <Valore etichetta="Mandato SDD" valore={contratto.mandato_sdd} />
        <Valore etichetta="Origine piano" valore={contratto.origine_piano} />
        <Valore etichetta="Note" valore={contratto.note} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Regole di riconoscimento</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setRegolaAperta({
                scadenziario_id: contratto.id,
                ruolo: "rata",
                conto_id: contratto.conto_id,
                testo: "",
                confidenza: "alta",
                importo_min: -0.02,
                importo_max: 0.02,
                giorni_prima: 3,
                giorni_dopo: 10,
                attiva: true,
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Aggiungi
          </Button>
        </div>
        {regole.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna regola: i movimenti di questo contratto non vengono riconosciuti da soli.
          </p>
        ) : (
          <div className="space-y-2">
            {regole.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.ruolo === "spesa" ? "Spesa" : "Rata"}</Badge>
                    <span className="text-sm font-medium text-foreground">{r.testo}</span>
                    {!r.attiva && (
                      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                        disattivata
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {nomeConto(r.conto_id)} · importo da {r.importo_min ?? "—"} a {r.importo_max ?? "—"} ·
                    da {r.giorni_prima} giorni prima a {r.giorni_dopo} dopo · confidenza {r.confidenza}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setRegolaAperta(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await salvaRegola.mutateAsync({
                        id: r.id,
                        scadenziario_id: contratto.id,
                        attiva: !r.attiva,
                      });
                      toast.success(r.attiva ? "Regola disattivata" : "Regola attivata");
                    }}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={() => setModifica(true)}>
          Modifica dati
        </Button>
        {contratto.stato !== "estinto" && (
          <Button variant="outline" onClick={() => setConfermaEstinzione(true)}>
            Segna come estinto
          </Button>
        )}
      </div>

      {/* Modifica dati */}
      <Dialog open={modifica} onOpenChange={setModifica}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica dati del contratto</DialogTitle>
            <DialogDescription>Aggiorna le informazioni del finanziamento.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["societa_finanziaria", "Ente"],
                  ["nome", "Nome breve"],
                  ["numero_contratto", "Numero contratto"],
                  ["intestatario", "Intestatario"],
                  ["beneficiario", "Per chi"],
                  ["capitale", "Capitale (€)"],
                  ["fido", "Fido (€)"],
                  ["tan", "TAN (%)"],
                  ["taeg", "TAEG (%)"],
                  ["importo_rata", "Importo rata (€)"],
                  ["giorno_addebito", "Giorno di addebito"],
                  ["mandato_sdd", "Mandato SDD"],
                ] as const
              ).map(([campo, etichetta]) => (
                <div key={campo} className="space-y-1.5">
                  <Label>{etichetta}</Label>
                  <Input
                    value={form[campo]}
                    onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Data stipula</Label>
                <Input
                  type="date"
                  value={form.data_stipula}
                  onChange={(e) => setForm((f) => ({ ...f, data_stipula: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data erogazione</Label>
                <Input
                  type="date"
                  value={form.data_erogazione}
                  onChange={(e) => setForm((f) => ({ ...f, data_erogazione: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Forma</Label>
                <Select value={form.forma} onValueChange={(v) => setForm((f) => ({ ...f, forma: v }))}>
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
              <div className="space-y-1.5">
                <Label>Conto di addebito</Label>
                <Select
                  value={form.conto_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, conto_id: v }))}
                >
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Note</Label>
                <Textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModifica(false)}>
              Annulla
            </Button>
            <Button onClick={salvaContratto} disabled={aggiorna.isPending}>
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Regola */}
      <Dialog open={!!regolaAperta} onOpenChange={(v) => !v && setRegolaAperta(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{regolaAperta?.id ? "Modifica regola" : "Nuova regola"}</DialogTitle>
            <DialogDescription>
              Testo cercato nella descrizione dei movimenti per riconoscere le rate.
            </DialogDescription>
          </DialogHeader>
          {regolaAperta && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Testo</Label>
                <Input
                  value={regolaAperta.testo ?? ""}
                  onChange={(e) => setRegolaAperta((r) => ({ ...r!, testo: e.target.value }))}
                  placeholder="%FINDOMESTIC%"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ruolo</Label>
                <Select
                  value={regolaAperta.ruolo ?? "rata"}
                  onValueChange={(v) => setRegolaAperta((r) => ({ ...r!, ruolo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rata">Rata</SelectItem>
                    <SelectItem value="spesa">Spesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Confidenza</Label>
                <Select
                  value={regolaAperta.confidenza ?? "alta"}
                  onValueChange={(v) => setRegolaAperta((r) => ({ ...r!, confidenza: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="bassa">Bassa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Scarto minimo (€)</Label>
                <Input
                  value={regolaAperta.importo_min?.toString() ?? ""}
                  onChange={(e) =>
                    setRegolaAperta((r) => ({ ...r!, importo_min: parseImporto(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Scarto massimo (€)</Label>
                <Input
                  value={regolaAperta.importo_max?.toString() ?? ""}
                  onChange={(e) =>
                    setRegolaAperta((r) => ({ ...r!, importo_max: parseImporto(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Giorni prima</Label>
                <Input
                  value={regolaAperta.giorni_prima?.toString() ?? "3"}
                  onChange={(e) =>
                    setRegolaAperta((r) => ({ ...r!, giorni_prima: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Giorni dopo</Label>
                <Input
                  value={regolaAperta.giorni_dopo?.toString() ?? "10"}
                  onChange={(e) =>
                    setRegolaAperta((r) => ({ ...r!, giorni_dopo: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Conto</Label>
                <Select
                  value={regolaAperta.conto_id ?? ""}
                  onValueChange={(v) => setRegolaAperta((r) => ({ ...r!, conto_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti i conti" />
                  </SelectTrigger>
                  <SelectContent>
                    {conti.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_conto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={regolaAperta.attiva ?? true}
                  onCheckedChange={(v) => setRegolaAperta((r) => ({ ...r!, attiva: v }))}
                />
                <Label>Regola attiva</Label>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRegolaAperta(null)}>
              Annulla
            </Button>
            <Button
              disabled={!regolaAperta?.testo?.trim() || salvaRegola.isPending}
              onClick={async () => {
                await salvaRegola.mutateAsync({
                  ...regolaAperta!,
                  scadenziario_id: contratto.id,
                });
                toast.success("Regola salvata");
                setRegolaAperta(null);
              }}
            >
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confermaEstinzione} onOpenChange={setConfermaEstinzione}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Segnare il contratto come estinto?</AlertDialogTitle>
            <AlertDialogDescription>
              Il contratto verrà spostato tra gli estinti con la data di oggi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await estingui.mutateAsync(contratto.id);
                toast.success("Contratto segnato come estinto");
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
