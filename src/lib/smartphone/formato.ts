import { fmtNum } from "@/components/finanziamenti/utils";

/** 1.234,56 € (spazio non separabile) */
export const eur = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}${fmtNum(Math.abs(v))}\u00A0€`;

export const pct = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const punti = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} punti`;

export const segnoEur = (v: number) => (v > 0 ? `+${eur(v)}` : eur(v));
