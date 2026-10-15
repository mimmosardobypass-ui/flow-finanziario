/** Formule della sezione Smartphone: sempre IVA esclusa. */

export const utile = (vendita: number, costo: number) => vendita - costo;
export const ricarico = (u: number, costo: number) => (costo > 0 ? (u / costo) * 100 : null);
export const margine = (u: number, vendita: number) => (vendita > 0 ? (u / vendita) * 100 : null);

export interface Totali {
  pezzi: number;
  costo: number;
  incasso: number;
  utile: number;
  ricarico: number | null;
  margine: number | null;
}

/** Somma righe {costo, incasso}; ricarico e margine calcolati sui totali, mai come media. */
export function totali(righe: { costo: number; incasso: number; pezzi?: number }[]): Totali {
  let costo = 0, incasso = 0, pezzi = 0;
  for (const r of righe) { costo += r.costo; incasso += r.incasso; pezzi += r.pezzi ?? 1; }
  const u = incasso - costo;
  return { pezzi, costo, incasso, utile: u, ricarico: ricarico(u, costo), margine: margine(u, incasso) };
}

const COLORI = ["BLACK","WHITE","BLUE","GREEN","RED","GOLD","SILVER","GRAY","GREY","PURPLE","PINK","YELLOW","ORANGE","NERO","BIANCO","BLU","VERDE","ROSSO","ORO","ARGENTO","GRIGIO","VIOLA","ROSA","GIALLO","AZZURRO","BEIGE","TITANIUM","TITANIO","MIDNIGHT","STARLIGHT","GRAPHITE","LAVENDER","MINT","CREAM","NAVY","CORAL","BEACH","OCEAN","SKY","SPACE","LIGHT","DARK","DEEP","ICY","AWESOME","LIME","OLIVE","ONYX","PEARL","SAND","STORM","CHAMPAGNE","BRONZE","CYAN","LILAC"];

/** Modello senza colore: toglie le parole di colore in coda (e quanto segue la memoria). */
export function modelloDaDescrizione(descrizione: string): string {
  const parole = descrizione.trim().split(/\s+/);
  let fine = parole.length;
  while (fine > 1 && COLORI.includes(parole[fine - 1].toUpperCase())) fine--;
  const ris = parole.slice(0, fine).join(" ");
  return ris || descrizione;
}

/** Data in cui l'incassato cumulato supera il costo del carico. */
export function dataRientro(vendite: { data: string; incasso: number }[], costoCarico: number): string | null {
  const ord = [...vendite].sort((a, b) => a.data.localeCompare(b.data));
  let cum = 0;
  for (const v of ord) { cum += v.incasso; if (cum >= costoCarico - 0.004) return v.data; }
  return null;
}

export const giorniTra = (daISO: string, aISO: string) =>
  Math.round((Date.parse(aISO + "T00:00:00Z") - Date.parse(daISO.slice(0, 10) + "T00:00:00Z")) / 86400000);
