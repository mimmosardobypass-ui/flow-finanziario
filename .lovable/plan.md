
Confermato: ho capito perfettamente l’obiettivo. Il pallino “Ric.” deve dipendere da una sola fonte (`reconciliation_status` da DB), con state machine rigida: `none` (grigio) / `suggested` (rosso) / `reconciled` (spunta).

Stato attuale verificato (evidenza concreta)
1. Renderer attuale
- In `src/pages/Transactions.tsx` il mapping è già centralizzato in `getRicIndicator(status)`:
  - `reconciled` -> verde/check
  - `suggested` -> rosso/pieno
  - default -> grigio
- Il render usa `transaction.reconciliation_status` per scegliere icona/colore.

2. Log attuali
- I log mostrano:
  - `[RIC_DEBUG] render id=... status=suggested -> icon=CircleDot`
- Quindi la UI sta leggendo `suggested` in render per quelle righe.

3. Verifica DB reale
- Query mismatch globale (`suggested` senza suggestion attive / `none` con suggestion attive): nessun mismatch trovato.
- Per i due ID POSTAGIRO:
  - `3d134d53...`: `reconciliation_status=suggested`, suggestion attive > 0
  - `b13f8ccc...`: `reconciliation_status=suggested`, suggestion attive > 0
- Quindi, nei casi campionati, il rosso è coerente con lo stato salvato.

Interpretazione del problema residuo
- Non emerge (sui campioni verificati) un bug di “colore calcolato da altro stato locale”.
- Il rischio principale resta strutturale:
  1) possibili finestre di stale cache dopo mutazioni,
  2) aggiornamenti status non verificati con error handling forte,
  3) possibili scritture legacy su `reconciliation_status` (hook `useReconcile` con valori `partial/complete`) che non rispettano la state machine ufficiale.

Implementazione definitiva proposta (hardening strutturale)
1) Rendere il render tracciabile e incontestabile
- In `Transactions.tsx` aggiungere logging temporaneo per tutte le righe visibili:
  - `console.log('[RIC_RENDER]', transaction.id, transaction.reconciliation_status)`
- Il mapping resta esclusivamente:
  - `const indicator = getRicIndicator(transaction.reconciliation_status)`

2) Eliminare ambiguità sul campo status lato UI
- Introdurre tipo esplicito:
  - `type ReconciliationStatus = 'none' | 'suggested' | 'reconciled'`
- `getRicIndicator` accetta solo questo tipo.
- Se arriva valore anomalo, log warning diagnostico (temporaneo), ma nessuna logica alternativa basata su suggestions/count.

3) Rafforzare sync backend con error handling esplicito
- In `syncReconciliationStatusForTransactions`:
  - controllare ogni risposta Supabase (`error`) e fare throw in caso di errore.
  - loggare risultato update (quanti record portati a `suggested` e quanti a `none`).
- Obiettivo: garantire che “sync eseguita” significhi “sync committata”.

4) Forzare refresh deterministico post-mutation
- Dopo `dismiss` e `accept`:
  - mantenere `invalidateQueries(['transactions'])`,
  - aggiungere `await queryClient.refetchQueries({ queryKey: ['transactions'], type: 'active' })`.
- Questo riduce il rischio di UI su cache non ancora riallineata nel frame immediatamente successivo.

5) Verifica “single source of truth” nel codice
- Audit finale su tutta la codebase per assicurare che la colonna Ric non usi:
  - count suggestion,
  - flag UI locali,
  - derived booleans esterni allo status.
- Dalle ricerche già fatte non risultano campi tipo `has_suggestions` usati per il pallino.

6) Allineare il percorso legacy fuori state machine
- `useReconcile` attualmente può scrivere `partial/complete` in `reconciliation_status`.
- Va riallineato alla state machine ufficiale (oppure deprecato) per prevenire drift futuri.

Verifica finale che consegnerò dopo implementazione
1. DB -> UI mapping (campione POSTAGIRO):
- Stampare:
  - status DB
  - numero suggestion attive
  - `[RIC_RENDER]` della riga
- Confermare coerenza 1:1.

2. Flusso mutazioni:
- Dismiss totale -> DB `none` -> UI grigio.
- Accept -> DB `reconciled` -> UI spunta.
- Recalc -> mai `reconciled` automatico.

3. Query staleness:
- Dopo dismiss/accept, verificare che il refetch porti subito in tabella il nuovo stato senza residui.

File coinvolti nel piano
- `src/pages/Transactions.tsx`
  - logging `[RIC_RENDER]` su righe visibili
  - typing più stretto del mapping status->icona
- `src/hooks/useReconciliationSuggestions.ts`
  - error handling e logging robusto in sync
  - refetch post-mutation oltre invalidazione
- `src/hooks/useReconciliation.ts`
  - riallineamento/eliminazione stati legacy `partial/complete`

Risultato atteso
- Comportamento deterministico e verificabile:
  - `none` -> grigio
  - `suggested` -> rosso
  - `reconciled` -> verde/check
- Nessun criterio implicito aggiuntivo nel renderer.
- Tracciabilità completa UI ↔ DB durante il debug.
