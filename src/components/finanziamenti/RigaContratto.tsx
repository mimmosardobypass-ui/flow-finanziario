import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Finanziamento } from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData, fmtMeseAnno, iniziali, titoloContratto } from "./utils";

export function Pill({ testo, classe }: { testo: string; classe: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-normal", classe)}>
      {testo}
    </Badge>
  );
}

export function pillsContratto(c: Finanziamento) {
  const pills: { testo: string; classe: string }[] = [];
  if (c.rate_totali === 0)
    pills.push({ testo: "Piano da caricare", classe: "border-border bg-muted text-muted-foreground" });
  if (c.rate_scadute > 0)
    pills.push({
      testo: `${c.rate_scadute} rate scadute senza pagamento`,
      classe: "border-destructive/40 bg-destructive/10 text-destructive",
    });
  if (c.rate_senza_movimento > 0)
    pills.push({
      testo: `${c.rate_senza_movimento} rate senza movimento`,
      classe: "border-warning/40 bg-warning/10 text-warning",
    });
  if (c.differenza_residuo_ente !== null && Math.abs(c.differenza_residuo_ente) >= 0.01)
    pills.push({
      testo: "Residuo diverso dall'ente",
      classe: "border-warning/40 bg-warning/10 text-warning",
    });
  if (!pills.length)
    pills.push({ testo: "In regola", classe: "border-success/40 bg-success/10 text-success" });
  return pills;
}

export function RigaContratto({ c, onApri }: { c: Finanziamento; onApri: (c: Finanziamento) => void }) {
  const perc = c.rate_totali ? (c.rate_pagate / c.rate_totali) * 100 : 0;
  const percScadute = c.rate_totali ? (c.rate_scadute / c.rate_totali) * 100 : 0;
  const cadenza =
    c.gruppo === "rottamazione"
      ? `${fmtEur(c.importo_rata)} ogni 2 mesi`
      : `${fmtEur(c.importo_rata)}/mese`;
  return (
    <button
      type="button"
      onClick={() => onApri(c)}
      className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/50 md:flex-row md:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 md:max-w-[28%]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
          {iniziali(c.societa_finanziaria)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {titoloContratto(c.societa_finanziaria, c.nome)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[c.beneficiario, [c.banca, c.nome_conto].filter(Boolean).join(" "), c.importo_rata ? cadenza : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 md:max-w-[24%]">
        {c.rate_totali === 0 ? (
          <>
            <div className="h-2 w-full rounded-full border border-dashed border-border" />
            <p className="mt-1 text-xs text-muted-foreground">Piano da caricare</p>
          </>
        ) : (
          <>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="bg-primary" style={{ width: `${perc}%` }} />
              <div className="bg-destructive/40" style={{ width: `${percScadute}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.rate_pagate}/{c.rate_totali} rate · fine {fmtMeseAnno(c.data_fine)}
            </p>
          </>
        )}
      </div>

      <div className="md:w-[14%]">
        <p className="text-xs text-muted-foreground md:hidden">Residuo</p>
        <p className="text-sm font-semibold text-foreground">{fmtEur(c.residuo_da_pagare)}</p>
      </div>

      <div className="md:w-[16%]">
        <p className="text-xs text-muted-foreground">Prossima rata</p>
        {c.prossima_scadenza ? (
          <p className="text-sm text-foreground">
            {fmtEur(c.prossima_importo)} ·{" "}
            <span className={cn(c.prossima_stimata && "italic")}>
              {fmtData(c.prossima_scadenza)}
            </span>
            {c.prossima_stimata && (
              <span className="ml-1 text-xs text-muted-foreground">stimata</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1 md:w-[18%] md:justify-end">
        {pillsContratto(c).map((p) => (
          <Pill key={p.testo} testo={p.testo} classe={p.classe} />
        ))}
      </div>
    </button>
  );
}

