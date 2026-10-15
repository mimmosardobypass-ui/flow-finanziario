import { describe, expect, test } from "bun:test";
import { interpretaTabella, numeroIt, normalizzaMarca, categoriaProposta, leggiTitolo } from "../src/lib/smartphone/parserCarico";
import { totali, utile, ricarico, margine, dataRientro } from "../src/lib/smartphone/calcoli";

const tab = [
  ["RETTIFICA POSITIVA - N.doc. 101026 del  10/10/2026"],
  ["Marca","Id univoco articolo","Modello","Descrizione","Quantità","Valore","Importo","Iva"],
  ["REAL ME","RMENOTE70T4128BG","NOTE70T4128BG \u200C ","realme Note 70T 128GB 4GB Beach Gold","1,00","129,90","129,90","22"],
  ["REALME","REALMEBUDSTECHLIFE","REALMEBUDSTECHLIFE \u200C ","AURICOLARI BUDS TECHLIFE WHITE","1,00","10,00","10,00","22"],
  ["REALME","REALMEBUDSTECHLIFE","REALMEBUDSTECHLIFE \u200C ","AURICOLARI BUDS TECHLIFE WHITE","1,00","10,00","10,00","22"],
  ["NOKIA","NOKIA105","NOKIA105 \u200C ","NOKIA 105","2,00","12,50","25,00","22"],
];

describe("lettura carico", () => {
  const c = interpretaTabella(tab);
  test("titolo documento", () => { expect(c.tipo).toBe("RETTIFICA POSITIVA"); expect(c.numero).toBe("101026"); expect(c.data_documento).toBe("2026-10-10"); });
  test("costo unitario dalla colonna Valore", () => { expect(c.righe.find((r) => r.codice_articolo === "NOKIA105")!.costo_unitario).toBe(12.5); });
  test("quantità Nokia = 2 pezzi", () => { expect(c.righe.find((r) => r.codice_articolo === "NOKIA105")!.quantita).toBe(2); });
  test("righe identiche unite", () => { const b = c.righe.find((r) => r.codice_articolo === "REALMEBUDSTECHLIFE")!; expect(b.quantita).toBe(2); expect(b.righeFile).toBe(2); });
  test("marca uniformata", () => { expect(c.righe[0].marca).toBe("REALME"); expect(normalizzaMarca("Real Me")).toBe("REALME"); });
  test("caratteri invisibili tolti", () => { expect(c.righe[0].modello).toBe("NOTE70T4128BG"); });
  test("categorie proposte", () => {
    expect(categoriaProposta("AURICOLARI BUDS")).toBe("Accessorio");
    expect(categoriaProposta("NOKIA 105")).toBe("Cellulare");
    expect(categoriaProposta("realme Note 70T")).toBe("Smartphone");
  });
  test("4 righe file → 3 articoli, 5 pezzi", () => { expect(c.righe.length).toBe(3); expect(c.righe.reduce((s, r) => s + r.quantita, 0)).toBe(5); });
  test("titolo mancante", () => { expect(leggiTitolo("Altro testo")).toBeNull(); });
});

describe("numeri italiani", () => {
  test("1.234,56", () => expect(numeroIt("1.234,56")).toBe(1234.56));
  test("199.90", () => expect(numeroIt("199.90")).toBe(199.9));
});

describe("formule IVA esclusa", () => {
  test("utile, ricarico, margine", () => {
    const u = utile(150, 100); expect(u).toBe(50);
    expect(ricarico(u, 100)).toBe(50); expect(margine(u, 150)).toBeCloseTo(33.333, 2);
  });
  test("totali calcolati sui totali, non media delle percentuali", () => {
    const t = totali([{ costo: 100, incasso: 200 }, { costo: 900, incasso: 1000 }]);
    expect(t.utile).toBe(200); expect(t.ricarico).toBe(20); expect(t.margine).toBeCloseTo(16.667, 2);
  });
  test("rientro capitale", () => {
    expect(dataRientro([{ data: "2026-10-12", incasso: 60 }, { data: "2026-10-15", incasso: 50 }], 100)).toBe("2026-10-15");
    expect(dataRientro([{ data: "2026-10-12", incasso: 60 }], 100)).toBeNull();
  });
});
