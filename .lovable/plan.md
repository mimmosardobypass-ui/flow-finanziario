

# Migliorare la barra di scorrimento nel selettore categorie

## Problema

Quando una categoria ha molte sottocategorie, la lista nel dropdown non mostra una barra di scorrimento visibile, rendendo difficile capire che ci sono altre voci sotto.

## Soluzione

Nel file `src/components/CategorySelect.tsx`:

1. Aumentare l'altezza massima della `ScrollArea` da `max-h-60` (240px) a `max-h-80` (320px) per mostrare piu' voci
2. Assicurarsi che la barra di scorrimento verticale di Radix sia sempre visibile quando il contenuto eccede l'altezza, usando la classe `data-[state=visible]:bg-border` sul thumb per renderla piu' evidente

Un solo file da modificare, una riga.

