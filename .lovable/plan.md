

# Fix Detection: Scansione Multi-Sheet, Header Flessibile e Normalizzazione

## Problema

La detection fallisce perche:
1. Solo il primo foglio viene analizzato, ma il foglio con i dati potrebbe essere un altro
2. La scansione header si ferma a 20 righe (potrebbe non bastare)
3. Gli header non vengono normalizzati completamente (spazi doppi, case)
4. Le keywords di matching non coprono tutte le varianti ("importo euro" senza parentesi)

## Modifiche

### Entrambi i file: `src/pages/ImportTransazioni.tsx` e `src/components/ImportTransactionsDialog.tsx`

**1. Scansione multi-sheet per trovare il foglio giusto**

Invece di prendere sempre `SheetNames[0]`, iterare su tutti i fogli e scegliere quello che contiene una riga con "Data Contabile". Se nessun foglio la contiene, usare il primo foglio come fallback.

```typescript
const workbook = XLSX.read(data, { type: "array" });
if (workbook.SheetNames.length === 0) { /* errore file vuoto */ return; }

let targetSheet: XLSX.WorkSheet | null = null;
let headerRowIndex = -1;

for (const name of workbook.SheetNames) {
  const ws = workbook.Sheets[name];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const limit = Math.min(raw.length, 50);
  for (let i = 0; i < limit; i++) {
    const row = raw[i];
    if (Array.isArray(row) && row.some(cell =>
      typeof cell === "string" && cell.toLowerCase().includes("data contabile")
    )) {
      targetSheet = ws;
      headerRowIndex = i;
      break;
    }
  }
  if (targetSheet) break;
}

// Fallback: primo foglio senza offset
if (!targetSheet) {
  targetSheet = workbook.Sheets[workbook.SheetNames[0]];
}
```

**2. Aumentare scansione a 50 righe**

Il limite di scansione passa da 20 a 50 righe.

**3. Normalizzazione header completa**

Dopo l'estrazione delle colonne, normalizzare con trim + rimozione spazi doppi:

```typescript
const cols = rawCols.map(c => c.trim().replace(/\s+/g, ' '));
```

**4. Normalizzare anche nel matching auto-map**

Il confronto nell'auto-mapping deve applicare la stessa normalizzazione:

```typescript
const match = cols.find(c => 
  keywords.includes(c.toLowerCase().trim().replace(/\s+/g, ' '))
);
```

**5. Aggiungere keyword "importo euro" (senza parentesi)**

Aggiungere all'array `importo` in AUTO_MAP_KEYS:
```typescript
importo: ["importo", "amount", "importo (eur)", "importo (euro)", "importo euro", "ammontare", "valore", "value"]
```

E per addebiti/accrediti aggiungere varianti senza parentesi:
```typescript
addebiti: ["addebiti", "addebiti (euro)", "addebiti euro", "dare"]
accrediti: ["accrediti", "accrediti (euro)", "accrediti euro", "avere"]
```

## Dettagli Tecnici

| File | Modifica |
|------|----------|
| `src/pages/ImportTransazioni.tsx` | Multi-sheet scan, 50 righe, normalizzazione header, keywords estese |
| `src/components/ImportTransactionsDialog.tsx` | Stesse modifiche |

La logica di parsing (split mode, importi, date) e la UI restano invariate.

