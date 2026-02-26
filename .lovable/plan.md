
Obiettivo operativo: rendere verificabile end-to-end che “Ricalcola suggerimenti” parta davvero, produca metriche tecniche complete, e generi almeno 1 suggestion per la coppia POSTAGIRO (+100/-100 del 24/02/2026) con stato finale `suggested`.

Stato rilevato ora (audit già fatto)
1) Dati DB attuali
- `reconciliation_suggestions`: `active_count=0`, `dismissed_count=0`
- Le 2 transazioni POSTAGIRO esistono e sono coerenti:
  - `b13f8ccc...` → amount 100, type `income`, status `none`, conto `d0257fb0...`
  - `3d134d53...` → amount 100, type `expense`, status `none`, conto `484955a4...`
- Quindi, coi criteri attuali, la coppia è eleggibile (tipo opposto + stesso importo + stessa data + keyword/id in descrizione).

2) Flusso UI attuale del pulsante
- In `src/pages/Transactions.tsx` il pulsante refresh chiama `recalcMutation.mutate(...)`.
- La mutation è `useRecalculateAllSuggestions()` in `src/hooks/useReconciliationSuggestions.ts`.
- Non usa RPC/Edge Function: usa query dirette Supabase (REST via supabase-js) su `transactions` e `reconciliation_suggestions`.

3) Gap attuale (causa “non funziona” percepito)
- Logging insufficiente: oggi si logga solo totale transazioni e totale suggestion generate, ma mancano i numeri diagnostici richiesti.
- Snapshot network disponibile mostra solo GET transazioni (nessuna evidenza click in quello snapshot specifico), quindi serve telemetria esplicita sul click e sulle fasi di batch.

Implementazione proposta (strutturale e puntuale)

Fase A — Tracciamento certo del click e della pipeline
File: `src/pages/Transactions.tsx`, `src/hooks/useReconciliationSuggestions.ts`
1. Aggiungere log UI espliciti sul pulsante:
- `[RIC_RECALC_UI] click`
- `[RIC_RECALC_UI] start`
- `[RIC_RECALC_UI] success count=...`
- `[RIC_RECALC_UI] error=...`
2. Aggiungere log mutation lato hook:
- `[RIC_RECALC] start user=...`
- `[RIC_RECALC] eligible_ids=...`
- `[RIC_RECALC] batch i/n size=...`
- `[RIC_RECALC] done processed=...`

Fase B — Metriche obbligatorie richieste (candidate/scarti/insert)
File: `src/hooks/useReconciliationSuggestions.ts`
1. Introdurre un oggetto diagnostico per batch e totale run, con questi campi minimi:
- `input_candidate_ids` (numero IDs in input)
- `candidate_pairs_evaluated`
- `suggestions_inserted`
- `discard_main_reason` + breakdown completo:
  - `discard_same_transaction`
  - `discard_same_account`
  - `discard_deleted`
  - `discard_already_reconciled`
  - `discard_date_out_of_range`
  - `discard_not_opposite_type`
  - `discard_score_below_threshold`
  - `discard_previously_dismissed`
  - `discard_top3_trimmed`
2. Stampare log finale per ogni batch e totale:
- `[RIC_METRICS_BATCH] {...}`
- `[RIC_METRICS_TOTAL] {...}`
3. Definire “motivazione scarto principale” come max del breakdown (campo derivato in log).

Fase C — Eliminare ambiguità dataset ricalcolo
File: `src/hooks/useReconciliationSuggestions.ts`
1. Rendere il filtro input robusto:
- invece di `.in("reconciliation_status", ["none","unreconciled"])`, usare una condizione che includa sicuramente `none` e `suggested` (es. “tutte le non reconciled”).
2. Loggare distribuzione stati nel dataset pre-ricarcolo:
- `[RIC_RECALC] status_distribution {none:..., suggested:..., reconciled:...}`

Fase D — Verifica specifica POSTAGIRO (obbligatoria)
File: `src/hooks/useReconciliationSuggestions.ts`
1. Aggiungere tracing mirato per i due ID:
- `[RIC_POSTAGIRO] source=... candidate=... score=... reasons=... kept/discarded`
2. Se la coppia non entra, loggare motivo preciso e singolo:
- `excluded_by=not_opposite_type | amount_mismatch | date_out_of_range | score_below_threshold | same_account | dismissed_history | top3_trim`
3. Dopo insert+sync, loggare stato DB risultante dei due ID:
- `[RIC_POSTAGIRO_RESULT] id=... status=... active_links=...`

Fase E — Refresh dati dopo ricalcolo (anti stale perception)
File: `src/hooks/useReconciliationSuggestions.ts`
1. In `useRecalculateAllSuggestions.onSuccess`, oltre a invalidate:
- eseguire `await queryClient.refetchQueries({ queryKey: ["transactions"], type: "active" })`
- eseguire `await queryClient.refetchQueries({ queryKey: ["reconciliation-suggestions"], type: "active" })`
2. Questo allinea subito UI e DB subito dopo click.

Fase F — Verifica tecnica post-implementazione (pass/fail)
1. Click su “Ricalcola suggerimenti” deve produrre in console:
- conferma click/start/success
- metriche obbligatorie complete
2. Verifica DB immediata:
- per i due ID POSTAGIRO: almeno 1 riga in `reconciliation_suggestions` con `dismissed=false`
- `transactions.reconciliation_status` dei due ID = `suggested`
3. Verifica UI:
- le due righe POSTAGIRO mostrano pallino rosso
- log render coerente: `[RIC_RENDER] ... status=suggested`
4. Caso errore:
- se suggestions=0 per POSTAGIRO, il log deve già dire la singola condizione escludente senza ambiguità.

Sezione tecnica (dettaglio architetturale)
- Endpoint/RPC chiamato dal pulsante: nessun RPC; chiamate Supabase client-side verso:
  - `transactions` (SELECT/UPDATE)
  - `reconciliation_suggestions` (SELECT/DELETE/INSERT/UPDATE)
- Punto unico della rigenerazione globale:
  - `useRecalculateAllSuggestions -> generateSuggestionsForIds(batch, user.id)`
- Punto critico da rendere osservabile:
  - dentro `computeSuggestionsForTransaction` e in `generateSuggestionsForIds` servono contatori di scarto granulari; oggi non ci sono.
- Nessuna modifica schema DB necessaria per questa attività (solo codice applicativo e logging diagnostico).

Risultato atteso finale
- Dopo click ricalcolo:
  - pipeline tracciata in modo inequivocabile
  - metriche richieste disponibili
  - coppia POSTAGIRO +100/-100 produce almeno 1 suggestion (`internal_transfer` tra le reason)
  - stato transazioni passa a `suggested`
  - UI mostra pallino rosso in coerenza 1:1 col DB.
