

# Completamento `reconciliation_type`

## Panoramica

Completare l'implementazione del campo `reconciliation_type` con auto-detect per trasferimenti tra conti diversi, valori standardizzati e filtro dedicato.

---

## Modifiche

### 1. `src/components/ReconciliationSheet.tsx`

- **Standardizzare i valori**: cambiare `pagamento` in `payment` e `altro` in `other` nelle opzioni della Select
- **Auto-detect tipo**: quando l'utente seleziona movimenti compatibili, verificare automaticamente se i conti sono diversi e pre-impostare `reconciliationType = "transfer"`. L'utente puo comunque cambiarlo manualmente
- **Etichette aggiornate**: Transfer, Pagamento (`payment`), Altro (`other`)
- **Mostrare il tipo anche per transazioni gia riconciliate**: gia implementato con Badge, aggiornare le label per coerenza con i nuovi valori

### 2. `src/components/TransactionFilters.tsx`

- Aggiungere un nuovo Select per filtrare per `reconciliationType` con valori:
  - Tutti
  - Transfer
  - Pagamento
  - Altro
- Aggiungere il badge filtro attivo corrispondente nella sezione badge

### 3. `src/hooks/useFilteredTransactions.ts`

- Aggiungere campo `reconciliationType` al tipo `TransactionFilters` con valori `"all" | "transfer" | "payment" | "other"`
- Aggiungere filtro server-side: `.eq("reconciliation_type", value)` quando diverso da "all"
- Includere nel `serverFilters` per la queryKey

### 4. `src/hooks/useReconciliation.ts`

- Nella mutation `useReconcile`, aggiungere logica di auto-detect: se i movimenti selezionati appartengono a conti diversi e l'utente non ha modificato manualmente il tipo, impostare `reconciliation_type = "transfer"` come default (gia gestito dal default del parametro, nessuna modifica necessaria)

---

## Mappa valori

| Valore DB | Etichetta UI | Descrizione |
|-----------|-------------|-------------|
| `transfer` | Transfer | Trasferimento tra conti (auto-detect) |
| `payment` | Pagamento | Pagamento/incasso collegato |
| `other` | Altro | Altro tipo di collegamento |

---

## File coinvolti

| File | Tipo modifica |
|------|--------------|
| `src/components/ReconciliationSheet.tsx` | Standardizzare valori, aggiornare label |
| `src/components/TransactionFilters.tsx` | Aggiungere filtro tipo riconciliazione |
| `src/hooks/useFilteredTransactions.ts` | Aggiungere campo e filtro server-side |

Nessuna migrazione database necessaria: la colonna `reconciliation_type` esiste gia come testo libero.

