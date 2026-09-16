import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import type { ContoRiepilogo } from "@/hooks/useConti";
import type { EntrataPrevista, ScadenzaAgenda } from "@/hooks/useScadenzeAgenda";

export const DATA_OGGI = () => format(new Date(), "yyyy-MM-dd");

export const isStimata = (r: ScadenzaAgenda) => r.stimata || r.piano_stimato;
export const filtraConto = (rate: ScadenzaAgenda[], contoId: string) => contoId === "tutti" ? rate : rate.filter((r) => r.conto_id === contoId);
export const sommaRate = (rate: ScadenzaAgenda[], previsto = false) => rate.reduce((s, r) => s + (previsto ? r.importo_previsto : r.importo), 0);

export function calcolaKpi(rate: ScadenzaAgenda[], oggi = DATA_OGGI()) {
  const sette = format(addDays(parseISO(oggi), 7), "yyyy-MM-dd");
  const trenta = format(addDays(parseISO(oggi), 30), "yyyy-MM-dd");
  const aperte = rate.filter((r) => r.stato_agenda !== "pagata");
  const scadute = aperte.filter((r) => r.stato_agenda === "scaduta");
  const prossime7 = aperte.filter((r) => r.stato_agenda === "da_pagare" && r.data_addebito >= oggi && r.data_addebito <= sette);
  const prossime30 = aperte.filter((r) => r.stato_agenda === "da_pagare" && r.data_addebito >= oggi && r.data_addebito <= trenta);
  return { scadute, prossime7, prossime30, trenta };
}

export interface GruppiAgenda { scadute: ScadenzaAgenda[]; settimana: ScadenzaAgenda[]; trenta: ScadenzaAgenda[]; mesi: { chiave: string; label: string; rate: ScadenzaAgenda[] }[] }
export function raggruppaAgenda(rate: ScadenzaAgenda[], oggi = DATA_OGGI()): GruppiAgenda {
  const sette = format(addDays(parseISO(oggi), 7), "yyyy-MM-dd");
  const trenta = format(addDays(parseISO(oggi), 30), "yyyy-MM-dd");
  const aperte = rate.filter((r) => r.stato_agenda !== "pagata");
  const future = aperte.filter((r) => r.data_addebito > trenta);
  const mappa = new Map<string, ScadenzaAgenda[]>();
  future.forEach((r) => { const k = r.data_addebito.slice(0, 7); mappa.set(k, [...(mappa.get(k) ?? []), r]); });
  return {
    scadute: aperte.filter((r) => r.stato_agenda === "scaduta"),
    settimana: aperte.filter((r) => r.stato_agenda === "da_pagare" && r.data_addebito >= oggi && r.data_addebito <= sette),
    trenta: aperte.filter((r) => r.stato_agenda === "da_pagare" && r.data_addebito > sette && r.data_addebito <= trenta),
    mesi: [...mappa.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6).map(([chiave, elenco]) => ({
      chiave, label: format(parseISO(`${chiave}-01`), "MMMM yyyy", { locale: it }), rate: elenco,
    })),
  };
}

export interface MeseUscite { chiave: string; breve: string; esteso: string; totale: number; perConto: Record<string, number> }
export function calcolaMesi(rate: ScadenzaAgenda[], oggi = DATA_OGGI()): MeseUscite[] {
  const base = startOfMonth(parseISO(oggi));
  return Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(base, i); const chiave = format(d, "yyyy-MM"); const perConto: Record<string, number> = {};
    rate.filter((r) => r.stato_agenda !== "pagata" && r.data_addebito.slice(0, 7) === chiave).forEach((r) => {
      if (r.conto_id) perConto[r.conto_id] = (perConto[r.conto_id] ?? 0) + r.importo_previsto;
    });
    return { chiave, breve: format(d, "MMM", { locale: it }), esteso: format(d, "MMMM yyyy", { locale: it }), totale: Object.values(perConto).reduce((a, b) => a + b, 0), perConto };
  });
}

export type StatoCopertura = "contanti" | "da_confermare" | "non_coperto" | "stretto" | "coperto";
export interface MovimentoCopertura { data: string; etichetta: string; importo: number; stimata: boolean; uscita: boolean; saldo?: number }
export interface CoperturaConto { conto: ContoRiepilogo; righe: MovimentoCopertura[]; stato: StatoCopertura; saldoMinimo: number; dataMinimo: string | null; saldoFinale: number; primaDataNegativa: string | null; uscite: number }

export function calcolaCoperture(conti: ContoRiepilogo[], rate: ScadenzaAgenda[], entrate: EntrataPrevista[], oggi = DATA_OGGI()): CoperturaConto[] {
  const limite = format(addDays(parseISO(oggi), 30), "yyyy-MM-dd");
  return conti.map((conto) => {
    const rateConto = rate.filter((r) => r.conto_id === conto.id && r.stato_agenda === "da_pagare" && r.data_addebito >= oggi && r.data_addebito <= limite);
    if (!rateConto.length) return null;
    const righe: MovimentoCopertura[] = [
      ...rateConto.map((r) => ({ data: r.data_addebito, etichetta: `${r.ente} ${r.nome_visualizzato}${r.spese_previste > 0 ? " + commissione" : ""}`, importo: -r.importo_previsto, stimata: isStimata(r), uscita: true })),
      ...entrate.filter((e) => e.conto_id === conto.id && e.prossima_data >= oggi && e.prossima_data <= limite).map((e) => ({ data: e.prossima_data, etichetta: `${e.categoria} (attesa)`, importo: e.importo_previsto, stimata: true, uscita: false })),
    ].sort((a, b) => a.data.localeCompare(b.data) || Number(b.uscita) - Number(a.uscita));
    const uscite = rateConto.reduce((s, r) => s + r.importo_previsto, 0);
    let saldo = conto.saldo_attuale; let minimo = saldo; let dataMinimo: string | null = null; let primaDataNegativa: string | null = null;
    righe.forEach((r) => { saldo += r.importo; r.saldo = saldo; if (saldo < minimo) { minimo = saldo; dataMinimo = r.data; } if (saldo < 0 && !primaDataNegativa) primaDataNegativa = r.data; });
    let stato: StatoCopertura = "coperto";
    if (conto.tipo === "cassa") stato = "contanti";
    else if (!conto.saldo_confermato) stato = "da_confermare";
    else if (minimo < 0) stato = "non_coperto";
    else if (minimo < 50 || minimo < uscite * 0.1) stato = "stretto";
    return { conto, righe, stato, saldoMinimo: minimo, dataMinimo, saldoFinale: saldo, primaDataNegativa, uscite };
  }).filter((v): v is CoperturaConto => Boolean(v)).sort((a, b) => {
    const ordine: StatoCopertura[] = ["non_coperto", "stretto", "da_confermare", "contanti", "coperto"];
    return ordine.indexOf(a.stato) - ordine.indexOf(b.stato) || a.conto.nome_conto.localeCompare(b.conto.nome_conto, "it");
  });
}

export const fineMese = (chiave: string) => format(endOfMonth(parseISO(`${chiave}-01`)), "yyyy-MM-dd");