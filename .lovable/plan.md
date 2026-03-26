

# Fix parser PDF Banca Sella - descrizioni e importi

## Problema

Il parser attuale raggruppa i frammenti di testo per coordinata Y esatta (Math.round). Nei PDF tabulari di Banca Sella, una singola riga di transazione puo' avere il testo distribuito su piu' Y:
- Y=100: `25000905207983  16/05/2025  16/05/2025  DONAZIONE X ACQUISTO MAGAZZINO A SARDO`
- Y=92: `CARDALANO GIUSEPPE  EUR  -32.500,00`

Risultato: la descrizione viene spezzata e l'importo finisce nella riga di continuazione, causando parsing errato.

## Soluzione

Riscrivere `src/utils/parseSellaPdf.ts` con un approccio basato sulle **colonne X** invece che sulle righe Y:

1. **Identificare le posizioni X delle colonne** dalla riga di intestazione del PDF (cercando "Codice", "Data", "Descrizione", "Divisa", "Importo")
2. **Raggruppare le righe della tabella** con tolleranza Y (raggruppare Y entro 3-4px per gestire testo multilinea nella stessa cella)
3. **Assegnare ogni frammento alla colonna corretta** in base alla sua posizione X
4. **Ricostruire transazioni complete** usando il codice identificativo come delimitatore di riga

### Logica migliorata

- Scansionare tutti i text items del PDF con le loro coordinate (x, y)
- Trovare la riga header per determinare i range X di ogni colonna
- Per ogni transazione (delimitata dal codice 14+ cifre):
  - Raccogliere TUTTI i frammenti di testo tra un codice e il successivo
  - Assegnare ogni frammento alla colonna corretta per posizione X
  - Concatenare i frammenti della colonna "Descrizione"
  - Estrarre l'importo dalla colonna "Importo" (con segno corretto)
  - Estrarre la data dalla colonna "Data operazione"

### Gestione segni

L'importo nel PDF Sella ha il segno esplicito (`-32.500,00` o `+31,70`). Il regex AMOUNT_RE viene aggiornato per catturare correttamente il segno `[+-]` che puo' precedere l'importo o essere separato da uno spazio.

## File modificato

| File | Modifica |
|------|----------|
| `src/utils/parseSellaPdf.ts` | Riscrittura completa con approccio column-based |

Dopo la correzione, si consiglia di cancellare i movimenti importati in modo errato e reimportare il PDF.

