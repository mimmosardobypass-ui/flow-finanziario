

# Parsing basato su indici colonna (array di array)

## Problema

Il parsing attuale usa `sheet_to_json` con header automatici, che non e affidabile con i file XLSX di Poste Italiane perche i nomi colonna possono variare o contenere caratteri nascosti.

## Approccio

Riscrivere `processFile` in entrambi i file per usare esclusivamente `sheet_to_json(ws, { header: 1 })` (array di array) e individuare le colonne tramite indice, non per nome.

## Logica nuova di `processFile`

1. Leggere ogni worksheet come array di array
2. Cercare nelle prime **200 righe** una riga che contiene una cella con "data contabile" (case-insensitive, con trim)
3. Da quella riga header, trovare gli indici colonna cercando match parziali (`.includes()`):
   - `dateIndex`: cella che contiene "data contabile"
   - `descrIndex`: cella che contiene "descrizione"
   - `debitIndex`: cella che contiene "addebiti"
   - `creditIndex`: cella che contiene "accrediti"
   - `importoIndex`: cella che contiene "importo"
4. Tutte le righe dopo l'header diventano i dati
5. Per ogni riga dati, leggere i valori tramite indice (`row[dateIndex]`, `row[descrIndex]`, ecc.)
6. Calcolo importo:
   - Se `debitIndex` presente e la cella e valorizzata: `amount = -Number(cella)`
   - Altrimenti se `creditIndex` presente e valorizzato: `amount = +Number(cella)`
   - Altrimenti se `importoIndex` presente: `amount = Number(cella)` preservando il segno
7. Validazione: se nessun indice data trovato, mostrare errore

## Cosa viene rimosso/semplificato

- **`AUTO_MAP_KEYS`**: non piu necessario (la detection usa `.includes()` sulle celle header)
- **`MappingState` e selettori colonna manuali**: sostituiti da indici trovati automaticamente. L'utente non deve piu selezionare le colonne
- **`columns` state**: non piu necessario
- Il selettore **Tipo file** resta disponibile ma diventa opzionale/informativo; la detection e unica e gestisce sia importo singolo che addebiti/accrediti automaticamente in base alle colonne trovate

## Cosa resta invariato

- `tryParseDate` e `tryParseAmount` (funzioni helper)
- Logica di esclusione righe, import verso Supabase, selezione conto
- UI della tabella di anteprima e del bottone importa
- Scansione multi-sheet (ora estesa a 200 righe)

## Dettagli tecnici

### Struttura dati interna

Le righe vengono salvate come `Record<string, unknown>` con chiavi sintetiche (`date`, `description`, `amount`) gia calcolate durante il parsing, cosi il resto del componente non cambia.

```typescript
// Dopo aver trovato headerRowIndex e gli indici:
const dataRows = rawRows.slice(headerRowIndex + 1);
const parsed = dataRows
  .filter(row => Array.isArray(row) && row.length > 0)
  .map(row => {
    const dateRaw = row[dateIndex];
    const descrRaw = descrIndex >= 0 ? row[descrIndex] : "";
    let amountRaw: number | null = null;
    if (debitIndex >= 0 && row[debitIndex] != null && row[debitIndex] !== "") {
      amountRaw = tryParseAmount(row[debitIndex]);
      if (amountRaw != null) amountRaw = -Math.abs(amountRaw);
    } else if (creditIndex >= 0 && row[creditIndex] != null && row[creditIndex] !== "") {
      amountRaw = tryParseAmount(row[creditIndex]);
      if (amountRaw != null) amountRaw = Math.abs(amountRaw);
    } else if (importoIndex >= 0) {
      amountRaw = tryParseAmount(row[importoIndex]);
    }
    return { date: dateRaw, description: descrRaw, amount: amountRaw };
  });
```

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/ImportTransazioni.tsx` | Riscrittura `processFile` con logica indici, rimozione `AUTO_MAP_KEYS`, semplificazione mapping |
| `src/components/ImportTransactionsDialog.tsx` | Stesse modifiche |

