
# Controllo Duplicati nell'Importazione Transazioni

## Panoramica

Dopo il caricamento del file e la selezione del conto, il sistema interroga Supabase per ottenere le transazioni esistenti su quel conto. Per ogni riga del file, calcola una chiave di confronto (`conto_id + data + importo_abs + descrizione_normalizzata`). Se la chiave corrisponde a una transazione esistente, la riga viene marcata come "Duplicato", deselezionata di default e mostrata con un badge visivo. Un contatore nell'header mostra il numero di duplicati trovati.

---

## Modifiche

### `src/pages/ImportTransazioni.tsx`

**1. Fetch transazioni esistenti per il conto selezionato**

Aggiungere una query con `useQuery` (o fetch manuale) che, quando `selectedContoId` cambia e c'e un file caricato, recupera le transazioni esistenti per quel conto da Supabase:

```text
SELECT date, amount, description FROM transactions
WHERE conto_id = :selectedContoId AND deleted_at IS NULL
```

**2. Funzione di normalizzazione e chiave duplicato**

Creare una funzione helper:

```text
function buildDuplicateKey(date: string, amount: number, description: string): string {
  const normalizedDesc = description.toLowerCase().trim().replace(/\s+/g, " ");
  return `${date}|${Math.abs(amount).toFixed(2)}|${normalizedDesc}`;
}
```

Costruire un `Set<string>` delle chiavi delle transazioni esistenti.

**3. Aggiornare `parsedRows` per includere flag `isDuplicate`**

Nel `useMemo` di `parsedRows`, per ogni riga valida, verificare se la sua chiave esiste nel Set dei duplicati. Aggiungere `isDuplicate: boolean` al tipo di ritorno.

**4. Auto-escludere i duplicati**

Quando il file viene processato o quando cambia il conto selezionato, aggiornare `excludedRows` per includere automaticamente gli indici delle righe duplicate.

**5. UI: Badge "Duplicato" nella tabella**

Nella colonna stato (ultima colonna), mostrare un badge arancione "Duplicato" accanto all'icona errore. Le righe duplicate restano selezionabili (l'utente puo forzare l'importazione) ma sono deselezionate di default.

**6. Contatore duplicati nell'header**

Nella sezione stats dell'header (accanto a "X/Y righe" e totali), aggiungere:

```text
[Duplicati: N]  (in arancione)
```

---

## Dettaglio implementazione

### Struttura dati

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `existingKeys` | `Set<string>` | Chiavi delle transazioni gia presenti nel conto selezionato |
| `isDuplicate` | `boolean` | Flag su ogni riga parsata |
| `duplicateCount` | `number` | Contatore derivato per l'header |

### Comportamento

- Le righe duplicate appaiono con opacita ridotta e un badge arancione "Duplicato"
- Sono **deselezionate di default** ma l'utente puo riselezionarle manualmente
- Non sono disabilitate come le righe con errori: la checkbox resta attiva
- Il "Seleziona tutto" non include i duplicati (seleziona solo le righe valide non duplicate)
- La ricerca per descrizione funziona normalmente anche sulle righe duplicate

### Query esistenti

La query viene eseguita solo quando c'e un `selectedContoId` valido e almeno una riga caricata. Si usa `useQuery` con key `["existing-transactions", selectedContoId]` per il caching.

---

## File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/ImportTransazioni.tsx` | Aggiungere query esistenti, calcolo duplicati, badge UI, contatore, auto-esclusione |

Nessun altro file da modificare. Nessuna migrazione database.
