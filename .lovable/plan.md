
## Problema reale individuato

Dallo screen e dal codice, l’errore non è solo “il parser non legge bene il PDF”: ci sono 3 difetti strutturali nella logica attuale.

1. `detectColumnRanges()` calcola intervalli X, ma `classifyFragment()` usa solo la soglia iniziale delle colonne e ignora il limite destro.
   - Esempio dai log:
     - `dataOp: [100, 200]`
     - `dataVal: [144, 265]`
   - Questi range si sovrappongono e la classificazione attuale può spostare frammenti nella colonna sbagliata.

2. La descrizione nei PDF Sella spesso va su più righe e non resta sempre tutta dentro un unico range X.
   - Alcuni pezzi finiscono più a sinistra del previsto e vengono letti come `codice` o `dataOp/dataVal`.
   - Risultato: anteprima con data/importo ma descrizione vuota.

3. Il parser costruisce i blocchi transazione in modo troppo “piatto”.
   - Raccoglie tutti i frammenti in sequenza globale.
   - Non ricostruisce bene le righe visive interne del blocco.
   - Se una descrizione continua sulla riga sotto, oggi può perdersi o essere misclassificata.

## Soluzione definitiva

### 1. Riscrivere il parser in 2 fasi
Nel file `src/utils/parseSellaPdf.ts`:

**Fase A – rilevazione struttura**
- leggere i frammenti pagina per pagina
- individuare la riga header
- calcolare veri range colonna non sovrapposti
- usare sia `startX` sia `endX` per classificare i frammenti

**Fase B – parsing transazioni**
- usare il codice numerico lungo solo come delimitatore tecnico
- creare un blocco per ogni movimento
- dentro ogni blocco raggruppare i frammenti per righe visive con tolleranza Y
- ricostruire:
  - data operazione
  - descrizione multilinea
  - importo con segno

### 2. Correggere la classificazione colonne
Sostituire la logica attuale:
- da “se `x >= start` allora appartiene a quella colonna”
- a “appartiene alla colonna se `x` cade nel range `[start, end)`”

Questo evita che:
- `data operazione` finisca in `data valuta`
- pezzi descrizione finiscano nella colonna sbagliata
- importi/date rubino testo alla descrizione

### 3. Gestire descrizioni multilinea in modo robusto
Per ogni blocco transazione:
- ordinare i frammenti per riga visiva e poi per X
- considerare descrizione valida anche se parte del testo cade leggermente fuori dal range “descrizione”
- permettere una tolleranza controllata per le continuation lines
- rimuovere solo rumore reale:
  - header tabella
  - `EUR`
  - `Pagina`
  - `Saldo`
  - intestazioni/footer

### 4. Ricostruire correttamente il segno dell’importo
Migliorare l’estrazione dell’importo per supportare:
- `-617,92`
- `+31,70`
- `- 32.500,00`

Il parser dovrà:
- unire i frammenti della colonna importo
- leggere il segno anche se separato dal numero
- ignorare `EUR`
- validare il numero prima di accettarlo

### 5. Rendere il fallback più sicuro
Se il parser non riesce a identificare in modo affidabile colonne/blocchi:
- non deve importare “alla cieca”
- deve scartare le righe ambigue invece di produrre righe con descrizione vuota

Per un estratto conto è meglio perdere una riga dubbia che importarla male.

### 6. Rafforzare la preview di importazione
Nel file `src/pages/ImportTransazioni.tsx`:
- mantenere l’errore su righe senza descrizione
- aggiungere controlli più severi per PDF:
  - descrizione vuota
  - descrizione composta solo da date/sigle/header
  - importo nullo o incoerente
- impedire la selezione delle righe sospette

## File da modificare

| File | Intervento |
|------|------------|
| `src/utils/parseSellaPdf.ts` | Riscrittura parser: range reali, blocchi transazione, righe visive interne, importi con segno, fallback sicuro |
| `src/pages/ImportTransazioni.tsx` | Validazione preview più severa per PDF e blocco righe dubbie |

## Esito atteso

Dopo questa correzione:
- le descrizioni non dovrebbero più sparire
- i segni `+` e `-` verranno letti correttamente
- la preview mostrerà solo righe affidabili
- non sarà necessario cancellare nulla adesso se l’importazione non è stata confermata

## Nota pratica
Dallo screen risulta che eri ancora nella preview di importazione, quindi i movimenti non sembrano ancora salvati. La correzione va fatta prima di riprovare l’import definitivo.
