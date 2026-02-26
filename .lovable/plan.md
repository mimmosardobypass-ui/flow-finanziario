
Esito verifica tecnica completata sul caso POSTAGIRO del 24/02/2026.

1) Verifica DB sul caso specifico (backend vs UI)

- Ho identificato le 2 transazioni esatte:
  - `b13f8ccc-b41f-4300-b892-653f37b0613b` (conto `001068113388`, `income`, importo `100`, stato `none`)
  - `3d134d53-5bdc-4d15-84f0-5ac3e99c1d83` (conto `5333171194520975`, `expense`, importo `100`, stato `none`)
- Query su `reconciliation_suggestions` per questi ID: risultato vuoto.
- Query totale tabella `reconciliation_suggestions`: `0` righe totali, `0` attive.

Conclusione: il problema è lato generazione/popolamento backend (non è un problema “solo UI”).

2) Verifica regole richieste (bank↔bank, filtri, status, keyword)

Nel codice attuale (`src/hooks/useReconciliationSuggestions.ts`):

- Matching avviene sulla stessa tabella `transactions` (quindi bank↔bank è supportato).
- C’è vincolo `candidate.conto_id !== source.conto_id` (conti diversi).
- Finestra data ±10 giorni presente.
- Esclusione solo `reconciled` (quindi `none` entra correttamente).
- `postagiro` e `giroconto` sono incluse nelle keyword forti.
- Bonus `internal_transfer` è presente con:
  - tipo opposto (`income` vs `expense`)
  - stesso importo
  - keyword di trasferimento

Conferma tecnica sul vostro caso: tutte le condizioni risultano vere (importo uguale, segno opposto via `type`, stessa data, conti diversi, keyword presenti).

3) Causa radice individuata (perché non vedete proposte)

Il punto chiave non è la regola di matching, ma quando viene eseguita:

- Non esiste un worker/cron di backfill globale.
- La generazione viene chiamata solo in questi eventi:
  - import (`useImportTransactions`)
  - create/update transazione (`useTransactions`)
  - click manuale “Cerca proposte” nel `ReconciliationSheet`

Evidenza decisiva dai dati:
- Ultima transazione utente creata: `2026-02-26 00:10:51`
- Migrazione che crea `reconciliation_suggestions`: `2026-02-26 00:45:46`
- Transazioni create dopo quella migrazione: `0`

Quindi i movimenti del caso test sono nati prima che la tabella/procedura fosse disponibile e non è mai stato fatto un ricalcolo globale successivo. Per questo `reconciliation_suggestions` è rimasta vuota.

4) Risposta puntuale alle vostre richieste

- “Vengono creati record per quei due ID?” → No, zero record (verificato).
- “La query usa none/unreconciled?” → Ora la logica considera correttamente `none`; la migrazione `unreconciled -> none` è applicata.
- “Internal transfer fa bank↔bank?” → Sì, è stesso dataset `transactions` con `conto_id` diverso.
- “Esiste funzione/worker automatico dopo refresh?” → No worker su refresh; solo trigger da import/create/update o manuale “Cerca proposte”.

5) Intervento consigliato (prossimo step implementativo)

Per chiudere definitivamente il gap e soddisfare l’obiettivo “proposte già pronte” anche su storico:

A. Aggiungere una mutation “Recalcola tutte le proposte” (backfill globale)
- Prende tutte le transazioni utente non riconciliate (`none`)
- Chiama `generateSuggestionsForIds` in batch
- Aggiorna stati `suggested/none`
- Mostra `inserted_count` nel toast/log

B. (Opzionale ma consigliato) Eseguire un backfill automatico una tantum
- Al primo accesso a Transazioni, se `reconciliation_suggestions` è vuota e ci sono transazioni `none`
- Lancia ricalcolo globale in background (con guard per evitare loop)

C. Aggiungere logging tecnico temporaneo
- Dentro `generateSuggestionsForIds`: numero sorgenti analizzate, suggerimenti generati, inseriti, aggiornati

Con questi 3 punti, il vostro caso POSTAGIRO produce subito almeno 1 suggestion ad alto score e il pallino “attivo” compare correttamente.

6) Nota extra emersa dai log console (non bloccante per questo bug)

Sono presenti warning React su `ref` in:
- `ReconciliationSheet`
- `TransactionFilters`
Questi non spiegano l’assenza di suggestions in DB, ma vanno corretti a parte per pulizia UI/runtime.
