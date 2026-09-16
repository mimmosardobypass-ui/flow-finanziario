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

/** Converte un importo scritto all'italiana (o con il punto decimale) in numero. */
export const parseImporto = (v: string): number | null => {
  const grezzo = (v ?? "").trim();
  if (!grezzo) return null;

  let pulito: string;
  if (grezzo.includes(",")) {
    // La virgola è il decimale, i punti sono separatori delle migliaia.
    pulito = grezzo.replace(/\./g, "").replace(",", ".");
  } else if (/^[^.]*\.\d{1,2}$/.test(grezzo)) {
    // Un solo punto seguito da 1 o 2 cifre finali: è il decimale.
    pulito = grezzo;
  } else {
    pulito = grezzo.replace(/\./g, "");
  }

  const num = Number(pulito.replace(/\s/g, ""));
  return Number.isFinite(num) ? num : null;
};

export const oggiISO = () => format(new Date(), "yyyy-MM-dd");

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
