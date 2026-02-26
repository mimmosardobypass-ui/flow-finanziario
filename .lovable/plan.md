

# Riconciliazione Automatica con Proposte

## Panoramica

Dopo l'importazione (o la creazione/modifica di transazioni), il sistema calcolerà automaticamente le proposte di riconciliazione e le salverà in una nuova tabella. L'utente vedrà subito quali movimenti hanno proposte pronte, senza dover cliccare su ciascuno.

## 1. Nuova tabella `reconciliation_suggestions`

Migrazione SQL per creare la tabella:

```text
reconciliation_suggestions
  - id (uuid, PK)
  - user_id (uuid, NOT NULL)
  - source_transaction_id (uuid, NOT NULL, FK -> transactions.id)
  - candidate_transaction_id (uuid, NOT NULL, FK -> transactions.id)
  - score (numeric, NOT NULL) -- punteggio di matching
  - reason (text) -- es. "same_amount_abs + keyword:SUMUP + date_delta:2"
  - created_at (timestamptz, DEFAULT now())
  - dismissed (boolean, DEFAULT false) -- per "Rifiuta"
  - UNIQUE(source_transaction_id, candidate_transaction_id)
```

RLS: solo il proprietario (user_id = auth.uid()) puo leggere/scrivere/cancellare.

Aggiornamento `reconciliation_status` sulla tabella `transactions`: i valori validi diventano `none`, `suggested`, `reconciled` (rimuovendo `partial` e `complete`).

## 2. Algoritmo di matching (client-side)

Nuovo hook `src/hooks/useReconciliationSuggestions.ts` con:

**`computeSuggestions(sourceTransaction, allTransactions)`**:

1. Filtra solo transazioni di conti diversi, non gia riconciliate, non cancellate
2. Finestra date: +-10 giorni dalla data del source
3. Scoring:
   - **Importo assoluto uguale**: +50 punti
   - **Importo assoluto simile (+-5%)**: +30 punti
   - **Date entro 3 giorni**: +20 punti, entro 10 giorni: +10 punti
   - **Segno opposto** (expense vs income): +10 punti (tipico di transfer)
   - **Keyword match**: normalizza testo (lowercase, rimuovi accenti/punteggiatura, split token), confronta parole "forti" (sumup, payout, postepay, bonifico, giroconto, compass, ecc.) -> +15 per keyword comune
   - **ID comune** (CRO/TRN/sequenze alfanumeriche lunghe >=8 caratteri presenti in entrambe le descrizioni): +25 punti
4. Soglia minima: score >= 30 per essere salvata come proposta
5. Ordina per score decrescente

**`useGenerateSuggestions()`** - mutation che:

- Riceve una lista di transaction IDs (o "tutte le non riconciliate")
- Per ogni transazione, calcola i match
- Elimina vecchie suggestions per quelle transazioni
- Inserisce le nuove in `reconciliation_suggestions`
- Aggiorna `reconciliation_status = 'suggested'` sulle transazioni che hanno almeno una proposta
- Aggiorna `reconciliation_status = 'none'` su quelle che non ne hanno piu

## 3. Auto-proposta dopo import

In `src/hooks/useImportTransactions.ts`, dopo l'inserimento delle righe:

1. Recupera tutte le transazioni dell'utente non riconciliate (limit 2000)
2. Chiama `computeSuggestions` per ogni transazione appena importata
3. Bulk-insert le suggestions trovate
4. Aggiorna `reconciliation_status` a `suggested` dove necessario

Lo stesso ricalcolo avviene anche in `useCreateTransaction` e `useUpdateTransaction` (per la singola transazione modificata).

## 4. UI - Colonna "Ric." semplificata

In `src/pages/Transactions.tsx`, la colonna Ric. mostra:

- **Pallino spento** (grigio, `Circle`): `reconciliation_status = 'none'` -- nessuna proposta
- **Pallino attivo** (pulsante evidenziato, `CircleDot` con colore primary/amber): `reconciliation_status = 'suggested'` -- ci sono proposte
- **Icona check** (`CircleCheck` verde): `reconciliation_status = 'reconciled'` -- gia riconciliata

Click apre il `ReconciliationSheet`.

## 5. ReconciliationSheet aggiornato

In `src/components/ReconciliationSheet.tsx`:

- **Top**: movimento selezionato (invariato)
- **Se `reconciled`**: mostra gruppo riconciliato + bottone "Rimuovi riconciliazione"
- **Se `suggested`**: lista "Proposte" ordinate per score, con reason come tooltip. Per ogni proposta:
  - Bottone "Accetta" -> crea riconciliazione (UUID comune, status `reconciled`)
  - Bottone "Rifiuta" -> segna `dismissed = true` sulla suggestion
- **Se `none`**: messaggio "Nessuna proposta" + bottone "Cerca proposte" che ricalcola solo per quella riga
- Bottone "Cerca altre" sempre visibile per ricalcolo on-demand

**Accettazione riconciliazione**:
- Imposta `reconciliation_id` uguale su entrambe le transazioni
- Set `reconciliation_status = 'reconciled'` su entrambe
- Cancella tutte le suggestions per entrambe le transazioni (o le segna dismissed)

## 6. Filtri aggiornati

In `src/components/TransactionFilters.tsx`, il filtro "Riconciliazione" diventa:

- Tutti
- Con proposte (`suggested`)
- Non riconciliati (`none` + `suggested`)
- Riconciliati (`reconciled`)

Rimuovere il filtro "Tipo riconciliazione" (non piu rilevante con il nuovo sistema).

In `src/hooks/useFilteredTransactions.ts`: aggiornare la logica per supportare il filtro combinato `none+suggested` per "Non riconciliati".

## 7. Ricalcolo su modifica

- `useUpdateTransaction`: dopo update, ricalcola suggestions per quella transazione
- `useDeleteTransaction`: dopo delete, rimuovi suggestions collegate
- `useCreateTransaction`: dopo insert, ricalcola per la nuova transazione

## Sequenza implementazione

1. Migrazione DB: creare tabella `reconciliation_suggestions`
2. Migrazione DB: aggiornare valori di `reconciliation_status` (convertire `partial`/`complete` in `reconciled`)
3. Creare `src/hooks/useReconciliationSuggestions.ts` con logica di scoring e mutations
4. Aggiornare `src/hooks/useImportTransactions.ts` per auto-generare suggestions dopo import
5. Aggiornare `src/hooks/useReconciliation.ts` per il nuovo flusso accetta/rifiuta
6. Aggiornare `src/components/ReconciliationSheet.tsx` con nuova UI proposte
7. Aggiornare `src/pages/Transactions.tsx` con nuovi stati pallino
8. Aggiornare `src/components/TransactionFilters.tsx` e `src/hooks/useFilteredTransactions.ts` con nuovi filtri
9. Aggiornare `src/hooks/useTransactions.ts` per ricalcolo su create/update/delete
10. Aggiornare `src/integrations/supabase/types.ts` NON si tocca (generato automaticamente)

## File coinvolti

| File | Modifica |
|------|----------|
| Migrazione SQL | Nuova tabella + update status values |
| `src/hooks/useReconciliationSuggestions.ts` | **NUOVO** - logica scoring + mutations |
| `src/hooks/useImportTransactions.ts` | Auto-genera suggestions post-import |
| `src/hooks/useReconciliation.ts` | Semplifica: accetta/rifiuta/rimuovi |
| `src/hooks/useTransactions.ts` | Trigger ricalcolo su CRUD |
| `src/components/ReconciliationSheet.tsx` | Nuova UI con proposte ordinate per score |
| `src/pages/Transactions.tsx` | Pallini semplificati (spento/attivo/check) |
| `src/components/TransactionFilters.tsx` | Filtri aggiornati |
| `src/hooks/useFilteredTransactions.ts` | Supporto filtro "non riconciliati" combinato |

