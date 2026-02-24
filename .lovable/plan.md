

# Piano: Scadenziario con Rate e Collegamento Transazioni

## Panoramica

Aggiungere una nuova sezione "Scadenziario" per gestire contratti con rate (finanziamenti, abbonamenti, assicurazioni), con collegamento bidirezionale alle transazioni per tracciare i pagamenti.

---

## 1. Database: Nuove Tabelle

### Tabella `scadenziario` (contratti)

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | NOT NULL |
| numero_contratto | text | NOT NULL |
| societa_finanziaria | text | NOT NULL |
| tipo | text | NOT NULL (finanziamento, abbonamento, assicurazione, altro) |
| importo_totale | numeric | NOT NULL |
| numero_rate | integer | NOT NULL |
| data_prima_scadenza | date | NOT NULL |
| modalita_importo | text | NOT NULL (automatico, manuale) |
| created_at | timestamptz | default now() |

### Tabella `scadenze_rate` (singole rate)

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK, default gen_random_uuid() |
| scadenziario_id | uuid | FK -> scadenziario.id, ON DELETE CASCADE |
| user_id | uuid | NOT NULL |
| numero_rata | integer | NOT NULL |
| importo | numeric | nullable (manuale puo essere vuoto inizialmente) |
| data_scadenza | date | nullable (manuale puo essere vuoto inizialmente) |
| stato | text | NOT NULL, default 'non_pagata' |
| transaction_id | uuid | nullable, FK -> transactions.id |
| created_at | timestamptz | default now() |

### Modifica tabella `transactions`

Aggiungere colonna:
- `rata_id` uuid, nullable, FK -> scadenze_rate.id

### RLS Policies

Tutte le tabelle avranno le stesse 4 policy (SELECT, INSERT, UPDATE, DELETE) basate su `auth.uid() = user_id`, coerenti con le tabelle esistenti.

---

## 2. Struttura File Frontend

```text
src/
  pages/
    Scadenziario.tsx              -- Pagina principale con lista contratti
  components/
    scadenziario/
      ScadenziarioDialog.tsx      -- Dialog creazione/modifica contratto + rate
      RateTable.tsx               -- Tabella rate dentro il dialog
      RataEditRow.tsx             -- Singola riga rata editabile
  hooks/
    useScadenziario.ts            -- Query + mutations per contratti e rate
```

---

## 3. Flusso Creazione Contratto

1. L'utente clicca "Nuovo Contratto" nella pagina Scadenziario
2. Compila: numero contratto, societa, tipo, importo totale, numero rate, data prima scadenza
3. Sceglie modalita: **Automatico** o **Manuale**

### Modalita Automatico
- L'importo viene diviso equamente per il numero di rate
- Le date vengono generate mese per mese dalla data prima scadenza
- Le righe appaiono precompilate ma modificabili prima del salvataggio

### Modalita Manuale
- Vengono generate N righe vuote con solo il numero rata precompilato
- L'utente compila importo e data per ogni riga

4. Al salvataggio:
   - INSERT nella tabella `scadenziario`
   - INSERT bulk nella tabella `scadenze_rate` con il `scadenziario_id` ottenuto

---

## 4. Pagina Scadenziario

### Vista Lista
- Tabella con colonne: Numero Contratto, Societa, Tipo, Importo Totale, Rate Pagate/Totali, Stato
- Badge colorati per lo stato (tutte pagate = verde, in corso = giallo, scadute = rosso)
- Cliccando su un contratto si apre il dettaglio con la tabella rate

### Vista Dettaglio Rate
- Tabella con: Numero Rata, Importo, Data Scadenza, Stato, Transazione Collegata
- Pulsante modifica per ogni riga
- Le rate gia pagate mostrano il link alla transazione

---

## 5. Collegamento Transazioni - Scadenze

### Nel TransactionDialog
- Aggiungere un campo opzionale "Collega a scadenza" (checkbox o toggle)
- Se attivato, mostrare due select a cascata:
  1. Seleziona contratto (lista contratti con rate non pagate)
  2. Seleziona rata (rate non pagate del contratto scelto)
- Al salvataggio della transazione:
  1. Salvare la transazione con `rata_id` valorizzato
  2. Aggiornare la rata: `stato = 'pagata'`, `transaction_id = <id transazione>`

### Tipi aggiornati
- `Transaction` e `TransactionWithCategory` avranno il campo opzionale `rata_id`
- `CreateTransactionInput` avra `rata_id?: string`

---

## 6. Navigazione

### AppSidebar.tsx
Aggiungere voce menu dopo "Categorie":
```text
Dashboard
Transazioni
Categorie
Scadenziario  <-- NUOVO
```
Icona: `CalendarClock` da lucide-react

### App.tsx
Aggiungere route `/scadenziario` con ProtectedRoute + Layout

---

## 7. File da Creare/Modificare

| File | Azione | Descrizione |
|------|--------|-------------|
| Migrazione SQL | Creare | Tabelle scadenziario, scadenze_rate + colonna rata_id su transactions + RLS |
| `src/pages/Scadenziario.tsx` | Creare | Pagina lista contratti + dettaglio rate |
| `src/components/scadenziario/ScadenziarioDialog.tsx` | Creare | Dialog creazione/modifica contratto con rate |
| `src/components/scadenziario/RateTable.tsx` | Creare | Tabella rate editabile |
| `src/hooks/useScadenziario.ts` | Creare | Hook con query e mutations |
| `src/components/AppSidebar.tsx` | Modificare | Aggiungere voce menu |
| `src/App.tsx` | Modificare | Aggiungere route |
| `src/components/TransactionDialog.tsx` | Modificare | Aggiungere campo collegamento scadenza |
| `src/hooks/useTransactions.ts` | Modificare | Aggiungere rata_id ai tipi e mutations |

---

## 8. Dettagli UX

- **Validazione**: importo totale > 0, numero rate >= 1, data obbligatoria
- **Rate modificabili**: anche dopo il salvataggio, le rate non pagate possono essere modificate (importo, data)
- **Responsive**: su mobile la tabella rate si adatta con scroll orizzontale
- **Badge stato rata**: "Non pagata" (grigio), "Pagata" (verde), "Scaduta" (rosso, se data < oggi e non pagata)

