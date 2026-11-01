import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { BedDouble } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useConti } from "@/hooks/useConti";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtEur, fmtData } from "@/components/finanziamenti/utils";

type Periodo = "tutto" | "anno" | "mese";

function intervallo(p: Periodo): { from: string | null; to: string | null } {
  const now = new Date();
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  if (p === "anno") return { from: f(startOfYear(now)), to: f(endOfYear(now)) };
  if (p === "mese") return { from: f(startOfMonth(now)), to: f(endOfMonth(now)) };
  return { from: null, to: null };
}

export default function BnB() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: categorie = [], isLoading: loadCat } = useCategories();
  const { data: conti = [] } = useConti();
  const [periodo, setPeriodo] = useState<Periodo>("tutto");
  const { from, to } = intervallo(periodo);

  const radice = categorie.find((c) => c.name === "B&B" && c.type === "expense" && !c.parent_id);
  const figli = useMemo(
    () => (radice ? categorie.filter((c) => c.parent_id === radice.id).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [categorie, radice],
  );
  const ids = useMemo(() => (radice ? [radice.id, ...figli.map((f) => f.id)] : []), [radice, figli]);

  const totali = useQuery({
    queryKey: ["bnb-totali", user?.id, ids, from, to],
    enabled: !!user && ids.length > 0,
    queryFn: async () => {
      const righe: { amount: number; category_id: string | null }[] = [];
      for (let off = 0; ; off += 1000) {
        let q = supabase
          .from("transactions")
          .select("amount, category_id")
          .eq("type", "expense")
          .is("deleted_at", null)
          .in("category_id", ids)
          .order("id")
          .range(off, off + 999);
        if (from) q = q.gte("date", from);
        if (to) q = q.lte("date", to);
        const { data, error } = await q;
        if (error) throw error;
        righe.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return righe;
    },
  });

  const ultimi = useQuery({
    queryKey: ["bnb-ultimi", user?.id, ids, from, to],
    enabled: !!user && ids.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("id, date, amount, description, category_id, conto_id")
        .eq("type", "expense")
        .is("deleted_at", null)
        .in("category_id", ids)
        .order("date", { ascending: false })
        .order("id", { ascending: false })
        .limit(20);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const righe = totali.data ?? [];
  const totale = righe.reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
  const perCat = new Map<string, { tot: number; n: number }>();
  for (const r of righe) {
    const k = r.category_id ?? "";
    const v = perCat.get(k) ?? { tot: 0, n: 0 };
    v.tot += Math.abs(Number(r.amount));
    v.n += 1;
    perCat.set(k, v);
  }

  const linkTx = (categoryId: string) => {
    const p = new URLSearchParams({ categoryId, type: "expense" });
    if (from) p.set("dateFrom", from);
    if (to) p.set("dateTo", to);
    return `/transactions?${p.toString()}`;
  };

  const nomeCat = (id: string | null) => {
    if (!id || id === radice?.id) return "Senza sottocategoria";
    return categorie.find((c) => c.id === id)?.name ?? "—";
  };
  const nomeConto = (id: string) => conti.find((c) => c.id === id)?.nome_conto ?? "—";

  const cards = [
    ...figli.map((f) => ({ id: f.id, nome: f.name, ...(perCat.get(f.id) ?? { tot: 0, n: 0 }) })),
    ...(radice && perCat.get(radice.id)
      ? [{ id: radice.id, nome: "Senza sottocategoria", ...perCat.get(radice.id)! }]
      : []),
  ];

  const periodi: { v: Periodo; l: string }[] = [
    { v: "tutto", l: "Tutto" },
    { v: "anno", l: "Anno corrente" },
    { v: "mese", l: "Mese corrente" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">B&amp;B</h1>
          <p className="text-sm text-muted-foreground">Spese per il B&amp;B</p>
        </div>
        <div className="flex gap-1 rounded-md border bg-card p-1">
          {periodi.map((p) => (
            <Button key={p.v} size="sm" variant={periodo === p.v ? "default" : "ghost"} onClick={() => setPeriodo(p.v)}>
              {p.l}
            </Button>
          ))}
        </div>
      </div>

      {loadCat ? (
        <Skeleton className="h-32 w-full" />
      ) : !radice ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BedDouble className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              La categoria di uscita "B&amp;B" non esiste ancora. Creala dalla pagina Categorie (tipo Uscita) con le sottocategorie Buba, Muratori, Idraulico e Materiali.
            </p>
            <Button asChild variant="outline"><Link to="/categories">Vai a Categorie</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Totale speso</p>
              {totali.isLoading ? (
                <Skeleton className="mt-2 h-8 w-40" />
              ) : (
                <p className="text-3xl font-bold text-destructive">{fmtEur(totale)}</p>
              )}
              <p className="text-xs text-muted-foreground">{righe.length} movimenti</p>
            </CardContent>
          </Card>

          {!totali.isLoading && righe.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nessuna spesa registrata. Assegna ai movimenti una delle categorie B&amp;B (Buba, Muratori, Idraulico, Materiali) dalla pagina Transazioni.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((c) => {
                  const pct = totale > 0 ? (c.tot / totale) * 100 : 0;
                  return (
                    <Card
                      key={c.id + c.nome}
                      className="cursor-pointer transition-colors hover:border-primary/50"
                      onClick={() => navigate(linkTx(c.id))}
                    >
                      <CardContent className="space-y-2 pt-6">
                        <p className="font-medium text-foreground">{c.nome}</p>
                        <p className="text-xl font-bold text-foreground whitespace-nowrap">{fmtEur(c.tot)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.n} movimenti · {pct.toFixed(1).replace(".", ",")}%
                        </p>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Ultimi movimenti</CardTitle>
                  <Button asChild variant="link" size="sm"><Link to={linkTx(radice.id)}>Vedi tutti</Link></Button>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {(ultimi.data ?? []).map((t) => (
                      <div key={t.id} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 py-2 text-sm sm:grid-cols-[90px_120px_130px_1fr_auto]">
                        <span className="text-muted-foreground">{fmtData(t.date)}</span>
                        <span className="hidden truncate sm:block">{nomeConto(t.conto_id)}</span>
                        <span className="hidden truncate sm:block">{nomeCat(t.category_id)}</span>
                        <span className="truncate" title={t.description ?? ""}>
                          {(t.description ?? "—").slice(0, 60)}
                        </span>
                        <span className="whitespace-nowrap font-medium text-destructive">
                          −{fmtEur(Math.abs(Number(t.amount)))}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
