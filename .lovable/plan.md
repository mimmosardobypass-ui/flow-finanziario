
## Analisi profonda del problema

La logica attuale in `src/utils/parseSellaPdf.ts` non è ancora affidabile per un estratto conto Sella reale. I punti deboli principali sono:

1. **Raggruppamento per righe troppo fragile**
   - `groupIntoRows(..., 4)` unisce i frammenti solo per vicinanza Y.
   - Nei PDF Sella una singola operazione può occupare **più righe visive**: descrizione su una riga, importo su quella sotto, date leggermente sfalsate.
   - Risultato: descrizioni vuote o spezzate, importi associati alla riga sbagliata.

2. **Classificazione colonne troppo approssimativa**
   - `classifyColumn()` sceglie la colonna “più vicina a sinistra”.
   - Se le coordinate cambiano leggermente, una `data valuta`, `EUR` o parte descrizione finisce nella colonna sbagliata.
   - Questo spiega valori come descrizioni che diventano date o testo di intestazione.

3. **Costruzione importo non robusta**
   - I frammenti dell’importo vengono concatenati “alla cieca”.
   - Se segno, valuta e numero sono separati in item PDF distinti, il parser può perdere `+`/`-` o produrre stringhe sporche.

4. **Fallback troppo permissivo**
   - Se il riconoscimento colonne non è perfetto, il fallback lineare può importare righe sbagliate anziché bloccarle.
   - Per un file bancario è meglio **scartare** una riga dubbia che importarla male.

5. **Validazione UI insufficiente**
   - In `ImportTransazioni.tsx` una riga è errore solo se manca `date` o `amount`.
   - Una riga con **descrizione vuota o palesemente corrotta** oggi può sembrare valida.

## Soluzione definitiva proposta

### 1. Riscrivere il parser come parser a “blocchi transazione”
Invece di partire dalle righe visive, il parser deve:

- leggere tutti i frammenti con coordinate `x/y`
- lavorare **pagina per pagina**
- trovare ogni inizio movimento tramite il **codice numerico lungo**
- raccogliere tutti i frammenti fino al codice successivo
- solo dopo classificare date, descrizione e importo dentro quel blocco

Questo è più stabile perché il codice identificativo resta utile come **delimitatore tecnico**, anche se non va importato.

### 2. Passare da “start X” a veri intervalli di colonna
Non basta sapere dove inizia una colonna: servono **range X**.

Esempio:
```text
codice      0 ── 120
data op   120 ── 210
data val  210 ── 300
descr     300 ── 640
divisa    640 ── 700
importo   700 ── end
```

Così:
- `data valuta` non finisce più nella descrizione
- `EUR` non finisce più nell’importo
- le descrizioni multilinea vengono ricostruite solo dai frammenti nel range descrizione

### 3. Ricostruzione robusta dell’importo con segno
Il parser dovrà:
- leggere tutti i frammenti nel range importo
- ricomporre segno e numero anche se separati
- ignorare `EUR`
- accettare formati come:
  - `-617,92`
  - `+31,70`
  - `- 32.500,00`

### 4. Descrizione pulita e filtraggio rumore
Aggiungere regole per:
- escludere header/footer (`Pagina`, `Saldo`, intestazioni tabella, note finali)
- rimuovere date duplicate dalla descrizione
- unire correttamente le continuation lines
- normalizzare spazi multipli

### 5. Modalità “strict” per l’import PDF
Per i PDF bancari conviene importare solo righe realmente affidabili.

Una riga PDF verrà considerata valida solo se ha:
- data operazione valida
- importo valido con segno
- descrizione non vuota e non composta solo da date/intestazioni

Le righe dubbie vanno:
- escluse automaticamente
- oppure mostrate come errore/non selezionabili

### 6. Rafforzare la preview in `ImportTransazioni.tsx`
Aggiornare la logica `hasError` per PDF includendo anche:
- descrizione vuota
- descrizione sospetta (`Identificativo`, `Saldo`, solo data, solo EUR, ecc.)
- importo nullo o non coerente

Così l’utente non rischia di importare movimenti corrotti.

## File da modificare

| File | Intervento |
|------|------------|
| `src/utils/parseSellaPdf.ts` | Riscrittura completa con parser a blocchi, colonne a range, importi con segno, filtro rumore |
| `src/pages/ImportTransazioni.tsx` | Validazione più severa per PDF e blocco righe senza descrizione affidabile |

## Esito atteso

Dopo questa correzione:
- le descrizioni non dovrebbero più sparire
- i segni `+` e `-` dovrebbero essere letti correttamente
- date e importi non dovrebbero più slittare di colonna
- eventuali righe ancora ambigue non verranno importate per errore

## Nota pratica sui movimenti
Dato che in questo momento hai **annullato** l’importazione, non serve cancellare nulla adesso. La cancellazione avrebbe senso solo se i movimenti fossero già stati salvati. La strada giusta è prima correggere il parser, poi riprovare l’import.
