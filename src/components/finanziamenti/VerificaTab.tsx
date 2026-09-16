import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useRegistraResiduoEnte,
  type EventoFinanziamento,
  type EsitoResiduo,
} from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData, oggiISO, parseImporto } from "./utils";
import { toast } from "sonner";

interface Props {
  scadenziarioId: string;
  eventi: EventoFinanziamento[];
}

export function VerificaTab({ scadenziarioId, eventi }: Props) {
  const [importo, setImporto] = useState("");
  const [data, setData] = useState(oggiISO());
  const [esito, setEsito] = useState<EsitoResiduo | null>(null);
  const registra = useRegistraResiduoEnte();

  const controlli = eventi.filter((e) => e.tipo === "verifica_residuo");

  const confronta = async () => {
    const num = parseImporto(importo);
    if (num === null) {
      toast.error("Inserisci il residuo letto sul portale");
      return;
    }
    const res = await registra.mutateAsync({
      scadenziario_id: scadenziarioId,
      importo: num,
      data,
    });
    setEsito(res);
  };

  const diff = esito?.differenza ?? 0;
  const coincide = esito !== null && Math.abs(diff) < 0.01;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Apri il portale dell'ente, leggi il debito residuo e scrivilo qui: l'app lo confronta con
        quello calcolato.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Residuo sul portale (€)</Label>
          <Input value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="4.320,15" />
        </div>
        <div className="space-y-1.5">
          <Label>Data lettura</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={confronta} disabled={registra.isPending} className="w-full">
            Confronta
          </Button>
        </div>
      </div>

      {esito && (
        <div
          className={
            coincide
              ? "flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-4"
              : "flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4"
          }
        >
          {coincide ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
          )}
          <div className="text-sm">
            {coincide ? (
              <p className="font-medium text-foreground">Coincide</p>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  Differenza di {fmtEur(Math.abs(diff))}
                </p>
                <p className="text-muted-foreground">
                  {esito.residuo_ente < esito.residuo_calcolato
                    ? "Probabilmente mancano rate pagate da registrare."
                    : "Forse c'è un pagamento extra o un'estinzione parziale da registrare."}
                </p>
              </>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Portale {fmtEur(esito.residuo_ente)} · calcolato dall'app{" "}
              {fmtEur(esito.residuo_calcolato)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Controlli precedenti</h4>
        {controlli.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun controllo registrato.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Esito</TableHead>
                <TableHead className="text-right">Importo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controlli.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmtData(e.data)}</TableCell>
                  <TableCell className="text-muted-foreground">{e.descrizione}</TableCell>
                  <TableCell className="text-right">
                    {e.importo === null ? "—" : fmtEur(e.importo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
