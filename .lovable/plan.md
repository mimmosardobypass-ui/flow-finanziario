

# Gestione Multi-Conto in Flow Finanziario

## Panoramica

Aggiungere il supporto per piu conti bancari/finanziari. Ogni transazione sara associata obbligatoriamente a un conto. Le transazioni esistenti verranno migrate a un conto predefinito "Conto Principale" creato automaticamente.

---

## 1. Migrazione Database

### Nuova tabella `conti`

```text
conti
  id            uuid     PK, default gen_random_uuid()
  user_id       uuid     NOT NULL (ref auth.users)
  nome_conto    text     NOT NULL
  banca         text
  saldo_iniziale numeric NOT NULL DEFAULT 0
  attivo        boolean  NOT NULL DEFAULT true
  created_at    timestamptz NOT NULL DEFAULT now()
```

RLS policies: SELECT, INSERT, UPDATE, DELETE con `auth.uid() = user_id`.

### Modifica tabella `transactions`

- Aggiungere colonna `conto_id uuid` nullable inizialmente
- Creare un conto "Conto Principale" per ogni utente che ha transazioni esistenti (tramite SQL)
- Aggiornare le transazioni esistenti con il conto_id del conto predefinito
- Rendere `conto_id` NOT NULL dopo la migrazione
- Aggiungere foreign key verso `conti(id)`

La migrazione SQL fara tutto in un unico step:
1. Crea la tabella `conti` con RLS
2. Aggiunge `conto_id` nullable a `transactions`
3. Inserisce un "Conto Principale" per ogni utente che ha transazioni
4. Aggiorna tutte le transazioni esistenti con il rispettivo conto
5. Rende `conto_id` NOT NULL

---

## 2. Nuovi file da creare

### `src/hooks/useConti.ts`
Hook con:
- `useConti()`: query per ottenere tutti i conti dell'utente (ordinati per nome)
- `useContiAttivi()`: query filtrata solo conti attivi
- `useCreateConto()`: mutation per creare un nuovo conto
- `useUpdateConto()`: mutation per modificare nome, banca, saldo_iniziale
- `useToggleContaAttivo()`: mutation per attivare/disattivare un conto

### `src/pages/Conti.tsx`
Pagina di gestione conti con:
- Lista dei conti in card con nome, banca, saldo iniziale, stato attivo/inattivo
- Pulsante "Nuovo Conto"
- Azioni per modifica e disattivazione su ogni conto
- Badge visivo per conti attivi/inattivi

### `src/components/ContoDialog.tsx`
Dialog per creare/modificare un conto con campi:
- Nome conto (obbligatorio, placeholder "Es. Conto Corrente")
- Banca (opzionale, placeholder "Es. Intesa Sanpaolo")
- Saldo iniziale (numerico, default 0)
- Switch attivo/inattivo (solo in modifica)

---

## 3. File da modificare

### `src/integrations/supabase/types.ts`
Non modificabile direttamente - si aggiornera automaticamente dopo la migrazione.

### `src/hooks/useTransactions.ts`
- Aggiungere `conto_id` a `Transaction`, `TransactionWithCategory`, `CreateTransactionInput`, `UpdateTransactionInput`
- Includere `conti (id, nome_conto, banca)` nella query select
- Passare `conto_id` nelle operazioni di insert e update

### `src/hooks/useFilteredTransactions.ts`
- Aggiungere `contoId?: string` a `TransactionFilters`
- Applicare filtro server-side `.eq("conto_id", filters.contoId)` quando presente

### `src/components/TransactionDialog.tsx`
- Aggiungere select "Seleziona conto" (obbligatorio) con i conti attivi dell'utente
- Pre-selezionare il conto se ce n'e uno solo
- In modifica, mostrare il conto attuale

### `src/components/TransactionFilters.tsx`
- Aggiungere select filtro conto tra i filtri esistenti: "Tutti i conti" + elenco conti attivi
- Includere il filtro nel conteggio filtri attivi e nei badge

### `src/pages/Transactions.tsx`
- Quando un conto e selezionato, mostrare il saldo calcolato del conto (saldo_iniziale + entrate - uscite di quel conto)
- Quando "Tutti i conti", mostrare il saldo aggregato come gia fatto

### `src/hooks/useImportTransactions.ts`
- Aggiungere `conto_id` obbligatorio ai parametri della mutation
- Passare il conto_id in ogni riga inserita

### `src/components/ImportTransactionsDialog.tsx`
- Aggiungere select per scegliere il conto destinazione prima dell'importazione

### `src/components/AppSidebar.tsx`
- Aggiungere voce menu "Conti" con icona `Landmark` da lucide-react, dopo "Categorie"

### `src/App.tsx`
- Aggiungere route `/conti` protetta con la pagina `Conti`

---

## 4. Calcolo saldo conto

Il saldo di un conto si calcola come:
```text
saldo = saldo_iniziale + SUM(entrate del conto) - SUM(uscite del conto)
```

Questo calcolo viene fatto lato client a partire dalle transazioni gia caricate, senza query aggiuntive.

---

## 5. Compatibilita con transazioni esistenti

- Le transazioni gia esistenti vengono automaticamente assegnate a un "Conto Principale" durante la migrazione
- Nessuna transazione viene persa
- Il conto predefinito e modificabile e rinominabile dall'utente
- L'importazione richiede la selezione esplicita di un conto

---

## 6. Riepilogo file

| File | Azione |
|------|--------|
| Migrazione SQL | Creare tabella `conti`, aggiungere `conto_id` a `transactions`, migrare dati |
| `src/hooks/useConti.ts` | Creare |
| `src/pages/Conti.tsx` | Creare |
| `src/components/ContoDialog.tsx` | Creare |
| `src/hooks/useTransactions.ts` | Modificare (aggiungere conto_id) |
| `src/hooks/useFilteredTransactions.ts` | Modificare (filtro per conto) |
| `src/components/TransactionDialog.tsx` | Modificare (select conto) |
| `src/components/TransactionFilters.tsx` | Modificare (filtro conto) |
| `src/pages/Transactions.tsx` | Modificare (saldo per conto) |
| `src/hooks/useImportTransactions.ts` | Modificare (conto_id) |
| `src/components/ImportTransactionsDialog.tsx` | Modificare (select conto) |
| `src/components/AppSidebar.tsx` | Modificare (voce menu) |
| `src/App.tsx` | Modificare (route) |

