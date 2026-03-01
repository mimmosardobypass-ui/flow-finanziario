
# Fix: rendere selezionabili le categorie padre nel dropdown transazione

## Problema

Quando una categoria padre ha sottocategorie, viene mostrata come `SelectLabel` (intestazione non selezionabile). Questo causa due problemi:
- Non si puo' assegnare una categoria padre a una transazione
- Modificando una transazione gia' associata a una categoria padre, il dropdown mostra "Seleziona categoria" invece del valore corretto

## Soluzione

Cambiare il rendering: le categorie padre con figli diventano `SelectItem` selezionabili (con stile bold per distinguerle), seguite dalle sottocategorie indentate. Si usa `SelectGroup` per il raggruppamento visivo ma con il padre come primo `SelectItem` invece di `SelectLabel`.

## File coinvolti

### 1. `src/components/TransactionDialog.tsx`
- Sostituire `SelectLabel` con `SelectItem` per la categoria padre
- Mantenere `SelectGroup` per il raggruppamento visivo
- La categoria padre avra' `className="font-semibold"` per distinguerla
- Le sottocategorie restano indentate con `className="pl-6"`

### 2. `src/components/TransactionFilters.tsx`
- Stesso identico fix per coerenza con il dialog transazione
