import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSmartphone } from "@/hooks/useSmartphone";
import { TabImporta } from "@/components/smartphone/TabImporta";
import { TabMagazzino } from "@/components/smartphone/TabMagazzino";
import { TabVendi } from "@/components/smartphone/TabVendi";
import { TabRiepilogo } from "@/components/smartphone/TabRiepilogo";
import { TabDocumenti } from "@/components/smartphone/TabDocumenti";
import { TabStatistiche } from "@/components/smartphone/TabStatistiche";

const SCHEDE = [
  { v: "importa", l: "Importa" }, { v: "magazzino", l: "Magazzino" }, { v: "vendi", l: "Vendi" },
  { v: "riepilogo", l: "Riepilogo" }, { v: "documenti", l: "Documenti" }, { v: "statistiche", l: "Statistiche" },
];

export default function Smartphone() {
  const [sp, setSp] = useSearchParams();
  const tab = SCHEDE.some((s) => s.v === sp.get("tab")) ? sp.get("tab")! : "magazzino";
  const { data, isLoading, error } = useSmartphone();
  const vai = (t: string, extra: Record<string, string> = {}) => setSp({ tab: t, ...extra });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Smartphone</h1>
        <p className="text-sm text-muted-foreground">Carichi di telefoni e accessori, prezzi previsti, vendite e marginalità · importi IVA esclusa</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => vai(v)}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {SCHEDE.map((s) => <TabsTrigger key={s.v} value={s.v}>{s.l}</TabsTrigger>)}
        </TabsList>
        {isLoading || !data ? (
          <div className="flex justify-center py-12">{error ? <p className="text-destructive">Errore nel caricamento dei dati.</p> : <Loader2 className="h-6 w-6 animate-spin text-primary" />}</div>
        ) : (
          <>
            <TabsContent value="importa"><TabImporta dati={data} onImportato={() => vai("magazzino")} /></TabsContent>
            <TabsContent value="magazzino"><TabMagazzino dati={data} soloSenzaPrezzoDoc={sp.get("senzaPrezzo")} onVendi={(id) => vai("vendi", { pezzo: id })} /></TabsContent>
            <TabsContent value="vendi"><TabVendi dati={data} pezzoIniziale={sp.get("pezzo")} onVenduto={() => vai("riepilogo")} /></TabsContent>
            <TabsContent value="riepilogo"><TabRiepilogo dati={data} /></TabsContent>
            <TabsContent value="documenti"><TabDocumenti dati={data} onInserisciPrezzi={(id) => vai("magazzino", { senzaPrezzo: id })} /></TabsContent>
            <TabsContent value="statistiche"><TabStatistiche dati={data} /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
