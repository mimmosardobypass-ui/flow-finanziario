

# Correzione Formattazione Importi con Segno

## Problema

Nella pagina di anteprima importazione (`/import-transazioni`), gli importi negativi perdono il segno perche il codice usa `Math.abs()` nella formattazione UI. Un importo di `-36,90` viene mostrato come `€36,90` senza segno.

## Modifiche

### `src/pages/ImportTransazioni.tsx`

**1. Correggere la formattazione importi nella tabella anteprima (riga ~576)**

Attualmente:
```
{r.amount >= 0 ? "+" : ""}€{Math.abs(r.amount).toLocaleString("it-IT", ...)}
```

Corretto:
```
{r.amount >= 0 ? "+" : "-"}€{Math.abs(r.amount).toLocaleString("it-IT", ...)}
```

Il problema e che per valori negativi non viene aggiunto alcun prefisso. Basta aggiungere `"-"` nel ramo negativo. `Math.abs()` resta necessario qui solo per evitare il doppio segno meno nella formattazione (es. `-€-36,90`).

**2. Correggere i totali nell'header (riga ~321-330)**

Attualmente i totali mostrano gia `+€` e `-€` correttamente -- nessuna modifica necessaria qui.

### Nessuna modifica al database

Il salvataggio in `useImportTransactions.ts` con `Math.abs(t.amount)` e corretto: il database usa il pattern `amount` (sempre positivo) + `type` (`income`/`expense`). Questo e coerente con tutte le altre visualizzazioni (Transactions, Dashboard, Reconciliation).

## Riepilogo

| File | Modifica |
|------|----------|
| `src/pages/ImportTransazioni.tsx` | Aggiungere `"-"` per importi negativi nell'anteprima |

Una sola riga da modificare.

