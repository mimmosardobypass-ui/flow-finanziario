import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DocumentoSaldo,
  NotaCreditoCompensabile,
  useCompensaDocumenti,
} from "@/hooks/useFattureFornitori";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("it-IT") : "—");

export function CompensaDialog({
  fattura, note, onClose,
}: {
  fattura: DocumentoSaldo;
  note: NotaCreditoCompensabile[];
  onClose: () => void;
}) {
  const [notaId, setNotaId] = useState(note.length === 1 ? note[0].nota_id : note[0]?.nota_id ?? "");
  const nota = useMemo(() => note.find((n) => n.nota_id === notaId) ?? null, [note, notaId]);
  const [importo, setImporto] = useState<string>(String((note[0]?.compensabile ?? 0).toFixed(2)));
  const [data, setData] = useState("");
  const compensa = useCompensaDocumenti();

  const scegli = (n: NotaCreditoCompensabile) => {
    setNotaId(n.nota_id);
    setImporto(n.compensabile.toFixed(2));
  };

  const max = nota?.compensabile ?? 0;
  const val = Number(importo.replace(",", ".")) || 0;
  const valido = !!nota && val > 0.005 && val <= max + 0.005;

  const conferma = async () => {
    if (!nota) return;
    try {
      const r = await compensa.mutateAsync({
        fattura_id: fattura.id,
        nota_id: nota.nota_id,
        importo: val,
        data: data || null,
      });
      toast.success(`Compensati ${fmtEur(Number(r?.importo ?? val))} fra fattura e nota di credito`);
      onClose();
    } catch (e: any) {
      toast.error(`${e?.message ?? e}`);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compensa fattura con nota di credito</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-semibold">{fattura.controparte ?? "—"}</div>
            <div className="text-muted-foreground">
              {fattura.numero_documento ?? "—"} · del {fmtDate(fattura.data_documento)}
            </div>
            <div className="mt-1 flex gap-4">
              <span>Totale <span className="font-semibold">{fmtEur(fattura.totale)}</span></span>
              <span>Residuo <span className="font-semibold">{fmtEur(fattura.residuo)}</span></span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Note di credito disponibili</Label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
              {note.map((n) => (
                <label
                  key={n.nota_id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                >
                  <input
                    type="radio"
                    className="mt-1"
                    checked={notaId === n.nota_id}
                    onChange={() => scegli(n)}
                  />
                  <span className="flex-1">
                    <span className="font-medium">{n.numero_documento ?? "—"}</span>
                    <span className="text-muted-foreground"> · del {fmtDate(n.data_documento)}</span>
                    <span className="block text-xs text-muted-foreground">
                      totale {fmtEur(n.totale)} · residuo {fmtEur(n.residuo)} · compensabile{" "}
                      <span className="font-semibold" style={{ color: "#7c3aed" }}>{fmtEur(n.compensabile)}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Importo da compensare</Label>
              <Input
                type="number"
                step="0.01"
                max={max}
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">massimo {fmtEur(max)}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data della compensazione (facoltativa)</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border px-3 py-2 text-sm" style={{ backgroundColor: "#f5f3ff", borderColor: "#ddd6fe", color: "#5b21b6" }}>
            Dopo la compensazione la fattura avrà un residuo di{" "}
            <span className="font-semibold">{fmtEur(Math.max(0, fattura.residuo - val))}</span> e la nota di{" "}
            <span className="font-semibold">{fmtEur(Math.max(0, (nota?.residuo ?? 0) - val))}</span>.
          </div>

          <p className="text-xs text-muted-foreground">
            Non viene creato alcun movimento: i due documenti si annullano fra loro.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={conferma} disabled={!valido || compensa.isPending}>
            {compensa.isPending ? "Compensazione…" : "Compensa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
