
Obiettivo: rendere il pallino “Ric.” completamente deterministico e allineato alla state machine ufficiale, con verifica esplicita UI ↔ DB sul caso POSTAGIRO.

Stato attuale verificato (audit rapido)
- In `Transactions.tsx` il colore del pallino è già deciso da `reconciliation_status`:
  - `reconciled` → `CircleCheck` verde
  - `suggested` → `CircleDot` rosso
  - altrimenti → `Circle` grigio
- Quindi il renderer del pallino non usa direttamente `count(suggestions)`.
- In `useReconciliationSuggestions.ts`:
  - generazione proposte imposta solo `suggested`/`none`, non `reconciled`
  - accettazione imposta `reconciled`
  - dismiss imposta `none` solo per la transazione aperta nel pannello
- Query DB eseguite:
  - mismatch globali `suggested` senza suggestion attive: 0
  - mismatch globali `none` con suggestion attive: 0
- Tuttavia esiste ancora rischio di drift logico in alcuni flussi (soprattutto aggiornamenti parziali tra transazione corrente e controparte), che può creare percezione di incoerenza.

Implementazione proposta (definitiva)

1) Centralizzare la sincronizzazione stato da suggestion attive
- Creare una funzione unica (nello stesso hook) tipo `syncReconciliationStatusForTransactions(transactionIds)`.
- Regola unica:
  - se `reconciliation_status = reconciled` → non toccare
  - se esiste almeno una suggestion attiva (source o candidate) → `suggested`
  - se non esistono suggestion attive → `none`
- Questa funzione diventa “single source of truth” per lo stato non riconciliato.

2) Applicare la sync in tutti i punti di mutazione suggestion
- `generateSuggestionsForIds`:
  - mantiene logica attuale di calcolo + preservazione dismissed
  - dopo delete/insert chiama sync sugli ID coinvolti (source + candidate)
- `useDismissSuggestion`:
  - prima di `dismissed=true`, leggere la suggestion per ricavare `source_transaction_id` e `candidate_transaction_id`
  - dopo dismiss, chiamare sync su entrambe le transazioni (non solo quella aperta)
  - evita stati rossi residui sulla controparte
- `useAcceptSuggestion`:
  - resta invariato nel principio: solo qui si imposta `reconciled`
  - dopo accept si continua a invalidare query come ora

3) Rinforzare il vincolo UI: pallino guidato solo da status
- In `Transactions.tsx` mantenere il renderer attuale basato solo su `reconciliation_status`.
- Aggiungere un helper locale esplicito (es. `getRicIndicator(status)`) per evitare regressioni future e rendere il mapping auto-documentato.
- Vietare fallback basati su suggestion count, flag locali o loading.

4) Logging temporaneo mirato (debug POSTAGIRO 24/02)
- Aggiungere logging opzionale (guardato da flag, es. costante `RIC_DEBUG=true` o query param dedicato), non permanente rumoroso.
- Per ID target (`b13f8ccc...` e `3d134d53...`) loggare:
  - stato letto da DB in hook query (`reconciliation_status`)
  - numero suggestion attive collegate (source/candidate)
  - valore usato dal renderer UI per scegliere icona/colore
- Log in 2 punti:
  - dentro hook di sincronizzazione stato
  - nel render della riga Transazioni (solo per ID target)

5) Verifica tecnica post-fix (checklist deterministica)
- Caso A: nessuna suggestion
  - DB: `none`
  - UI: pallino vuoto
- Caso B: suggestion presenti non accettate
  - DB: `suggested`
  - UI: pallino rosso pieno
- Caso C: accettazione proposta
  - DB: `reconciled` su entrambe (internal transfer)
  - UI: spunta
- Caso D: rifiuto totale proposte
  - DB: `none` per transazione e controparte quando non hanno più suggestion attive
  - UI: pallino vuoto
- Caso E: ricalcolo
  - suggestion dismissed non ricompaiono
  - nessun passaggio implicito a `reconciled`

6) Nota tecnica importante (prevenzione ambiguità futura)
- Esiste hook legacy `useReconcile` che usa stati `partial/complete` (non parte della nuova state machine).
- Anche se oggi non risulta usato, va messo in sicurezza in un secondo step:
  - o deprecato/rimosso
  - o riallineato ai soli stati `none/suggested/reconciled`
- Questo evita reintroduzione di stati visivi non previsti.

File coinvolti nel piano
- `src/hooks/useReconciliationSuggestions.ts`
  - aggiunta sync centralizzata
  - chiamate sync dopo generate/dismiss
  - logging temporaneo debug
- `src/pages/Transactions.tsx`
  - helper esplicito mapping stato→icona
  - logging temporaneo mirato su transazioni POSTAGIRO

Risultato atteso finale
- State machine deterministica e unica:
  - `none` → pallino vuoto
  - `suggested` → pallino rosso
  - `reconciled` → spunta
- Nessuna riconciliazione automatica.
- Nessun criterio UI implicito oltre `reconciliation_status`.
- Allineamento verificabile UI ↔ DB con log tecnici temporanei sul caso reale.
