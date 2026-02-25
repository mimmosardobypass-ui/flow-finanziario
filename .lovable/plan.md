

# Importazione Postepay - Auto-mapping e Esclusione Righe

## Panoramica

Migliorare il dialog di importazione per riconoscere automaticamente il formato Postepay (colonne: "Data Contabile", "Data Valuta", "Importo (euro)", "Descrizione operazioni") e permettere all'utente di escludere manualmente singole righe prima del salvataggio.

---

## Modifiche

### 1. `src/components/ImportTransactionsDialog.tsx`

**Auto-mapping Postepay**: Aggiungere le keyword specifiche Postepay all'oggetto `AUTO_MAP_KEYS` in modo che le colonne vengano riconosciute automaticamente:

| Campo | Keyword aggiunte |
|-------|-----------------|
| `data` | `"data contabile"` |
| `descrizione` | `"descrizione operazioni"` |
| `importo` | `"importo (euro)"` |

In questo modo, caricando un file Postepay, i tre campi verranno mappati senza intervento manuale.

**Esclusione righe**: Aggiungere uno stato `excludedRows` (Set di indici) e nella tabella anteprima:
- Mostrare **tutte** le righe (non solo le prime 5), con scroll verticale limitato
- Aggiungere una colonna checkbox a sinistra per ogni riga
- Le righe deselezionate vengono escluse dall'importazione
- Mostrare un contatore "X di Y righe selezionate" sopra la tabella
- Il pulsante di importazione mostra il numero effettivo di righe che verranno importate

**Anteprima migliorata**: Nella tabella anteprima, le colonne mappate mostrano i valori interpretati (data formattata, importo con segno e colore verde/rosso) accanto ai valori originali per conferma visiva.

### 2. Nessuna modifica backend

La logica di `useImportTransactions.ts` resta invariata: riceve gia un array di `ParsedTransaction` con segno positivo/negativo che determina entrata/uscita. Il filtraggio delle righe escluse avviene nel dialog prima di passare i dati alla mutation.

---

## Dettaglio implementazione

### Auto-mapping aggiornato

```text
AUTO_MAP_KEYS = {
  data: ["data", "date", "fecha", "datum", "data contabile"],
  descrizione: ["descrizione", "description", "desc", "causale", "nota", "note", "descrizione operazioni"],
  importo: ["importo", "amount", "importo (eur)", "importo (euro)", "ammontare", "valore", "value"],
}
```

### Stato esclusione righe

- Nuovo state: `excludedRows: Set<number>` (indici delle righe escluse)
- Checkbox "Seleziona tutto" nell'header della tabella
- Checkbox per ogni riga nella prima colonna
- Le righe escluse appaiono con opacita ridotta
- Il conteggio nel pulsante importa si aggiorna dinamicamente

### Flusso utente

1. L'utente carica il file Postepay
2. Le colonne vengono mappate automaticamente (Data Contabile, Descrizione operazioni, Importo euro)
3. L'utente seleziona il conto destinazione
4. Nella tabella anteprima vede tutte le righe con checkbox
5. Puo deselezionare righe che non vuole importare
6. Clicca "Importa X righe" (solo le selezionate)
7. Vede il risultato finale

### "Data Valuta"

La colonna "Data Valuta" viene semplicemente ignorata: non viene mappata a nessun campo e appare nella tabella anteprima come colonna non mappata. Non servono modifiche al database.

---

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/ImportTransactionsDialog.tsx` | Aggiungere keyword Postepay, stato esclusione righe, checkbox nella tabella, contatore righe selezionate |

Nessuna migrazione database necessaria. Nessuna modifica al backend.

