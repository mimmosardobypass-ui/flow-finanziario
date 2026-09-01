import { useMemo, useState } from "react";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useContiAttivi } from "@/hooks/useConti";
import {
  DocumentoSaldo, usePagaDocumentiContanti, useSaldoConto,
} from "@/hooks/useFattureFornitori";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("it-IT") : "—");
const oggiIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PagaContantiDialog({
  docs, onClose,
}: {
  docs: DocumentoSaldo[];
  onClose: () => void;
}) {
  const { data: conti = [] } = useContiAttivi();
  const paga = usePagaDocumentiContanti();

  const cassa = useMemo(
    () => conti.find((c) => c.nome_conto.trim().toLowerCase() === "cassa"),
    [conti]
  );
  const [contoId, setContoId] = useState<string>("");
  const contoScelto = contoId || cassa?.id || "";
  const { data: saldoAttuale = 0 } = useSaldoConto(contoScelto || null);

  const [data, setData] = useState(oggiIso());
  const [nota, setNota] = useState("");

  const totale = docs.reduce((s, d) => s + Math.max(0, d.residuo), 0);
  const saldoDopo = saldoAttuale - totale;
  const dataFutura = data > oggiIso();
  const valido = !!data && !dataFutura && !!contoScelto && docs.length > 0;

  const conferma = async () => {
    try {
      const r = await paga.mutateAsync({
        fattura_ids: docs.map((d) => d.id),
        data,
        conto_id: contoScelto || null,
        importi: null,
        nota: nota.trim() || null,
      });
      toast.success(
        `${r?.documenti ?? docs.length} document${(r?.documenti ?? docs.length) === 1 ? "o" : "i"} pagat${(r?.documenti ?? docs.length) === 1 ? "o" : "i"} in contanti · totale ${fmtEur(Number(r?.totale ?? totale))}`
      );
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Registra pagamento in contanti
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="rounded-md border">
            <div className="divide-y">
              {docs.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-[140px] flex-1 font-medium">{d.controparte ?? "—"}</span>
                  <span className="text-muted-foreground">{d.numero_documento ?? "—"}</span>
                  <span className="text-muted-foreground">{fmtDate(d.data_documento)}</span>
                  <span className="ml-auto font-semibold">{fmtEur(Math.max(0, d.residuo))}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-2 text-sm font-semibold">
              <span>Totale</span>
              <span>{fmtEur(totale)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data del pagamento</Label>
              <Input type="date" max={oggiIso()} value={data} onChange={(e) => setData(e.target.value)} />
              {dataFutura && (
                <p className="text-xs" style={{ color: "#f04438" }}>
                  La data non può essere futura
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Conto di cassa</Label>
              <Select value={contoScelto} onValueChange={setContoId}>
                <SelectTrigger><SelectValue placeholder="Seleziona un conto" /></SelectTrigger>
                <SelectContent>
                  {conti.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_conto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nota <span className="text-xs font-normal text-muted-foreground">(facoltativa)</span></Label>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} />
          </div>

          <div
            className="rounded-md border px-3 py-2 text-sm"
            style={{ backgroundColor: "#fffaeb", borderColor: "#fde3a7", color: "#b54708" }}
          >
            Verranno create {docs.length} uscite di cassa per un totale di {fmtEur(totale)}.
            Il saldo della Cassa passerà da {fmtEur(saldoAttuale)} a {fmtEur(saldoDopo)}.
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={conferma} disabled={!valido || paga.isPending}>
            {paga.isPending ? "Registrazione…" : "Conferma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
