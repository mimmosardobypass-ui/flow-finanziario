

# Miglioramento icone Riconciliazione e click su riga

## Cosa cambia

Tre modifiche puntuali per allineare il comportamento alla tua richiesta:

### 1. Pallino rosso pieno per "proposte trovate"
Attualmente il pallino rosso ha un cerchio con un puntino dentro. Verra' sostituito con un **cerchio pieno colorato** (solido, come nello screenshot).

### 2. Spunta verde per "riconciliato"
Attualmente c'e' un cerchio con spunta dentro. Verra' sostituito con una **spunta semplice verde** (senza cerchio attorno), come nello screenshot.

### 3. Cerchio vuoto grigio per "nessuna proposta"
Questo e' gia' corretto (cerchio vuoto grigio). Nessuna modifica necessaria.

### 4. Click sulla riga apre il pannello riconciliazione
Attualmente bisogna cliccare sul pallino. Verra' reso **cliccabile l'intera riga** della tabella: cliccando su qualsiasi punto della riga si apre il pannello laterale con le proposte di riconciliazione.

## Comportamento confermato (invariato)
- Il sistema **non riconcilia automaticamente**: propone soltanto, l'utente decide
- Cliccando si vede la coincidenza di importo proposta
- L'utente puo' accettare o rifiutare la proposta dal pannello laterale

## File coinvolto

| File | Modifica |
|---|---|
| `src/pages/Transactions.tsx` | Cambio icone in `getRicIndicator`, riga tabella cliccabile |

