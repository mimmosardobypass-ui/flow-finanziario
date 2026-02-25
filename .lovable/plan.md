

# Trim Header e Errore Esplicito per Formato Non Rilevato

## Stato Attuale

Il supporto per entrambi i formati (colonna singola "Importo (euro)" e colonne separate "Addebiti/Accrediti") e il rilevamento header "Data Contabile" sono gia implementati. Mancano due dettagli:

1. **Trim sugli header**: Le chiavi JSON estratte dal foglio Excel possono contenere spazi iniziali/finali. Attualmente il trim viene applicato solo durante il confronto nell'auto-mapping, ma i nomi colonna stessi non vengono puliti.
2. **Errore esplicito**: Se dopo l'auto-mapping non viene rilevato ne "Importo" ne la coppia "Addebiti/Accrediti", non viene mostrato alcun errore.

## Modifiche

### `src/pages/ImportTransazioni.tsx`

**1. Trim dei nomi colonna (dopo riga 313)**

Dopo `Object.keys(json[0])`, applicare trim a ogni nome colonna e aggiornare anche le righe di dati per usare le chiavi trimmate:

```typescript
const rawCols = Object.keys(json[0]);
const cols = rawCols.map(c => c.trim());
// Remap rows with trimmed keys
const cleanedRows = json.map(row => {
  const clean: Record<string, unknown> = {};
  for (const key of rawCols) {
    clean[key.trim()] = row[key];
  }
  return clean;
});
```

**2. Errore esplicito se formato non rilevato (dopo auto-mapping)**

Dopo aver calcolato l'auto-mapping, verificare se e stato trovato almeno un formato valido. Se no, mostrare un toast di errore:

```typescript
if (!autoMapping.importo && !(autoMapping.addebiti && autoMapping.accrediti)) {
  toast({
    title: "Formato non riconosciuto",
    description: "Il file non contiene colonne 'Importo (euro)' ne 'Addebiti/Accrediti (euro)'.",
    variant: "destructive",
  });
  return;
}
```

### `src/components/ImportTransactionsDialog.tsx`

Stesse due modifiche: trim delle colonne e errore esplicito.

## Dettagli Tecnici

| File | Modifica |
|------|----------|
| `src/pages/ImportTransazioni.tsx` | Trim header + errore formato non rilevato |
| `src/components/ImportTransactionsDialog.tsx` | Stesse modifiche |

Nessuna modifica alla logica di parsing, split mode o salvataggio database.
