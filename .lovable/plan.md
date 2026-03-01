

# Fix: dati mancanti nella Dashboard (limite 1000 righe Supabase)

## Problema trovato

Il database contiene **1678 transazioni** (1196 uscite + 482 entrate), ma Supabase restituisce al massimo **1000 righe per query**. Il hook `useTransactions()` ne riceve solo 1000, quindi:
- Il "Saldo Totale" e' calcolato su dati incompleti
- Le card "Entrate" e "Uscite" per qualsiasi periodo sono potenzialmente sbagliate
- I grafici e le categorie sono basati su dati parziali
- Le 678 transazioni piu' vecchie vengono ignorate (ordinate per data desc, le piu' vecchie cadono fuori)

Nota: lo screenshot mostra "Questo mese" (Marzo 2026) con valori a zero, il che e' corretto perche' non ci sono transazioni di Marzo. Ma il "Saldo Totale" di 4310.89 e' probabilmente errato (calcolato su sole 1000 transazioni invece di 1678).

## Soluzione

Implementare la **paginazione** nel hook `useTransactions()` per recuperare tutte le righe dal database in batch da 1000.

### Modifica 1: `src/hooks/useTransactions.ts`

Nella funzione `queryFn` di `useTransactions()`, sostituire la singola query con un loop che usa `.range()` per recuperare tutte le transazioni in batch da 1000:

```text
Logica:
1. Primo batch: .range(0, 999)
2. Se restituisce 1000 righe, carica il batch successivo: .range(1000, 1999)
3. Ripetere finche' un batch restituisce meno di 1000 righe
4. Concatenare tutti i risultati
```

Nessun altro file necessita di modifiche: la Dashboard e tutti i componenti derivati usano gia' i dati da `useTransactions()`, quindi una volta che il hook restituisce il dataset completo, tutto si aggiorna automaticamente.

## Risultato atteso

- "Saldo Totale" calcolato correttamente su tutte le 1678 transazioni
- Card Entrate/Uscite accurate per ogni periodo
- Grafici e categorie basati sul dataset completo
- Nessun impatto sulle prestazioni percepite (2 chiamate REST invece di 1)

