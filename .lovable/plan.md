

# Gestione Trasferimenti tra Conti

## Panoramica

Aggiungere la possibilita di trasferire fondi tra conti direttamente dal form "Nuova Transazione". Un trasferimento genera automaticamente 2 o 3 movimenti collegati tramite un `transfer_id` comune, senza alterare il saldo complessivo.

---

## 1. Migrazione Database

Aggiungere una colonna `transfer_id` alla tabella `transactions`:

```text
transactions.transfer_id  uuid  NULLABLE  DEFAULT NULL
```

Questa colonna collega tra loro i movimenti generati da un singolo trasferimento. Le transazioni normali avranno `transfer_id = NULL`.

---

## 2. Logica del trasferimento

Alla conferma di un trasferimento con importo X e commissione C (opzionale):

| # | Tipo | Conto | Importo | Descrizione | Categoria |
|---|------|-------|---------|-------------|-----------|
| 1 | expense | Conto origine | X | "Trasferimento verso [dest]" | nessuna |
| 2 | income | Conto destinazione | X | "Trasferimento da [origine]" | nessuna |
| 3 | expense | Conto origine | C | "Commissione trasferimento" | "Commissioni" (auto-creata) |

Tutti i movimenti condividono lo stesso `transfer_id` (UUID generato lato client).

---

## 3. File da modificare

### `src/hooks/useTransactions.ts`
- Aggiungere `transfer_id` opzionale alle interfacce `Transaction` e `CreateTransactionInput`
- Creare un nuovo hook `useCreateTransfer()` che:
  - Genera un UUID come `transfer_id`
  - Cerca o crea la categoria "Commissioni" (tipo expense) se serve
  - Inserisce 2 o 3 righe in `transactions` in un'unica operazione
  - Invalida le query necessarie

### `src/components/TransactionDialog.tsx`
- Aggiungere "Trasferimento" come terza opzione nel RadioGroup del tipo (con icona `ArrowLeftRight`)
- Quando tipo = "transfer":
  - Nascondere il campo "Conto" singolo
  - Mostrare "Conto origine" (select tra conti attivi)
  - Mostrare "Conto destinazione" (select tra conti attivi, escludendo l'origine)
  - Mostrare campo "Commissione (opzionale)" numerico
  - Nascondere la sezione categoria (non pertinente)
  - Nascondere la sezione "Collega a scadenza"
  - Pre-compilare la descrizione con "Trasferimento"
- Alla conferma, chiamare `useCreateTransfer` invece di `useCreateTransaction`
- In modifica, i trasferimenti non sono modificabili dal dialog standard (troppo complesso)

### `src/pages/Transactions.tsx`
- Nella colonna "Importo", gestire la visualizzazione delle transazioni con `transfer_id`:
  - Mostrare un'icona o badge "Trasf." per identificare visivamente i trasferimenti
- Nessun impatto sul calcolo saldi (entrate e uscite si bilanciano gia)

---

## 4. Categoria "Commissioni"

La categoria "Commissioni" (tipo expense) viene cercata tra le categorie esistenti dell'utente. Se non esiste, viene creata automaticamente al momento del trasferimento con commissione. Questo evita di richiedere una migrazione dati.

---

## 5. Riepilogo file

| File | Azione |
|------|--------|
| Migrazione SQL | Aggiungere colonna `transfer_id` a `transactions` |
| `src/hooks/useTransactions.ts` | Aggiungere `transfer_id` alle interfacce, creare `useCreateTransfer()` |
| `src/components/TransactionDialog.tsx` | Aggiungere tipo "Trasferimento" con UI dedicata (origine, destinazione, commissione) |
| `src/pages/Transactions.tsx` | Badge visivo per transazioni di trasferimento |

