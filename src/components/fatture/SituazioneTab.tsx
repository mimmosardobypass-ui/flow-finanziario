import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDocumentiSaldi,
  useEsposizioneControparti,
  usePagamentiFatture,
} from "@/hooks/useFattureFornitori";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);

const SEGMENTI = [
  { key: "a_scadere", label: "A scadere", color: "#12b76a" },
  { key: "scaduto_1_30", label: "Scaduto 1–30 gg", color: "#fdb022" },
  { key: "scaduto_31_90", label: "Scaduto 31–90 gg", color: "#f97316" },
  { key: "scaduto_oltre_90", label: "Scaduto oltre 90 gg", color: "#f04438" },
] as const;

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold" style={{ color }}>{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

export function SituazioneTab() {
  const { data: docs = [] } = useDocumentiSaldi("passiva");
  const { data: esposizione = [] } = useEsposizioneControparti();
  const { data: proposte = [] } = usePagamentiFatture();

  const aperti = docs.filter((d) => d.residuo > 0.005 && d.tipo !== "Nota Credito");
  const daPagare = aperti.reduce((s, d) => s + d.residuo, 0);
  const oltre90 = aperti
    .filter((d) => (d.giorni_scaduta ?? 0) > 90)
    .reduce((s, d) => s + d.residuo, 0);
  const pctOltre90 = daPagare > 0 ? (oltre90 / daPagare) * 100 : 0;
  const noteCredito = docs
    .filter((d) => d.tipo === "Nota Credito")
    .reduce((s, d) => s + Math.abs(d.residuo), 0);

  const maxAperto = Math.max(1, ...esposizione.map((e) => e.aperto));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Da pagare" value={fmtEur(daPagare)} color="#f04438"
          sub={`${aperti.length} document${aperti.length === 1 ? "o" : "i"} apert${aperti.length === 1 ? "o" : "i"}`} />
        <StatBox label="Scaduto oltre 90 giorni" value={fmtEur(oltre90)} color="#f04438"
          sub={`${pctOltre90.toFixed(1)}% del totale da pagare`} />
        <StatBox label="Pagamenti da abbinare" value={String(proposte.length)} color="#2563eb"
          sub="proposte in attesa di conferma" />
        <StatBox label="Note di credito aperte" value={fmtEur(noteCredito)} color="#7c3aed"
          sub="da compensare con i fornitori" />
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Esposizione per fornitore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {esposizione.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">Nessuna esposizione aperta</div>
          )}
          {esposizione.map((e) => (
            <div key={e.controparte} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{e.controparte}</span>
                <span className="whitespace-nowrap font-semibold">{fmtEur(e.aperto)}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="flex h-full" style={{ width: `${(e.aperto / maxAperto) * 100}%` }}>
                  {SEGMENTI.map((s) => {
                    const v = e[s.key];
                    if (!v) return null;
                    return (
                      <div
                        key={s.key}
                        style={{ backgroundColor: s.color, width: `${(v / (e.aperto || 1)) * 100}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground">
            {SEGMENTI.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
