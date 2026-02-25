

# Aggiunta `reconciliation_type` alla Riconciliazione

## Panoramica

Aggiungere una colonna `reconciliation_type` alla tabella `transactions` e una select nel pannello `ReconciliationSheet` per classificare il tipo di riconciliazione.

---

## 1. Migrazione Database

Aggiungere la colonna `reconciliation_type` alla tabella `transactions`:

```text
reconciliation_type  text  NULLABLE  DEFAULT NULL
```

Valori possibili: `transfer`, `pagamento`, `altro`. Resta `NULL` per le transazioni non riconciliate.

---

## 2. File da modificare

### Migrazione SQL
- Aggiungere colonna `reconciliation_type` a `public.transactions`

### `src/hooks/useReconciliation.ts`
- Modificare `useReconcile()` per accettare anche il `reconciliation_type` come parametro e salvarlo insieme a `reconciliation_id` e `reconciliation_status`

### `src/components/ReconciliationSheet.tsx`
- Aggiungere uno stato locale `reconciliationType` (default `"transfer"`)
- Inserire un componente `Select` con le opzioni:
  - **Transfer** - Trasferimento tra conti
  - **Pagamento** - Pagamento/incasso collegato
  - **Altro** - Altro tipo di collegamento
- Passare il tipo selezionato alla mutation `useReconcile`
- Quando la transazione e gia riconciliata, mostrare il tipo attuale come badge o testo informativo

### `src/integrations/supabase/types.ts`
- Aggiornamento automatico per includere `reconciliation_type` nel tipo `transactions`

---

## 3. Dettagli UI

La select viene posizionata sopra l'elenco dei movimenti compatibili, visibile solo quando si sta per creare una nuova riconciliazione (non gia riconciliata). Per le riconciliazioni esistenti, il tipo viene mostrato come informazione nella sezione "Movimenti gia riconciliati".

| Valore | Etichetta | Descrizione |
|--------|-----------|-------------|
| `transfer` | Transfer | Trasferimento tra conti |
| `pagamento` | Pagamento | Pagamento o incasso collegato |
| `altro` | Altro | Altro tipo di collegamento |

