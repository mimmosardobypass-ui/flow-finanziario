

# Riscrittura completa `src/utils/parseSellaPdf.ts`

## Approccio

Sostituzione totale del file (546 righe) con ~130 righe di parsing testuale puro.

## Logica

1. `parseSellaPdf(arrayBuffer)`: usa pdfjs-dist per estrarre testo grezzo, inserendo `\n` quando il salto Y tra frammenti supera 5px, poi chiama `parseSellaPdfText()`
2. `parseSellaPdfText(rawText)`: split per righe, identifica inizio transazione con regex `TWO_DATES_RE = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/`, accumula descrizione fino alla prossima coppia di date, estrae importo come ultimo match italiano nel blocco
3. Filtro rumore: ignora codici 14+ cifre, "EUR", "Saldo", "Pagina", intestazioni
4. console.log debug del testo grezzo e di ogni transazione

## File

| File | Azione |
|------|--------|
| `src/utils/parseSellaPdf.ts` | Sostituzione completa con parser testuale |

Nessuna modifica a `ImportTransazioni.tsx` -- il tipo `ParsedRow` e la firma restano identici.

