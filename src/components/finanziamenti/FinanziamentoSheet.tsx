import { useMemo, useState } from "react";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { AlertTriangle, MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useFinanziamentoDettaglio,
  useProposteRate,
  useScollegaRata,
  useSegnaRataPagataEnte,
  type Finanziamento,
  type RataFinanziamento,
} from "@/hooks/useFinanziamenti";
import { fmtEur, fmtNum, fmtData, iniziali, titoloContratto, tronca, oggiISO } from "./utils";
import { AbbinaRateDialog } from "./AbbinaRateDialog";
import { CollegaMovimentoDialog } from "./CollegaMovimentoDialog";
import { ContrattoTab } from "./ContrattoTab";
import { VerificaTab } from "./VerificaTab";
import { NuovoFinanziamentoDialog } from "./NuovoFinanziamentoDialog";

interface Props {
  contratto: Finanziamento | null;
  onOpenChange: (v: boolean) => void;
}

type StatoRata = { testo: string; classe: string };

function statoRata(r: RataFinanziamento): StatoRata {
  const oggi = oggiISO();
  if (r.stato_effettivo === "parziale")
    return { testo: "Parziale", classe: "border-warning/40 bg-warning/10 text-warning" };
  if (r.stato_effettivo === "pagata" || r.stato === "pagata") {
    if (r.fonte_pagamento === "ente")
      return { testo: "Senza movimento", classe: "border-warning/40 bg-warning/10 text-warning" };
    const ritardo =
      r.data_pagamento && r.data_scadenza
        ? differenceInDays(parseISO(r.data_pagamento), parseISO(r.data_scadenza)) > 5
        : false;
    if (ritardo || r.tentativi_falliti > 0)
      return { testo: "In ritardo", classe: "border-warning/40 bg-warning/10 text-warning" };
    return { testo: "Pagata", classe: "border-success/40 bg-success/10 text-success" };
  }
  if (r.data_scadenza && r.data_scadenza < oggi)
    return { testo: "Scaduta", classe: "border-destructive/40 bg-destructive/10 text-destructive" };
  return { testo: "Da pagare", classe: "border-border bg-muted text-muted-foreground" };
}

export function FinanziamentoSheet({ contratto, onOpenChange }: Props) {
  const { data: dettaglio } = useFinanziamentoDettaglio(contratto?.id ?? null);
  const { data: proposte = [] } = useProposteRate(contratto?.id ?? null, !!contratto);
  const scollega = useScollegaRata();
  const segnaEnte = useSegnaRataPagataEnte();

  const [abbinaAperto, setAbbinaAperto] = useState(false);
  const [caricaPiano, setCaricaPiano] = useState(false);
  const [rataDaCollegare, setRataDaCollegare] = useState<RataFinanziamento | null>(null);
  const [rataDaScollegare, setRataDaScollegare] = useState<RataFinanziamento | null>(null);
  const [rataEnte, setRataEnte] = useState<RataFinanziamento | null>(null);
  const [dataEnte, setDataEnte] = useState(oggiISO());
  const [notaEnte, setNotaEnte] = useState("");

  const rate = dettaglio?.rate ?? [];
  const movimenti = dettaglio?.movimenti ?? {};
  const speseMovimenti = dettaglio?.spese_movimenti ?? {};
  const eventi = dettaglio?.eventi ?? [];
  const regole = dettaglio?.regole ?? [];

  const prossimaId = useMemo(() => {
    const oggi = oggiISO();
    return (
      rate.find((r) => r.stato !== "pagata" && (r.data_scadenza ?? "") >= oggi)?.id ?? null
    );
  }, [rate]);

  if (!contratto) return null;

  const esitoClasse: Record<string, string> = {
    ok: "bg-success",
    attenzione: "bg-warning",
    problema: "bg-destructive",
    info: "bg-primary",
  };

  return (
    <>
      <Sheet open={!!contratto} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[900px]">
          <SheetHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                {iniziali(contratto.societa_finanziaria)}
              </div>
              <div className="min-w-0">
                <SheetTitle className="truncate">
                  {titoloContratto(contratto.societa_finanziaria, contratto.nome)}
                </SheetTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {[contratto.beneficiario, contratto.nome_conto].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Rate pagate</p>
                <p className="font-semibold text-foreground">
                  {contratto.rate_pagate} / {contratto.rate_totali}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Da pagare</p>
                <p className="font-semibold text-foreground">{fmtEur(contratto.residuo_da_pagare)}</p>
                {contratto.residuo_capitale > 0 && (
                  <p className="text-xs text-muted-foreground">
                    di cui capitale {fmtEur(contratto.residuo_capitale)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prossima rata</p>
                <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                  {contratto.prossima_scadenza
                    ? `${fmtEur(contratto.prossima_importo)} · ${fmtData(contratto.prossima_scadenza)}`
                    : "—"}
                  {contratto.rate_scadute > 0 && (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      {contratto.rate_scadute} scadute
                    </Badge>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fine</p>
                <p className="font-semibold text-foreground">{fmtData(contratto.data_fine)}</p>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="piano" className="mt-6">
            <TabsList>
              <TabsTrigger value="piano">Piano</TabsTrigger>
              <TabsTrigger value="storico">Storico</TabsTrigger>
              <TabsTrigger value="contratto">Contratto</TabsTrigger>
              <TabsTrigger value="verifica">Verifica</TabsTrigger>
            </TabsList>

            {/* PIANO */}
            <TabsContent value="piano" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Origine piano</p>
                  <p className="text-sm font-medium text-foreground">
                    {contratto.origine_piano ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagato finora</p>
                  <p className="text-sm font-medium text-foreground">{fmtEur(contratto.pagato_piano)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Spese e commissioni</p>
                  <p className="text-sm font-medium text-foreground">{fmtEur(contratto.spese_totali)}</p>
                </div>
              </div>

              {proposte.length > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                  <p className="text-sm text-foreground">
                    {proposte.length} movimenti corrispondono a rate di questo piano
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setAbbinaAperto(true)}>
                    Rivedi abbinamenti
                  </Button>
                </div>
              )}

              {rate.length === 0 ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <p className="text-sm font-medium text-foreground">
                    Il piano di ammortamento non è ancora caricato
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Importa dal PDF</p>
                      Manda il PDF del piano a Claude, lo carica lui.
                    </div>
                    <Button variant="outline" onClick={() => setCaricaPiano(true)}>
                      Calcola da capitale e TAN
                    </Button>
                    <Button variant="outline" onClick={() => setCaricaPiano(true)}>
                      Solo rata × numero
                    </Button>
                  </div>
                </div>
              ) : (
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 px-2">#</TableHead>
                      <TableHead className="w-[96px] px-2">Scadenza</TableHead>
                      <TableHead className="w-[100px] whitespace-nowrap px-2 text-right">
                        Rata
                      </TableHead>
                      <TableHead className="w-[92px] px-2">Stato</TableHead>
                      <TableHead className="w-[128px] whitespace-nowrap px-2">
                        Pagamento
                      </TableHead>
                      <TableHead className="hidden px-2 sm:table-cell">Movimento</TableHead>
                      <TableHead className="w-10 px-2" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rate.map((r) => {
                      const st = statoRata(r);
                      const mov = movimenti[r.id];
                      const speseMov = speseMovimenti[r.id] ?? [];
                      const totaleSpeseMov = speseMov.reduce((a, s) => a + s.amount, 0);
                      const scaduta = r.stato !== "pagata" && (r.data_scadenza ?? "") < oggiISO();
                      return (
                        <TableRow
                          key={r.id}
                          className={cn(r.id === prossimaId && "bg-primary/5")}
                        >
                          <TableCell className="px-2">{r.numero_rata}</TableCell>
                          <TableCell className="whitespace-nowrap px-2">
                            <span className={cn(r.stimata && "italic")}>{fmtData(r.data_scadenza)}</span>
                            {r.id === prossimaId && (
                              <div className="text-xs text-primary">prossima</div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 text-right">
                            <div>{fmtEur(r.importo)}</div>
                            {((r.quota_capitale ?? 0) > 0 || (r.quota_interessi ?? 0) > 0) && (
                              <div className="text-right text-xs text-muted-foreground">
                                {(r.quota_capitale ?? 0) > 0 && (
                                  <div>cap. {fmtNum(r.quota_capitale)}</div>
                                )}
                                {(r.quota_interessi ?? 0) > 0 && (
                                  <div>int. {fmtNum(r.quota_interessi)}</div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "max-w-full whitespace-normal text-center leading-tight",
                                st.classe,
                              )}
                            >
                              {st.testo}
                            </Badge>
                            {r.stato_effettivo === "parziale" && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {fmtEur(r.imputato)} di {fmtEur(r.importo)}
                              </p>
                            )}
                            {r.nota && (
                              <p className="mt-1 truncate text-xs text-muted-foreground" title={r.nota}>
                                {r.nota}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2">
                            <div>{r.data_pagamento ? fmtData(r.data_pagamento) : "—"}</div>
                            {r.importo_pagato !== null &&
                              r.importo !== null &&
                              Math.abs(r.importo_pagato - r.importo) >= 0.01 && (
                                <div className="text-xs text-muted-foreground">
                                  {fmtEur(r.importo_pagato)}
                                </div>
                              )}
                            {speseMov.length > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">
                                    spese {fmtEur(r.spese > 0 ? r.spese : totaleSpeseMov)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="mb-1 font-medium">Spese accessorie</p>
                                  <ul className="space-y-0.5">
                                    {speseMov.map((s) => (
                                      <li key={s.id} className="text-xs">
                                        {fmtData(s.date)} · {tronca(s.description, 30)} ·{" "}
                                        {fmtEur(s.amount)}
                                      </li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            ) : r.spese > 0 ? (
                              <div className="text-xs text-muted-foreground">
                                spese {fmtEur(r.spese)}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="hidden px-2 sm:table-cell">
                            {r.movimenti_imputati.length > 0 ? (
                              <div className="min-w-0 space-y-1.5">
                                {r.movimenti_imputati.map((m) => (
                                  <div key={m.transaction_id} className="min-w-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <p className="cursor-help truncate text-sm">
                                          {m.descrizione ?? "—"}
                                        </p>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs break-words">
                                        {m.descrizione ?? "—"}
                                      </TooltipContent>
                                    </Tooltip>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {[m.conto ?? "—", fmtData(m.data)].join(" · ")}
                                      {r.confidenza ? ` · confidenza ${r.confidenza}` : ""}
                                    </p>
                                    {m.cumulativo && (
                                      <p className="truncate text-xs text-muted-foreground">
                                        quota {fmtEur(m.importo_imputato)} di un pagamento da{" "}
                                        {fmtEur(m.importo_movimento)}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="px-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setRataDaImputare(r)}>
                                  Imputa pagamento
                                </DropdownMenuItem>
                                {r.movimenti_imputati.length > 0 && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await scollegaPagamento.mutateAsync({ rata_id: r.id });
                                      toast.success("Pagamento scollegato dalla rata");
                                    }}
                                  >
                                    Scollega pagamento
                                  </DropdownMenuItem>
                                )}
                                {r.stato === "pagata" && mov && (
                                  <DropdownMenuItem onClick={() => setRataDaScollegare(r)}>
                                    Scollega movimento
                                  </DropdownMenuItem>
                                )}
                                {r.stato !== "pagata" && scaduta && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setRataEnte(r);
                                      setDataEnte(r.data_scadenza ?? oggiISO());
                                      setNotaEnte("");
                                    }}
                                  >
                                    Segna pagata secondo l'ente
                                  </DropdownMenuItem>
                                )}
                                {(r.stato !== "pagata" || r.fonte_pagamento === "ente") && (
                                  <DropdownMenuItem onClick={() => setRataDaCollegare(r)}>
                                    Collega un movimento…
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>

                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* STORICO */}
            <TabsContent value="storico" className="mt-4">
              {eventi.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>
              ) : (
                <div className="space-y-4 border-l border-border pl-5">
                  {eventi.map((e) => (
                    <div key={e.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full",
                          esitoClasse[e.esito] ?? "bg-primary",
                        )}
                      />
                      <p className="text-xs text-muted-foreground">{fmtData(e.data)}</p>
                      <p className="text-sm text-foreground">{e.descrizione}</p>
                      {e.importo !== null && (
                        <p className="text-sm font-medium text-foreground">{fmtEur(e.importo)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* CONTRATTO */}
            <TabsContent value="contratto" className="mt-4">
              <ContrattoTab contratto={contratto} regole={regole} />
            </TabsContent>

            {/* VERIFICA */}
            <TabsContent value="verifica" className="mt-4">
              <VerificaTab scadenziarioId={contratto.id} eventi={eventi} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AbbinaRateDialog
        open={abbinaAperto}
        onOpenChange={setAbbinaAperto}
        scadenziarioId={contratto.id}
      />

      <NuovoFinanziamentoDialog
        open={caricaPiano}
        onOpenChange={setCaricaPiano}
        contrattoId={contratto.id}
      />

      <CollegaMovimentoDialog
        rata={rataDaCollegare}
        onOpenChange={(v) => !v && setRataDaCollegare(null)}
      />

      {/* Segna pagata secondo l'ente */}
      <Dialog open={!!rataEnte} onOpenChange={(v) => !v && setRataEnte(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Segna pagata secondo l'ente</DialogTitle>
            <DialogDescription>
              La rata risulta pagata dall'ente ma non c'è un movimento bancario collegato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Data del pagamento</Label>
              <Input type="date" value={dataEnte} onChange={(e) => setDataEnte(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nota</Label>
              <Textarea rows={2} value={notaEnte} onChange={(e) => setNotaEnte(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRataEnte(null)}>
              Annulla
            </Button>
            <Button
              disabled={segnaEnte.isPending}
              onClick={async () => {
                if (!rataEnte) return;
                await segnaEnte.mutateAsync({
                  rata_id: rataEnte.id,
                  data: dataEnte,
                  nota: notaEnte.trim() || undefined,
                });
                toast.success("Rata segnata come pagata secondo l'ente");
                setRataEnte(null);
              }}
            >
              Conferma
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!rataDaScollegare}
        onOpenChange={(v) => !v && setRataDaScollegare(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scollegare il movimento?</AlertDialogTitle>
            <AlertDialogDescription>
              La rata tornerà da pagare e il movimento resterà libero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!rataDaScollegare) return;
                await scollega.mutateAsync(rataDaScollegare.id);
                toast.success("Movimento scollegato");
              }}
            >
              Scollega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
