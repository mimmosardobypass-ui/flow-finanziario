

# Riconciliazione Manuale tra Movimenti

## Panoramica

Aggiungere un sistema di riconciliazione manuale che permette di collegare transazioni di conti diversi tramite un `reconciliation_id` condiviso, con stato visivo nella tabella e pannello laterale per la selezione dei movimenti compatibili.

---

## 1. Migrazione Database

Aggiungere due colonne alla tabella `transactions`:

| Colonna | Tipo | Default | Descrizione |
|---------|------|---------|-------------|
| `reconciliation_id` | uuid | NULL | Collega movimenti riconciliati tra loro |
| `reconciliation_status` | text | 'none' | Stato: `none`, `partial`, `complete` |

---

## 2. Nuovo componente: Pannello Riconciliazione

Creare `src/components/ReconciliationSheet.tsx` usando il componente Sheet (pannello laterale) gia presente nel progetto.

Il pannello mostra:
- **Sezione superiore**: dettagli della transazione selezionata (importo, conto, data, descrizione)
- **Elenco movimenti compatibili**: transazioni di **altri conti** filtrate per compatibilita (stesso importo oppure stessa data, con tolleranza di +/- 3 giorni). I movimenti gia riconciliati con la stessa transazione sono evidenziati
- **Checkbox** per selezionare uno o piu movimenti da collegare
- **Pulsante "Riconcilia"**: collega i movimenti selezionati assegnando lo stesso `reconciliation_id` e aggiornando lo stato
- **Pulsante "Rimuovi riconciliazione"**: per scollegare movimenti gia riconciliati

### Logica stato riconciliazione
- `none`: nessun `reconciliation_id` assegnato
- `partial`: ha un `reconciliation_id` ma il totale entrate != totale uscite nel gruppo
- `complete`: il totale entrate == totale uscite nel gruppo riconciliato

---

## 3. Nuovo hook: `useReconciliation`

Creare `src/hooks/useReconciliation.ts` con:

- **`useReconcile()`**: mutation che riceve un array di ID transazione, genera un UUID, aggiorna `reconciliation_id` per tutte, poi calcola e aggiorna `reconciliation_status` (partial o complete)
- **`useUnreconcile()`**: mutation che rimuove il `reconciliation_id` e resetta lo stato a `none` per tutte le transazioni del gruppo
- **`useCompatibleTransactions(transactionId)`**: query che recupera le transazioni compatibili per riconciliazione (stesso importo o date vicine, conti diversi)

---

## 4. Colonna "Riconciliazione" nella tabella

In `src/pages/Transactions.tsx`, aggiungere una colonna tra "Importo" e "Azioni":

| Stato | Icona | Colore |
|-------|-------|--------|
| `none` | `Circle` | Grigio (text-muted-foreground) |
| `partial` | `CircleDot` | Arancione (text-orange-500) |
| `complete` | `CircleCheck` | Verde (text-success) |

Cliccando sull'icona si apre il pannello laterale `ReconciliationSheet`.

---

## 5. Filtro "Riconciliazione" nei filtri

In `src/components/TransactionFilters.tsx` e `src/hooks/useFilteredTransactions.ts`:

- Aggiungere campo `reconciliation` al tipo `TransactionFilters` con valori: `"all"` | `"none"` | `"partial"` | `"complete"`
- Aggiungere un Select nei filtri con opzioni: "Tutti", "Non riconciliati", "Parziali", "Riconciliati"
- Filtrare lato server con `.eq("reconciliation_status", value)` quando selezionato

---

## 6. Riepilogo file

| File | Azione |
|------|--------|
| Migrazione SQL | Aggiungere colonne `reconciliation_id` e `reconciliation_status` |
| `src/hooks/useReconciliation.ts` | **Nuovo** - Hook per riconciliazione e movimenti compatibili |
| `src/hooks/useTransactions.ts` | Aggiornare interfacce `Transaction` e `TransactionWithCategory` |
| `src/hooks/useFilteredTransactions.ts` | Aggiungere filtro `reconciliation` |
| `src/components/ReconciliationSheet.tsx` | **Nuovo** - Pannello laterale riconciliazione |
| `src/components/TransactionFilters.tsx` | Aggiungere Select per filtro riconciliazione |
| `src/pages/Transactions.tsx` | Aggiungere colonna icona + apertura pannello |

---

## 7. Sicurezza

- Nessun movimento viene creato o eliminato
- Solo i campi `reconciliation_id` e `reconciliation_status` vengono modificati
- I saldi non vengono alterati in alcun modo
- Le RLS esistenti proteggono gia le transazioni per utente

