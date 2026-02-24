

# Importazione Transazioni da File Excel/CSV

## Panoramica

Aggiungere un pulsante "Importa file" nella pagina Transazioni che permette di caricare file Excel (.xlsx) o CSV, visualizzare un'anteprima, mappare le colonne e importare le transazioni con categoria "Da classificare".

---

## 1. Categoria "Da classificare"

Prima dell'importazione, il sistema verifica se esiste gia una categoria "Da classificare" per l'utente (sia income che expense). Se non esiste, la crea automaticamente. Servono due categorie: una di tipo "income" e una di tipo "expense", per rispettare il vincolo che ogni transazione ha una categoria del tipo corretto.

---

## 2. Nuovo componente: ImportDialog

### File: `src/components/ImportTransactionsDialog.tsx`

Dialog multi-step con 3 fasi:

### Step 1 - Upload
- Area drag & drop + pulsante "Seleziona file"
- Accetta `.xlsx` e `.csv`
- Parsing con libreria `xlsx` (gia installata)
- Gestione errori: file corrotto, vuoto, formato non supportato
- Mostra messaggio chiaro in caso di errore senza bloccare l'interfaccia

### Step 2 - Anteprima e Mappatura
- Mostra anteprima delle prime 5-10 righe in una tabella
- 3 select per mappare le colonne del file ai campi:
  - **Data** (obbligatorio)
  - **Descrizione** (obbligatorio)
  - **Importo** (obbligatorio)
- Le opzioni delle select sono i nomi delle colonne rilevate dal file
- Tentativo di auto-mappatura iniziale basato su nomi colonne comuni (es. "data", "date", "descrizione", "description", "importo", "amount")
- Validazione: tutte e 3 le colonne devono essere mappate

### Step 3 - Risultato
- Mostra "X transazioni importate con successo"
- Pulsante "Vai a classificare" che naviga a `/transactions?categoryId=<id_da_classificare>`
- Pulsante "Chiudi"

### Logica di salvataggio
- Per ogni riga valida:
  - Parsing della data (supporto formati: dd/MM/yyyy, yyyy-MM-dd, MM/dd/yyyy)
  - Se importo > 0: type = "income", category = "Da classificare" (income)
  - Se importo < 0: type = "expense", amount = valore assoluto, category = "Da classificare" (expense)
  - Righe con data o importo non validi vengono saltate
- INSERT bulk tramite Supabase (batch di max 100 righe per chiamata)
- Mostra conteggio righe importate e righe saltate

---

## 3. Modifiche alla pagina Transazioni

### File: `src/pages/Transactions.tsx`

- Aggiungere pulsante "Importa" nell'header accanto a "Nuova Transazione" e "Esporta"
- Icona: `Upload` da lucide-react
- Stato `importDialogOpen` per controllare il dialog

---

## 4. Hook per importazione

### File: `src/hooks/useImportTransactions.ts`

- `useEnsureClassificationCategory()`: query + mutation che trova o crea le categorie "Da classificare" (income + expense)
- `useImportTransactions()`: mutation che riceve un array di transazioni parsate e le inserisce in batch nel DB

---

## 5. File da creare/modificare

| File | Azione | Descrizione |
|------|--------|-------------|
| `src/components/ImportTransactionsDialog.tsx` | Creare | Dialog multi-step con upload, anteprima, mappatura, risultato |
| `src/hooks/useImportTransactions.ts` | Creare | Hook per gestione categorie "Da classificare" e bulk insert |
| `src/pages/Transactions.tsx` | Modificare | Aggiungere pulsante "Importa" e stato dialog |

---

## 6. Dettagli tecnici

- **Parsing file**: usa `XLSX.read()` con `type: "array"` per leggere il file, poi `XLSX.utils.sheet_to_json()` per ottenere righe JSON
- **Formati data supportati**: il parser provera `date-fns/parse` con i pattern piu comuni (dd/MM/yyyy, yyyy-MM-dd, dd-MM-yyyy, MM/dd/yyyy)
- **Batch insert**: divide l'array in chunk da 100 e fa INSERT sequenziali per evitare timeout
- **Gestione errori**: ogni errore (file, parsing, DB) viene catturato e mostrato con toast, senza bloccare l'interfaccia
- **Nessuna dipendenza aggiuntiva**: usa `xlsx` gia installato e `date-fns` gia presente

