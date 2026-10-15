import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ArrowUpDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addMonths, endOfMonth, endOfYear, format, parseISO, startOfMonth, startOfYear, differenceInCalendarDays, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { righePezzi, type RigaPezzo, type SpDati } from "@/hooks/useSmartphone";
import { modelloDaDescrizione, totali } from "@/lib/smartphone/calcoli";
import { eur, pct, punti, segnoEur } from "@/lib/smartphone/formato";
import { esportaExcel, r1, r2 } from "@/lib/smartphone/esporta";
import { fmtData, oggiISO } from "@/components/finanziamenti/utils";
import { Riquadro, Segmentato } from "./ui";

type Modo = "mese" | "scorso" | "tre" | "anno" | "custom";
type Cat = "tutte" | "smartphone" | "accessori" | "cellulari";
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nomeMese = (d: Date) => cap(format(d, "MMMM yyyy", { locale: it }));

function periodoDa(modo: Modo, rif: Date): { dal: string; al: string } {
  if (modo === "anno") return { dal: iso(startOfYear(rif)), al: iso(endOfYear(rif)) };
  if (modo === "tre") return { dal: iso(startOfMonth(addMonths(rif, -2))), al: iso(endOfMonth(rif)) };
  return { dal: iso(startOfMonth(rif)), al: iso(endOfMonth(rif)) };
}

function etichettaPeriodo(dal: string, al: string) {
  const d = parseISO(dal), a = parseISO(al);
  if (dal === iso(startOfMonth(d)) && al === iso(endOfMonth(d))) return nomeMese(d);
  if (dal === iso(startOfYear(d)) && al === iso(endOfYear(d))) return `Anno ${format(d, "yyyy")}`;
  if (dal === iso(startOfMonth(d)) && al === iso(endOfMonth(a))) return `${nomeMese(d)} – ${nomeMese(a)}`;
  return `${fmtData(dal)} – ${fmtData(al)}`;
}

function precedente(dal: string, al: string) {
  const d = parseISO(dal), a = parseISO(al);
  if (dal === iso(startOfMonth(d)) && al === iso(endOfMonth(a))) {
    const mesi = (a.getFullYear() - d.getFullYear()) * 12 + a.getMonth() - d.getMonth() + 1;
    return { dal: iso(startOfMonth(addMonths(d, -mesi))), al: iso(endOfMonth(addMonths(a, -mesi))) };
  }
  const gg = differenceInCalendarDays(a, d) + 1;
  return { dal: iso(addDays(d, -gg)), al: iso(addDays(a, -gg)) };
}

const filtraCat = (c: Cat) => (r: RigaPezzo) =>
  c === "tutte" || (c === "smartphone" ? r.articolo.categoria === "Smartphone" : c === "accessori" ? r.articolo.categoria === "Accessorio" : r.articolo.categoria === "Cellulare");

interface RigaStat { key: string; label: string; figli: number; pezzi: number; incasso: number; costo: number; utile: number; ricarico: number | null; margine: number | null; quota: number | null; magPezzi: number | null; magValore: number | null }
type Col = "label" | "pezzi" | "incasso" | "utile" | "ricarico" | "margine" | "quota" | "magValore";

function kpi(righe: RigaPezzo[]) {
  const t = totali(righe.map((r) => ({ costo: r.costo, incasso: r.venduto! })));
  const conPrev = righe.filter((r) => r.previsto !== null);
  return { ...t, scost: conPrev.reduce((s, r) => s + r.venduto! - r.previsto!, 0) };
}

export function TabStatistiche({ dati }: { dati: SpDati }) {
  const oggi = oggiISO();
  const [modo, setModo] = useState<Modo>("mese");
  const [per, setPer] = useState(periodoDa("mese", parseISO(oggi)));
  const [cat, setCat] = useState<Cat>("tutte");
  const [percorso, setPercorso] = useState<{ marca?: string; modello?: string }>({});
  const [ord, setOrd] = useState<{ col: Col; desc: boolean }>({ col: "utile", desc: true });
  const [filtri, setFiltri] = useState<Partial<Record<Col, string>>>({});

  const tutte = useMemo(() => righePezzi(dati).filter(filtraCat(cat)), [dati, cat]);
  const vendute = tutte.filter((r) => r.vendita);
  const nelPeriodo = (p: { dal: string; al: string }) => vendute.filter((r) => r.vendita!.data_vendita >= p.dal && r.vendita!.data_vendita <= p.al);
  const cur = nelPeriodo(per);
  const prevP = precedente(per.dal, per.al);
  const k = kpi(cur), kp = kpi(nelPeriodo(prevP));
  const etPrev = etichettaPeriodo(prevP.dal, prevP.al);
  const varPct = (a: number, b: number) => (b !== 0 ? `${a - b >= 0 ? "+" : "−"}${pct(Math.abs(((a - b) / Math.abs(b)) * 100))} vs ${etPrev}` : `— vs ${etPrev}`);
  const varPt = (a: number | null, b: number | null) => (a !== null && b !== null ? `${punti(a - b)} vs ${etPrev}` : `— vs ${etPrev}`);

  const scegli = (m: Modo) => {
    setModo(m);
    if (m === "custom") return;
    const rif = m === "scorso" ? addMonths(parseISO(oggi), -1) : parseISO(oggi);
    setPer(periodoDa(m, rif));
  };
  const sposta = (dir: 1 | -1) => {
    const d = parseISO(per.dal), a = parseISO(per.al);
    if (per.dal === iso(startOfMonth(d)) && per.al === iso(endOfMonth(a))) {
      const mesi = ((a.getFullYear() - d.getFullYear()) * 12 + a.getMonth() - d.getMonth() + 1) * dir;
      setPer({ dal: iso(startOfMonth(addMonths(d, mesi))), al: iso(endOfMonth(addMonths(a, mesi))) });
    } else {
      const gg = (differenceInCalendarDays(a, d) + 1) * dir;
      setPer({ dal: iso(addDays(d, gg)), al: iso(addDays(a, gg)) });
    }
  };

  // Grafico: utile per mese dell'anno di fine periodo
  const anno = per.al.slice(0, 4);
  const barre = Array.from({ length: 12 }, (_, i) => {
    const m = `${anno}-${String(i + 1).padStart(2, "0")}`;
    const rs = vendute.filter((r) => r.vendita!.data_vendita.startsWith(m));
    const t = totali(rs.map((r) => ({ costo: r.costo, incasso: r.venduto! })));
    const ini = `${m}-01`, fin = iso(endOfMonth(parseISO(ini)));
    return { m, nome: format(parseISO(ini), "MMM", { locale: it }), utile: Math.round(t.utile * 100) / 100, pezzi: rs.length, margine: t.margine, sel: fin >= per.dal && ini <= per.al };
  });

  // Tabella drill-down
  const livello = percorso.modello ? "vendite" : percorso.marca ? "modelli" : "marche";
  const modelloDi = (r: RigaPezzo) => modelloDaDescrizione(r.articolo.descrizione || r.articolo.modello);
  const inScope = (r: RigaPezzo) => (!percorso.marca || r.articolo.marca === percorso.marca) && (!percorso.modello || modelloDi(r) === percorso.modello);
  const curScope = cur.filter(inScope);
  const magScope = tutte.filter((r) => !r.vendita && inScope(r));
  const utileTotScope = curScope.reduce((s, r) => s + r.venduto! - r.costo, 0);

  const righeStat: RigaStat[] = useMemo(() => {
    if (livello === "vendite") {
      return curScope.map((r) => {
        const t = totali([{ costo: r.costo, incasso: r.venduto! }]);
        return { key: r.vendita!.id, label: `${fmtData(r.vendita!.data_vendita)} · ${r.articolo.descrizione}`, figli: 0, pezzi: 1, incasso: t.incasso, costo: t.costo, utile: t.utile, ricarico: t.ricarico, margine: t.margine, quota: utileTotScope ? (t.utile / utileTotScope) * 100 : null, magPezzi: null, magValore: null };
      });
    }
    const chiave = livello === "marche" ? (r: RigaPezzo) => r.articolo.marca || "—" : modelloDi;
    const gruppi = new Map<string, { v: RigaPezzo[]; mag: RigaPezzo[]; figli: Set<string> }>();
    const g = (k: string) => { let x = gruppi.get(k); if (!x) { x = { v: [], mag: [], figli: new Set() }; gruppi.set(k, x); } return x; };
    for (const r of curScope) { const x = g(chiave(r)); x.v.push(r); x.figli.add(modelloDi(r)); }
    for (const r of magScope) { const x = g(chiave(r)); x.mag.push(r); x.figli.add(modelloDi(r)); }
    return [...gruppi.entries()].map(([key, x]) => {
      const t = totali(x.v.map((r) => ({ costo: r.costo, incasso: r.venduto! })));
      return { key, label: key, figli: x.figli.size, pezzi: x.v.length, incasso: t.incasso, costo: t.costo, utile: t.utile, ricarico: t.ricarico, margine: t.margine, quota: utileTotScope ? (t.utile / utileTotScope) * 100 : null, magPezzi: x.mag.length, magValore: x.mag.reduce((s, r) => s + r.costo, 0) };
    });
  }, [livello, curScope, magScope, utileTotScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const passa = (r: RigaStat, col: Col, f: string) => {
    const t = f.trim(); if (!t) return true;
    const v = r[col];
    if (col === "label") return String(v).toLowerCase().includes(t.toLowerCase());
    const m = t.replace(",", ".").match(/^(>=|<=|>|<|=)?\s*(-?\d+(\.\d+)?)$/);
    if (!m || v === null) return String(v ?? "").includes(t);
    const num = Number(m[2]), x = Number(v);
    return m[1] === ">" ? x > num : m[1] === "<" ? x < num : m[1] === ">=" ? x >= num : m[1] === "<=" ? x <= num : Math.abs(x - num) < 0.005;
  };
  const filtroAttivo = Object.values(filtri).some((f) => f && f.trim());
  const visibili = righeStat.filter((r) => (Object.entries(filtri) as [Col, string][]).every(([c, f]) => passa(r, c, f)))
    .sort((a, b) => {
      const va = a[ord.col], vb = b[ord.col];
      const c = typeof va === "string" ? va.localeCompare(String(vb)) : Number(va ?? -Infinity) - Number(vb ?? -Infinity);
      return ord.desc ? -c : c;
    });
  const somma = (rs: RigaStat[]) => {
    const t = totali(rs.map((r) => ({ costo: r.costo, incasso: r.incasso, pezzi: r.pezzi })));
    return { ...t, quota: utileTotScope ? (t.utile / utileTotScope) * 100 : null, magPezzi: rs.reduce((s, r) => s + (r.magPezzi ?? 0), 0), magValore: rs.reduce((s, r) => s + (r.magValore ?? 0), 0) };
  };
  const totF = somma(visibili), totT = somma(righeStat);

  const apri = (r: RigaStat) => {
    if (livello === "marche") setPercorso({ marca: r.key });
    else if (livello === "modelli") setPercorso({ ...percorso, modello: r.key });
    setFiltri({});
  };
  const etichettaPer = etichettaPeriodo(per.dal, per.al);

  const esporta = () => esportaExcel(`statistiche_smartphone_${per.dal}_${per.al}`, [
    { nome: "Riepilogo", righe: [
      { Voce: "Periodo", Valore: etichettaPer }, { Voce: "Pezzi venduti", Valore: k.pezzi }, { Voce: "Incassato", Valore: r2(k.incasso) },
      { Voce: "Costo del venduto", Valore: r2(k.costo) }, { Voce: "Utile", Valore: r2(k.utile) }, { Voce: "Ricarico %", Valore: r1(k.ricarico) },
      { Voce: "Margine %", Valore: r1(k.margine) }, { Voce: "Scostamento dal previsto", Valore: r2(k.scost) },
    ] },
    { nome: livello === "marche" ? "Marche" : livello === "modelli" ? "Modelli" : "Vendite", righe: visibili.map((r) => ({
      Voce: r.label, Pezzi: r.pezzi, Incassato: r2(r.incasso), Utile: r2(r.utile), "Ricarico %": r1(r.ricarico), "Margine %": r1(r.margine),
      "Quota utile %": r1(r.quota), "In magazzino (pezzi)": r.magPezzi, "In magazzino (costo)": r2(r.magValore),
    })) },
  ]);

  const Th = ({ col, children, num = true }: { col: Col; children: React.ReactNode; num?: boolean }) => (
    <th className={num ? "num" : undefined}>
      <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => setOrd({ col, desc: ord.col === col ? !ord.desc : col !== "label" })}>
        {children}<ArrowUpDown className="h-3 w-3 opacity-70" />
      </button>
    </th>
  );
  const cols: Col[] = ["label", "pezzi", "incasso", "utile", "ricarico", "margine", "quota", "magValore"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Periodo precedente" onClick={() => sposta(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-[150px] text-center font-medium">{etichettaPer}</span>
        <Button variant="outline" size="icon" aria-label="Periodo successivo" onClick={() => sposta(1)}><ChevronRight className="h-4 w-4" /></Button>
        <Segmentato<Modo> valore={modo} onChange={scegli} opzioni={[
          { v: "mese", l: "Questo mese" }, { v: "scorso", l: "Mese scorso" }, { v: "tre", l: "Ultimi 3 mesi" }, { v: "anno", l: "Anno" }, { v: "custom", l: "Personalizzato" },
        ]} />
        {modo === "custom" && (
          <div className="flex items-center gap-1 text-sm">
            dal <Input type="date" aria-label="Dal" className="h-8 w-40" value={per.dal} onChange={(e) => e.target.value && setPer({ ...per, dal: e.target.value })} />
            al <Input type="date" aria-label="Al" className="h-8 w-40" value={per.al} onChange={(e) => e.target.value && setPer({ ...per, al: e.target.value })} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmentato<Cat> valore={cat} onChange={setCat} opzioni={[{ v: "tutte", l: "Tutte" }, { v: "smartphone", l: "Smartphone" }, { v: "accessori", l: "Accessori" }, { v: "cellulari", l: "Cellulari" }]} />
        <Button variant="outline" className="ml-auto" onClick={esporta}><Download className="mr-2 h-4 w-4" />Esporta Excel</Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        <Riquadro titolo="Pezzi venduti" valore={k.pezzi} sotto={varPct(k.pezzi, kp.pezzi)} />
        <Riquadro titolo="Incassato" valore={eur(k.incasso)} sotto={varPct(k.incasso, kp.incasso)} />
        <Riquadro titolo="Costo del venduto" valore={eur(k.costo)} sotto={varPct(k.costo, kp.costo)} />
        <Riquadro titolo="Utile" valore={eur(k.utile)} sotto={varPct(k.utile, kp.utile)} />
        <Riquadro titolo="Ricarico" valore={pct(k.ricarico)} sotto={varPt(k.ricarico, kp.ricarico)} />
        <Riquadro titolo="Margine" valore={pct(k.margine)} sotto={varPt(k.margine, kp.margine)} />
        <Riquadro titolo="Scostamento dal previsto" valore={segnoEur(k.scost)} sotto={varPct(k.scost, kp.scost)} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Utile per mese · {anno}</CardTitle><p className="text-xs text-muted-foreground">Clicca una barra per vedere quel mese</p></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barre} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof barre)[number];
                  return (
                    <div className="rounded-md border border-border bg-popover p-2 text-xs shadow-md">
                      <div className="font-medium">{nomeMese(parseISO(`${p.m}-01`))}</div>
                      <div>Utile <span className="tabular-nums">{eur(p.utile)}</span></div>
                      <div>Pezzi {p.pezzi}</div>
                      <div>Margine {pct(p.margine)}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="utile" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: { m?: string; payload?: { m: string } }) => {
                const m = d?.payload?.m ?? d?.m; if (!m) return;
                setModo("custom"); setPer({ dal: `${m}-01`, al: iso(endOfMonth(parseISO(`${m}-01`))) });
              }}>
                {barre.map((b) => <Cell key={b.m} fill={b.sel ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <nav aria-label="Percorso" className="flex flex-wrap items-center gap-1 text-sm">
          <span className="font-medium">{etichettaPer}</span>›
          <button type="button" className="text-primary hover:underline" onClick={() => { setPercorso({}); setFiltri({}); }}>Tutte le marche</button>
          {percorso.marca && <>›<button type="button" className="text-primary hover:underline" onClick={() => { setPercorso({ marca: percorso.marca }); setFiltri({}); }}>{percorso.marca}</button></>}
          {percorso.modello && <>›<span>{percorso.modello}</span></>}
        </nav>
        <div className="tg-wrap">
          <table className="tg min-w-[1000px]">
            <thead>
              <tr>
                <Th col="label" num={false}>{livello === "marche" ? "Marca" : livello === "modelli" ? "Modello" : "Vendita"}</Th>
                <Th col="pezzi">Pezzi</Th><Th col="incasso">Incassato</Th><Th col="utile">Utile</Th><Th col="ricarico">Ricarico</Th>
                <Th col="margine">Margine</Th><Th col="quota">Quota utile</Th><Th col="magValore">In magazzino</Th>
              </tr>
              <tr>
                {cols.map((c) => (
                  <th key={c} className="!bg-muted !p-1">
                    <Input aria-label={`Filtra ${c}`} placeholder="Digita per filtrare" value={filtri[c] ?? ""} onChange={(e) => setFiltri({ ...filtri, [c]: e.target.value })} className="h-6 text-xs px-1.5 bg-background text-foreground font-normal" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibili.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nessun dato nel periodo</td></tr>}
              {visibili.map((r) => (
                <tr key={r.key} className={livello !== "vendite" ? "cursor-pointer" : undefined} onClick={() => livello !== "vendite" && apri(r)}>
                  <td>{livello === "vendite" ? r.label : <button type="button" className="text-left font-medium hover:underline">▸ {r.label} {livello === "marche" && <span className="text-muted-foreground">({r.figli})</span>}</button>}</td>
                  <td className="num">{r.pezzi}</td><td className="num">{eur(r.incasso)}</td><td className="num">{eur(r.utile)}</td>
                  <td className="num">{pct(r.ricarico)}</td><td className="num">{pct(r.margine)}</td>
                  <td className="num min-w-[120px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="h-1.5 w-14 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.max(0, Math.min(100, r.quota ?? 0))}%` }} /></div>
                      {pct(r.quota)}
                    </div>
                  </td>
                  <td className="num">{r.magPezzi === null ? "—" : `${r.magPezzi} · ${eur(r.magValore)}`}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {filtroAttivo && (
                <tr><td>Totale</td><td className="num">{totF.pezzi}</td><td className="num">{eur(totF.incasso)}</td><td className="num">{eur(totF.utile)}</td>
                  <td className="num">{pct(totF.ricarico)}</td><td className="num">{pct(totF.margine)}</td><td className="num">{pct(totF.quota)}</td>
                  <td className="num">{livello === "vendite" ? "—" : `${totF.magPezzi} · ${eur(totF.magValore)}`}</td></tr>
              )}
              <tr><td>Totale senza filtri</td><td className="num">{totT.pezzi}</td><td className="num">{eur(totT.incasso)}</td><td className="num">{eur(totT.utile)}</td>
                <td className="num">{pct(totT.ricarico)}</td><td className="num">{pct(totT.margine)}</td><td className="num">{pct(totT.quota)}</td>
                <td className="num">{livello === "vendite" ? "—" : `${totT.magPezzi} · ${eur(totT.magValore)}`}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
