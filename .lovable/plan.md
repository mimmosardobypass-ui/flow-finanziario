
# Verifica e miglioramento selettore sottocategorie nel dialog transazione

## Situazione attuale

Ho verificato il database: le sottocategorie esistono gia' (es. "Corso Cordua" e "Affitto Parma" sono sottocategorie di "Viviana"). Il codice del dropdown nel dialog transazione gia' prevede la visualizzazione gerarchica con il simbolo `↳` per le sottocategorie.

Tuttavia ci sono due problemi da correggere:

### Problema 1: Wrapper `<div>` incompatibile con Radix Select
Il codice attuale avvolge le categorie padre e le loro sottocategorie in un `<div>`, che puo' causare problemi di rendering con il componente Radix Select (che si aspetta `SelectItem` come figli diretti). Questo potrebbe impedire la corretta selezione delle sottocategorie.

### Problema 2: Categorie duplicate
Alcune categorie esistono sia come categoria principale sia come sottocategoria (es. "Affitto Parma" e "Corso Cordua" appaiono due volte nel dropdown), creando confusione.

## Modifiche previste

### 1. Fix rendering dropdown nel TransactionDialog
- Rimuovere il wrapper `<div>` e usare un `React.Fragment` per evitare problemi con Radix Select
- Aggiungere un separatore visivo o usare `SelectGroup` + `SelectLabel` di Radix per raggruppare meglio le sottocategorie sotto il nome del padre
- La categoria padre appare come intestazione non selezionabile (o selezionabile se ha senso), le sottocategorie indentate sotto

### 2. Stesso fix nei filtri transazioni
- Applicare lo stesso miglioramento al dropdown nel componente `TransactionFilters`

### File coinvolti
1. `src/components/TransactionDialog.tsx` — fix dropdown categorie con supporto `SelectGroup`/`SelectLabel`
2. `src/components/TransactionFilters.tsx` — stesso fix per coerenza
