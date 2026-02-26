

# Riduzione falsi positivi nell'algoritmo di suggestion

## Diagnosi confermata

La verifica diretta a DB ha dimostrato che:
- Il rendering UI e' corretto: legge `reconciliation_status` e basta
- La sync e' corretta: `suggested` nel DB = suggestion attive presenti
- **Il problema e' nell'algoritmo di generazione**: crea troppi match falsi positivi

Esempi concreti di match errati:
- "Bar" (Cassa, €8.50) matchata con "PAYPAL TRENITALIAS" (Postepay, €8.50) solo per importo uguale
- "Extra" (€1000) ha **19 suggestion attive** (praticamente ogni transazione con importo simile)
- "Benzina Peugeot" (€20) ha 5 suggestion

## Soluzione: restringere i criteri di matching

### 1. Aumentare la soglia minima di score

Attualmente vengono salvate suggestion con score molto basso (match solo per importo simile). Alzare la soglia minima a **40** (attualmente probabilmente ~10-20) per eliminare match deboli.

### 2. Richiedere conti diversi per match di importo

I match basati solo su "stesso importo" devono richiedere che le due transazioni siano su **conti diversi** e di **tipo opposto** (income vs expense). Questo elimina match assurdi come Bar vs TRENITALIAS.

### 3. Limitare il numero di suggestion per transazione

Massimo **3 suggestion per transazione** (le migliori per score). Questo evita casi come "Extra" con 19 match.

### 4. Reset una tantum delle suggestion esistenti

Dopo aver aggiornato l'algoritmo, eseguire un ricalcolo completo che:
- Elimini tutte le suggestion non-dismissed
- Rigeneri con i nuovi criteri piu stretti
- Sincronizzi gli stati (molte transazioni torneranno `none`)

## File coinvolti

| File | Modifica |
|---|---|
| `src/hooks/useReconciliationSuggestions.ts` | Alzare soglia score minimo, limitare suggestion per transazione, richiedere conti diversi per match importo |

## Risultato atteso

- Molte meno transazioni con pallino rosso
- Solo match significativi (giroconti reali, trasferimenti interni)
- Meno "rumore" visivo nella lista transazioni
