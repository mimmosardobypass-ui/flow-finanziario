

# Fix: Allineare le card delle proposte con la card del movimento selezionato

## Problema

Le card delle proposte dentro la `ScrollArea` hanno un `pr-4` (padding-right di 16px) sul div interno che le contiene, creando un disallineamento rispetto alla card "Movimento selezionato" sopra. Il bordo destro delle proposte risulta piu' stretto.

## Soluzione

Rimuovere il `pr-4` dal div interno della `ScrollArea` (riga 216) in modo che le proposte occupino la stessa larghezza della card superiore.

## Modifica: `src/components/ReconciliationSheet.tsx`

**Riga 216**: Cambiare `<div className="space-y-2 pr-4">` in `<div className="space-y-2">`, rimuovendo il padding destro.

Un solo file, una sola riga.

