

# Fix: Aumentare la larghezza del pannello Riconciliazione

## Problema

Il pannello laterale di riconciliazione ha una larghezza massima di `sm:max-w-lg` (32rem / 512px), che non e' sufficiente per mostrare tutto il contenuto (descrizioni lunghe, badge, importi e pulsanti).

## Soluzione

Aumentare la larghezza massima del `SheetContent` da `sm:max-w-lg` a `sm:max-w-xl` (36rem / 576px) o `sm:max-w-2xl` (42rem / 672px) per dare piu' spazio al contenuto.

## Modifica: `src/components/ReconciliationSheet.tsx`

Riga 129: cambiare la classe da `sm:max-w-lg` a `sm:max-w-2xl`:

```
<SheetContent className="w-full sm:max-w-2xl">
```

Un solo file, una sola riga da modificare.

