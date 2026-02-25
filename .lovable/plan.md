

# Supporto Header Postepay con Righe di Intestazione

## Problema

I file Postepay Excel hanno righe di intestazione prima delle colonne dati (es. "Intestato a:", "Saldo al:", ecc.). Il parser attuale usa `sheet_to_json` che prende la riga 1 come header, risultando in colonne errate.

## Approccio

Usare `XLSX.utils.sheet_to_json` con `header: 1` (array di array) per leggere le prime 20 righe raw, cercare quella contenente "Data Contabile", e poi ri-parsare il foglio usando quella riga come header.

## Modifiche

### Entrambi i file: `src/pages/ImportTransazioni.tsx` e `src/components/ImportTransactionsDialog.tsx`

Modificare la funzione `processFile`, nella sezione dopo `XLSX.read()`, sostituendo il parsing diretto con questa logica:

**1. Leggere il foglio come array di array (prime 20 righe)**

```typescript
const sheet = workbook.Sheets[sheetName];
const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
```

**2. Cercare la riga header contenente "Data Contabile"**

Scansionare le prime 20 righe per trovare quella che contiene una cella con il testo "Data Contabile" (case-insensitive). Se non trovata, fare fallback al comportamento attuale (`sheet_to_json` senza opzioni) per supportare file non-Postepay.

```typescript
let headerRowIndex = -1;
const scanLimit = Math.min(rawRows.length, 20);
for (let i = 0; i < scanLimit; i++) {
  const row = rawRows[i];
  if (Array.isArray(row) && row.some(cell => 
    typeof cell === "string" && cell.toLowerCase().includes("data contabile")
  )) {
    headerRowIndex = i;
    break;
  }
}
```

**3. Ri-parsare con l'offset corretto**

Se trovata la riga header, usare l'opzione `range` di `sheet_to_json` per iniziare da quella riga:

```typescript
let json: Record<string, unknown>[];
if (headerRowIndex >= 0) {
  json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerRowIndex });
} else {
  json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}
```

**4. Validazione dati**

Il resto della logica (controllo `json.length === 0`, estrazione colonne, auto-mapping) resta invariato.

### Nessuna altra modifica

L'auto-mapping, la split mode (addebiti/accrediti), il parsing importi e la UI restano tutti invariati.

## Dettagli Tecnici

| File | Modifica |
|------|----------|
| `src/pages/ImportTransazioni.tsx` | Aggiungere rilevamento header nella funzione `processFile` |
| `src/components/ImportTransactionsDialog.tsx` | Stessa modifica nella funzione `processFile` |

Il parametro `range` di `sheet_to_json` accetta un numero che indica la riga da cui iniziare (0-indexed), trattando quella riga come header.

