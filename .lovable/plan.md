
# Fix: Assegnare "Giroconti" alle riconciliazioni esistenti

## Problema

Le due transazioni gia' riconciliate come "transfer" hanno la categoria "Da classificare" (non NULL). La logica attuale controlla solo `category_id IS NULL`, quindi non le ha aggiornate.

## Modifiche

### 1. Helper riutilizzabile (`src/hooks/useReconciliation.ts`)

Estrarre una funzione `getOrCreateGirocontiCategory(userId)` che cerca o crea la categoria "Giroconti", per evitare duplicazione.

### 2. Migliorare auto-categorizzazione in `useReconcile`

Nella sezione auto-assign, invece di controllare solo `category_id IS NULL`, anche sostituire le categorie "Da classificare":

- Cercare tutte le categorie "Da classificare" dell'utente
- Aggiornare le transazioni che hanno `category_id = null` OPPURE `category_id` corrispondente a "Da classificare"

### 3. Aggiungere hook `useFixExistingGiroconti`

Creare un nuovo hook che viene chiamato una volta per sessione (ad esempio nella pagina Transazioni o nel Layout) per correggere retroattivamente le transazioni gia' riconciliate:

- Cerca transazioni con `reconciliation_type = 'transfer'` e `reconciliation_status = 'reconciled'`
- Identifica quelle con categoria "Da classificare" o senza categoria
- Assegna automaticamente la categoria "Giroconti"
- Usa un flag `sessionStorage` per evitare esecuzioni ripetute

### File coinvolti

1. `src/hooks/useReconciliation.ts` - helper + miglioramento logica useReconcile
2. `src/hooks/useFixExistingGiroconti.ts` - nuovo hook per fix retroattivo
3. `src/components/Layout.tsx` - chiamata al hook di fix
