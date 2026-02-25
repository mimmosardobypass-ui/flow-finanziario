

# Pagina Dedicata per Importazione Transazioni

## Panoramica

Trasformare l'importazione da dialog modale a una pagina full-screen dedicata (`/import-transazioni`) con layout tipo foglio Excel: header fisso, tabella centrale scrollabile e footer fisso.

---

## File da creare

### `src/pages/ImportTransazioni.tsx`

Nuova pagina che riprende tutta la logica esistente da `ImportTransactionsDialog.tsx` ma con layout full-page:

**Layout struttura:**
```text
+----------------------------------------------------------+
| HEADER FISSO                                              |
| [Selezione conto] [Upload file] [Info file]               |
| [Righe selezionate: X/Y]  [Totale: +X / -Y]             |
| [Ricerca per descrizione]                                 |
+----------------------------------------------------------+
| TABELLA ANTEPRIMA (flex-1, overflow-y-auto)               |
| [x] Data Contabile | Descrizione          | Importo      |
| [x] 01/01/2026     | Pagamento XYZ        | -50.00       |
| [ ] 02/01/2026     | Accredito stipendio  | +1500.00     |
| ...                                                       |
+----------------------------------------------------------+
| FOOTER FISSO                                              |
| [Annulla / Torna indietro]        [Conferma Importazione] |
+----------------------------------------------------------+
```

**Dettagli implementazione:**

- Container con `h-screen flex flex-col` per occupare tutto lo schermo
- Header: `shrink-0` con selezione conto, area upload (drag-and-drop), info file caricato, campo ricerca descrizione, contatore righe e totali importi
- Area centrale: `flex-1 overflow-y-auto` con tabella HTML nativa (una sola scrollbar verticale, niente ScrollArea wrapper)
- Footer: `shrink-0` con pulsanti azione
- La pagina NON usa il componente `Layout` (sidebar) per massimizzare lo spazio

**Colonne tabella:**
- Checkbox (seleziona/deseleziona)
- Data (Data Contabile, formattata dd/MM/yyyy)
- Descrizione (colonna larga, `min-w-[300px]`)
- Importo (colorato verde/rosso)
- Stato riga (icona errore se data o importo non validi)

**Righe con errori:**
- Se `tryParseDate` o `tryParseAmount` falliscono, la riga mostra un'icona di errore e la checkbox e disabilitata
- La riga appare con opacita ridotta e non puo essere selezionata

**Ricerca veloce:**
- Input di ricerca nell'header che filtra le righe visibili per descrizione (filtro client-side sul campo mappato)

**Totali dinamici nell'header:**
- Somma importi positivi (entrate) e negativi (uscite) delle sole righe selezionate

**Flusso pagina:**
1. L'utente arriva sulla pagina e vede l'area upload + selezione conto
2. Carica il file -> auto-mapping colonne + mostra tabella anteprima
3. Puo cercare, selezionare/deselezionare righe
4. Clicca "Conferma Importazione"
5. Redirect a `/transactions` con toast "Importate X transazioni, escluse Y"

---

## File da modificare

### `src/App.tsx`

- Aggiungere rotta `/import-transazioni` che punta a `ImportTransazioni`
- La rotta usa `ProtectedRoute` ma **senza** `Layout` (pagina full-screen)

### `src/pages/Transactions.tsx`

- Cambiare il pulsante "Importa" da aprire il dialog a navigare verso `/import-transazioni` con `useNavigate`
- Rimuovere lo stato `importDialogOpen` e il componente `ImportTransactionsDialog`

---

## File NON modificati

- `src/components/ImportTransactionsDialog.tsx` - Resta nel progetto come riferimento ma non viene piu usato dalla pagina Transactions
- `src/hooks/useImportTransactions.ts` - La logica backend resta identica

---

## Riepilogo file

| File | Azione |
|------|--------|
| `src/pages/ImportTransazioni.tsx` | Nuovo - pagina full-screen |
| `src/App.tsx` | Modifica - aggiunta rotta |
| `src/pages/Transactions.tsx` | Modifica - navigazione invece di dialog |

