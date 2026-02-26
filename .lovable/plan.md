
# Consolidamento definitivo logica riconciliazione

## Audit stato attuale

La logica degli stati (none/suggested/reconciled) e i colori UI (grigio/rosso/verde) sono gia corretti. Tuttavia ci sono **2 bug reali** che compromettono il comportamento desiderato:

### Bug 1: Le suggestion rifiutate vengono ri-create al ricalcolo

In `generateSuggestionsForIds` (riga 207-212), il codice **elimina tutte** le vecchie suggestion per le transazioni sorgente prima di reinserire. Cio significa che se l'utente rifiuta una proposta e poi viene eseguito un ricalcolo (manuale o automatico), la proposta rifiutata riappare.

**Fix**: prima di cancellare, salvare le coppie gia `dismissed` e filtrare i nuovi suggerimenti per non reinserire coppie gia rifiutate.

### Bug 2: Dopo rifiuto di tutte le suggestion, il pallino resta rosso

Quando l'utente rifiuta (dismiss) tutte le suggestion di una transazione, `reconciliation_status` resta `suggested` (pallino rosso) anche se non ci sono piu proposte attive. Il pallino rosso resta ma cliccando si vede "Nessuna proposta trovata".

**Fix**: in `useDismissSuggestion`, dopo il dismiss, verificare se restano suggestion attive (non dismissed) per quella transazione. Se zero, aggiornare `reconciliation_status` a `none`.

## Modifiche pianificate

### 1. `src/hooks/useReconciliationSuggestions.ts` - `generateSuggestionsForIds`

**Prima di eliminare le vecchie suggestion** (riga 207):
- Query le coppie dismissed esistenti per le transazioni sorgente
- Salvarle in un Set di coppie `source+candidate`
- Dopo il calcolo, filtrare `allSuggestions` per escludere coppie gia rifiutate
- Poi procedere con delete + insert come prima

```text
Flusso:
1. Fetch dismissed pairs -> Set<"srcId|candId">
2. Compute suggestions
3. Filter out dismissed pairs
4. Delete old non-dismissed
5. Insert filtered suggestions
6. Update status
```

### 2. `src/hooks/useReconciliationSuggestions.ts` - `useDismissSuggestion`

Dopo il dismiss, aggiungere logica di rollback status:
- Query `reconciliation_suggestions` per la transazione associata (sia come source che candidate)
- Contare quante hanno `dismissed = false`
- Se 0 attive rimaste: `UPDATE transactions SET reconciliation_status = 'none'` per quella transazione
- Invalidare query cache

Per fare questo serve passare il `transactionId` al dismiss (non solo `suggestionId`). Modificare l'interfaccia di `useDismissSuggestion` per accettare `{ suggestionId, transactionId }`.

### 3. `src/components/ReconciliationSheet.tsx` - Aggiornare chiamata dismiss

Passare `transaction.id` nella chiamata `handleDismiss` per supportare il rollback status:

```typescript
handleDismiss({ suggestionId: suggestion.id, transactionId: transaction.id })
```

### 4. Miglioramento UI proposte nel ReconciliationSheet

Aggiungere badge tipo visibile (non solo nel tooltip):
- Estrarre il tipo principale dalla `reason` (es. `internal_transfer`, `same_amount_abs`)
- Mostrare come Badge colorato accanto allo score
- Mostrare differenza giorni come testo secondario

## Riepilogo state machine finale

```text
none ──[backfill/generate crea suggestions]──> suggested
suggested ──[utente clicca Accetta]──> reconciled  
suggested ──[utente rifiuta TUTTE le suggestions]──> none
reconciled ──[utente clicca Rimuovi riconciliazione]──> none
```

## File modificati

| File | Modifica |
|------|----------|
| `useReconciliationSuggestions.ts` | Preservare dismissed pairs nel ricalcolo; rollback status su dismiss totale |
| `ReconciliationSheet.tsx` | Passare transactionId al dismiss; badge tipo visibile |

Nessuna migrazione DB necessaria. Nessun nuovo file.
