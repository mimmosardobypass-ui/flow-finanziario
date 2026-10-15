import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { parseImporto } from "@/components/finanziamenti/utils";
import { fmtNum } from "@/components/finanziamenti/utils";

export function Segmentato<T extends string>({ valore, opzioni, onChange, className }: {
  valore: T; opzioni: { v: T; l: string }[]; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div role="group" className={cn("inline-flex flex-wrap rounded-md border border-border overflow-hidden", className)}>
      {opzioni.map((o, i) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={valore === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "px-3 py-1.5 text-sm transition-colors",
            i > 0 && "border-l border-border",
            valore === o.v ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Riquadro({ titolo, valore, sotto, className }: { titolo: string; valore: React.ReactNode; sotto?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="text-xs text-muted-foreground">{titolo}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{valore}</div>
      {sotto && <div className="mt-0.5 text-xs text-muted-foreground">{sotto}</div>}
    </div>
  );
}

/** Campo prezzo: accetta "199,90" o "199.90"; salva all'uscita dal campo. */
export function CampoPrezzo({ valore, onSalva, className, ariaLabel = "Prezzo previsto" }: {
  valore: number | null; onSalva: (v: number | null) => void; className?: string; ariaLabel?: string;
}) {
  const fmt = (v: number | null) => (v === null ? "" : fmtNum(v));
  const [testo, setTesto] = useState(fmt(valore));
  useEffect(() => setTesto(fmt(valore)), [valore]);
  const commit = () => {
    const v = parseImporto(testo);
    const nuovo = v === null || v < 0 ? null : Math.round(v * 100) / 100;
    if (nuovo !== valore) onSalva(nuovo);
    setTesto(fmt(nuovo));
  };
  return (
    <Input
      aria-label={ariaLabel}
      inputMode="decimal"
      value={testo}
      placeholder="—"
      onChange={(e) => setTesto(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-7 w-24 text-right tabular-nums text-[13px] px-2", className)}
    />
  );
}
