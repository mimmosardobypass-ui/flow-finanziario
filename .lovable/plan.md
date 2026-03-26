

# Importazione PDF estratto conto Banca Sella

## Obiettivo

Aggiungere il supporto per importare transazioni da PDF di estratto conto Banca Sella nella pagina `/import-transazioni`. Il PDF verra' parsato lato client con `pdfjs-dist`, estraendo: **Data operazione**, **Descrizione** e **Importo** (ignorando Codice Identificativo, Data Valuta, Divisa e Note).

## Struttura rilevata dal PDF Sella

```text
Codice ID | Data Op. | Data Valuta | Descrizione | Divisa | Importo | Note
(ignora)  | dd/MM/yy | (ignora)    | testo       | (EUR)  | -1.234,56 | (ignora)
```

Il parser cercara' le righe con pattern: codice numerico lungo, seguito da due date dd/MM/yyyy, descrizione, "EUR", importo con virgola decimale e segno.

## Modifiche previste

### 1. `package.json`
- Aggiungere `pdfjs-dist` come dipendenza

### 2. `src/utils/parseSellaPdf.ts` (nuovo file)
- Funzione `parseSellaPdf(arrayBuffer): ParsedRow[]`
- Usa `pdfjs-dist` per estrarre il testo pagina per pagina
- Per ogni riga di testo, identifica il pattern Banca Sella:
  - Codice numerico lungo (14+ cifre) → segna inizio nuova transazione
  - Prima data dd/MM/yyyy → data operazione
  - Seconda data → ignorata (data valuta)
  - Testo tra la seconda data e "EUR" → descrizione
  - Numero dopo "EUR" → importo (formato italiano con virgola)
- Gestisce descrizioni multilinea concatenando righe successive senza codice
- Restituisce lo stesso formato `ParsedRow[]` gia' usato per Excel/CSV

### 3. `src/pages/ImportTransazioni.tsx`
- Accettare `.pdf` nel file input (`accept=".xlsx,.csv,.pdf"`)
- Aggiornare validazione formato per includere `application/pdf` e estensione `.pdf`
- Se il file e' PDF, usare `parseSellaPdf()` invece di `parseWorkbook()`
- Aggiornare il testo della drop zone: "Formati supportati: .xlsx, .csv, .pdf"

Tutto il resto (anteprima tabella, selezione righe, importazione) funziona identico perche' il formato dati e' lo stesso `ParsedRow[]`.

## File coinvolti

| File | Modifica |
|------|----------|
| `package.json` | Aggiungere `pdfjs-dist` |
| `src/utils/parseSellaPdf.ts` | Nuovo - parser PDF Banca Sella |
| `src/pages/ImportTransazioni.tsx` | Accettare PDF e chiamare il parser |

