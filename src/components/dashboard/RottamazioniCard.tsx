import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinanziamenti } from "@/hooks/useFinanziamenti";
import { fmtEur, fmtData } from "@/components/finanziamenti/utils";

export function RottamazioniCard() {
  const navigate = useNavigate();
  const { data: tutti = [] } = useFinanziamenti();
  const rottamazioni = tutti.filter((c) => c.gruppo === "rottamazione");
  if (rottamazioni.length === 0) return null;

  const oggiISO = format(new Date(), "yyyy-MM-dd");
  const attive = rottamazioni.filter((c) => c.stato === "attivo");
  const debito = attive.reduce((s, c) => s + c.residuo_da_pagare, 0);
  const prossima = attive
    .filter((c) => c.prossima_scadenza && c.prossima_scadenza >= oggiISO)
    .sort((a, b) => (a.prossima_scadenza ?? "").localeCompare(b.prossima_scadenza ?? ""))[0];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-foreground">Rottamazioni</CardTitle>
        <FileWarning className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Debito residuo</p>
            <p className="text-sm font-semibold text-foreground">{fmtEur(debito)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prossima rata</p>
            <p className="text-sm font-medium text-foreground">
              {prossima
                ? `${fmtData(prossima.prossima_scadenza)} · ${fmtEur(prossima.prossima_importo)}`
                : "—"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/rottamazioni")}>
          Apri
        </Button>
      </CardContent>
    </Card>
  );
}
