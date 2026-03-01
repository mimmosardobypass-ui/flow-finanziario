

# Fix: Dashboard mostra €0,00 perche' il mese corrente e' vuoto

## Problema

La dashboard si apre con il periodo "Questo mese" (Marzo 2026). Essendo il 1° marzo e non avendo transazioni di marzo, tutte le card mostrano €0,00. Non e' un bug di dati (la paginazione funziona, tutti i 1678 record sono caricati), ma un problema di UX: l'utente vede una dashboard vuota.

## Soluzione

Implementare un **auto-detect del periodo iniziale**: se il mese corrente non ha transazioni, il periodo predefinito sara' "Ultimi 3 mesi" invece di "Questo mese". In questo modo la dashboard mostra sempre dati significativi all'apertura.

## Modifica

### File: `src/pages/Dashboard.tsx`

1. Cambiare lo stato iniziale di `periodType` da fisso `"thisMonth"` a calcolato dinamicamente:
   - Dopo il caricamento delle transazioni, verificare se esistono transazioni nel mese corrente
   - Se il mese corrente ha transazioni: mantenere `"thisMonth"`
   - Se il mese corrente e' vuoto: usare `"threeMonths"` come default

2. Implementazione tecnica:
   - Aggiungere un `useEffect` che al primo caricamento dei dati controlla se ci sono transazioni nel mese corrente
   - Se non ce ne sono, aggiorna `periodType` a `"threeMonths"`
   - Il controllo avviene solo al primo caricamento (non ad ogni cambio dati), usando un ref `hasAutoDetected`

Nessun altro file necessita di modifiche.

## Risultato atteso

- Se ci sono transazioni nel mese corrente: dashboard mostra "Questo mese" come prima
- Se il mese corrente e' vuoto (come ora): dashboard mostra automaticamente "Ultimi 3 mesi" con entrate, uscite e grafici popolati
- L'utente puo' sempre cambiare periodo manualmente

