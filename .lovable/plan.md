

# Fix: Pallino "suggested" deve essere ROSSO, non blu

## Diagnosi

Il sistema funziona correttamente a livello logico:

- `generateSuggestionsForIds` imposta `reconciliation_status = 'suggested'` (NON `reconciled`)
- `useAcceptSuggestion` imposta `reconciliation_status = 'reconciled'` solo dopo click utente
- La separazione suggested vs reconciled e corretta nel backend

Il problema e **puramente visivo**: in `Transactions.tsx` riga 356, lo stato `suggested` usa `text-primary` (blu), che l'utente percepisce come "gia accettato/confermato". Deve essere rosso/ambra per comunicare "attenzione, proposta disponibile".

## Modifica

Un singolo file, una singola riga:

**`src/pages/Transactions.tsx`** (riga 356):

```typescript
// PRIMA (blu = sembra accettato)
<CircleDot className="h-4 w-4 text-primary" />

// DOPO (rosso = attenzione, proposta da verificare)
<CircleDot className="h-4 w-4 text-destructive" />
```

## Riepilogo stati visivi risultanti

| Stato | Icona | Colore | Significato |
|-------|-------|--------|-------------|
| `none` | `Circle` | grigio (`text-muted-foreground`) | Nessuna proposta |
| `suggested` | `CircleDot` | **rosso** (`text-destructive`) | Proposta disponibile, da verificare |
| `reconciled` | `CircleCheck` | verde (`text-success`) | Riconciliato dall'utente |

Nessuna modifica al backend: la logica di generazione/accettazione e gia corretta.
