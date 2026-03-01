

# Rendere la barra di scorrimento sempre visibile nel selettore categorie

## Problema

La `ScrollArea` di Radix nasconde la scrollbar di default. Anche con `type="auto"`, la barra appare solo durante lo scroll e puo' essere poco visibile.

## Soluzione

Nel file `src/components/CategorySelect.tsx`, cambiare il prop `type` della `ScrollArea` da `"auto"` a `"always"` per far si' che la barra di scorrimento sia sempre visibile quando il contenuto eccede l'altezza, esattamente come nello screenshot di riferimento.

### Dettaglio tecnico

| File | Modifica |
|------|----------|
| `src/components/CategorySelect.tsx` (riga ~225) | Cambiare `type="auto"` in `type="always"` sulla `ScrollArea` |

Una sola parola da modificare.

