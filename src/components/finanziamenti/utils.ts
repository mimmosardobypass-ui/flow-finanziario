import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

export const fmtEur = (v: number | null | undefined) =>
  `€ ${Number(v ?? 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtData = (v: string | null | undefined) =>
  v ? format(parseISO(v), "dd/MM/yyyy") : "—";

export const fmtMeseAnno = (v: string | null | undefined) =>
  v ? format(parseISO(v), "MMM yyyy", { locale: it }) : "—";

export const iniziali = (testo: string | null | undefined) =>
  (testo ?? "?")
    .split(/[\s.·-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const titoloContratto = (ente: string | null, nome: string | null) =>
  nome ? `${ente ?? "—"} · ${nome}` : ente ?? "—";

export const tronca = (testo: string | null | undefined, max = 60) => {
  const t = (testo ?? "").trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

/** Converte un importo scritto con la virgola in numero. */
export const parseImporto = (v: string): number | null => {
  const pulito = v.replace(/\./g, "").replace(",", ".").trim();
  if (!pulito) return null;
  const num = Number(pulito);
  return Number.isFinite(num) ? num : null;
};

export const oggiISO = () => new Date().toISOString().slice(0, 10);

/** Aggiunge mesi a una data ISO mantenendo il giorno, con correzione fine mese. */
export function aggiungiMesi(dataISO: string, mesi: number): string {
  const [y, m, d] = dataISO.split("-").map(Number);
  const totale = m - 1 + mesi;
  const anno = y + Math.floor(totale / 12);
  const mese = ((totale % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
  const giorno = Math.min(d, ultimo);
  return `${anno}-${String(mese + 1).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}
