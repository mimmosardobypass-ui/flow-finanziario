

# Supporto Formato Postepay con Colonne Separate (Addebiti/Accrediti)

## Problema

Il file Postepay puo avere due formati diversi:
1. **Colonna singola**: "Importo (euro)" con segno positivo/negativo (gia supportato)
2. **Colonne separate**: "Addebiti (euro)" e "Accrediti (euro)" (non supportato)

Il sistema deve rilevare automaticamente quale formato usare.

## Approccio

Introdurre una modalita "split" che si attiva automaticamente quando il file contiene le colonne "Addebiti (euro)" e "Accrediti (euro)". In questa modalita, il campo "importo" nel mapping viene sostituito da due campi (addebiti e accrediti), e l'importo viene calcolato come `-addebiti` o `+accrediti`.

## Modifiche

### `src/pages/ImportTransazioni.tsx`

**1. Estendere MappingState (riga 42-46)**

Aggiungere campi opzionali per le colonne split:
```typescript
interface MappingState {
  data: string;
  descrizione: string;
  importo: string;        // usato in modalita singola
  addebiti: string;       // usato in modalita split
  accrediti: string;      // usato in modalita split
}
```

**2. Aggiungere auto-detection nel processFile (riga 270-282)**

Dopo l'auto-map esistente, rilevare se le colonne contengono "addebiti (euro)" e "accrediti (euro)". Se si, popolare `addebiti` e `accrediti` nel mapping e lasciare `importo` vuoto. Se esiste "importo (euro)", usare la logica attuale.

Aggiungere keywords nell'AUTO_MAP_KEYS:
```
addebiti: ["addebiti", "addebiti (euro)", "dare"]
accrediti: ["accrediti", "accrediti (euro)", "avere"]
```

**3. Derivare isSplitMode**

Un `useMemo` che calcola `isSplitMode = !mapping.importo && !!mapping.addebiti && !!mapping.accrediti`.

**4. Modificare parsedRows (riga 145-158)**

In modalita split, calcolare l'importo dalla riga:
- Se `addebiti` ha valore numerico -> `amount = -Math.abs(valore)`
- Se `accrediti` ha valore numerico -> `amount = +Math.abs(valore)`
- Se entrambi o nessuno -> hasError = true

**5. Modificare la validazione isMappingValid (riga 312-313)**

```typescript
const isMappingValid = mapping.data && mapping.descrizione && selectedContoId &&
  (mapping.importo || (mapping.addebiti && mapping.accrediti));
```

**6. Modificare la UI dei selettori colonna (riga 444-466)**

In modalita split, mostrare i selettori "Addebiti" e "Accrediti" al posto di "Importo". Usare un rendering condizionale basato su `isSplitMode`.

**7. Nessuna modifica al rendering della tabella anteprima**

La tabella usa gia `r.amount` per visualizzare segno e colore -- funzionera automaticamente perche `parsedRows` calcolera il valore con il segno corretto.

### `src/components/ImportTransactionsDialog.tsx`

Applicare le stesse modifiche al dialog di importazione (usato altrove):
- Estendere MappingState con addebiti/accrediti
- Aggiungere auto-detection
- Modificare parsedRows per la modalita split
- Aggiornare isMappingValid
- Aggiornare i selettori colonna nella UI

### Nessuna modifica al backend

`useImportTransactions.ts` riceve gia `ParsedTransaction[]` con `amount` che include il segno. Non servono modifiche.

## Dettagli Tecnici

| File | Tipo modifica |
|------|--------------|
| `src/pages/ImportTransazioni.tsx` | Estendere mapping, auto-detect split, calcolo importo, UI selettori |
| `src/components/ImportTransactionsDialog.tsx` | Stesse modifiche per il dialog |

La logica di auto-detection funziona cosi:
1. Se trovata colonna "importo (euro)" -> modalita singola (come ora)
2. Se trovate colonne "addebiti (euro)" E "accrediti (euro)" -> modalita split
3. Se trovata solo una delle due -> l'utente puo mappare manualmente l'altra

