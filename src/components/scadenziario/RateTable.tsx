import { useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScadenzaRata } from "@/hooks/useScadenziario";
import { useUpdateRata } from "@/hooks/useScadenziario";
import { toast } from "@/hooks/use-toast";

interface RateTableProps {
  rate: ScadenzaRata[];
}

function getStatoBadge(rata: ScadenzaRata) {
  if (rata.stato === "pagata") {
    return <Badge className="bg-green-600 hover:bg-green-700">Pagata</Badge>;
  }
  if (
    rata.data_scadenza &&
    isBefore(new Date(rata.data_scadenza), startOfDay(new Date()))
  ) {
    return <Badge variant="destructive">Scaduta</Badge>;
  }
  return <Badge variant="secondary">Non pagata</Badge>;
}

export function RateTable({ rate }: RateTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editImporto, setEditImporto] = useState("");
  const [editData, setEditData] = useState("");
  const updateRata = useUpdateRata();

  const startEdit = (r: ScadenzaRata) => {
    setEditingId(r.id);
    setEditImporto(r.importo != null ? String(r.importo) : "");
    setEditData(r.data_scadenza || "");
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    try {
      await updateRata.mutateAsync({
        id,
        importo: editImporto ? parseFloat(editImporto) : null,
        data_scadenza: editData || null,
      });
      setEditingId(null);
      toast({ title: "Rata aggiornata" });
    } catch {
      toast({ title: "Errore", description: "Impossibile aggiornare la rata", variant: "destructive" });
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Importo</TableHead>
            <TableHead>Scadenza</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rate
            .sort((a, b) => a.numero_rata - b.numero_rata)
            .map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.numero_rata}</TableCell>
                <TableCell>
                  {editingId === r.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editImporto}
                      onChange={(e) => setEditImporto(e.target.value)}
                      className="w-28 h-8"
                    />
                  ) : (
                    r.importo != null ? `€ ${r.importo.toFixed(2)}` : "—"
                  )}
                </TableCell>
                <TableCell>
                  {editingId === r.id ? (
                    <Input
                      type="date"
                      value={editData}
                      onChange={(e) => setEditData(e.target.value)}
                      className="w-36 h-8"
                    />
                  ) : (
                    r.data_scadenza
                      ? format(new Date(r.data_scadenza), "dd/MM/yyyy")
                      : "—"
                  )}
                </TableCell>
                <TableCell>{getStatoBadge(r)}</TableCell>
                <TableCell>
                  {r.stato !== "pagata" && (
                    editingId === r.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(r.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
