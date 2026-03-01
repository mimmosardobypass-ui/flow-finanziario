

# Fix: dropdown categorie non permette di selezionare sottocategorie

## Problema

Il dropdown categorie nel dialog "Modifica Transazione" usa `SelectGroup` con `SelectItem` al suo interno per le categorie padre. Questo puo' causare problemi di interazione con Radix UI Select, perche' `SelectGroup` si aspetta `SelectLabel` come intestazione e non un `SelectItem` selezionabile. Il risultato e' che cliccando sugli elementi nel dropdown, la selezione potrebbe non funzionare correttamente.

## Soluzione

Rimuovere completamente `SelectGroup` e rendere la lista piatta, usando solo `SelectItem` con stili diversi per distinguere visivamente padri e figli:
- Categorie padre: `font-semibold` (grassetto)
- Sottocategorie: indentate con prefisso `↳` e padding sinistro

Questo approccio e' piu' compatibile con Radix UI Select e garantisce che tutti gli elementi siano selezionabili.

## File coinvolti

### 1. `src/components/TransactionDialog.tsx`
- Rimuovere `SelectGroup` dal rendering delle categorie
- Usare una lista piatta di `SelectItem`: prima il padre (bold), poi i figli (indentati con `↳`)
- Ogni elemento e' un `SelectItem` diretto dentro `SelectContent`

### 2. `src/components/TransactionFilters.tsx`
- Stesso identico approccio per coerenza

## Esempio di rendering risultante
```text
[Viviana]          <- SelectItem, font-semibold
[  ↳ Corso Cordua]  <- SelectItem, pl-6
[  ↳ Affitto Parma] <- SelectItem, pl-6
[Altro]            <- SelectItem normale (senza figli)
```

