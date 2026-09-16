import { useNavigate } from "react-router-dom";
import { HandCoins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinanziamenti } from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData } from "@/components/finanziamenti/utils";

export function FinanziamentiCard() {
  const navigate = useNavigate();
  const { data: contratti = [] } = useFinanziamenti();

  const attivi = contratti.filter((c) => c.stato === "attivo");
  const debito = attivi.reduce((s, c) => s + c.residuo_da_pagare, 0);
  const rateAlMese = attivi.reduce((s, c) => s + (c.importo_rata ?? 0), 0);
  const daVerificare = contratti.filter((c) => c.da_verificare).length;

  const prossima = attivi
    .filter((c) => c.prossima_scadenza)
    .sort((a, b) => (a.prossima_scadenza ?? "").localeCompare(b.prossima_scadenza ?? ""))[0];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base text-foreground">Finanziamenti</CardTitle>
        <HandCoins className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Debito residuo</p>
          <p className="text-2xl font-bold text-foreground">{fmtEur(debito)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Prossima rata</p>
            <p className="text-sm font-medium text-foreground">
              {prossima
                ? `${fmtData(prossima.prossima_scadenza)} · ${fmtEur(prossima.prossima_importo)}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rate al mese</p>
            <p className="text-sm font-medium text-foreground">{fmtEur(rateAlMese)}</p>
          </div>
        </div>
        {daVerificare > 0 ? (
          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
            {daVerificare} da verificare
          </Badge>
        ) : (
          <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
            In regola
          </Badge>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/finanziamenti")}>
          Apri Finanziamenti
        </Button>
      </CardContent>
    </Card>
  );
}
