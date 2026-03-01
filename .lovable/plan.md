
# Selettore categorie espandibile con sottomenu

## Cosa cambia

Creo un nuovo componente `CategorySelect` che usa **Popover + lista custom** al posto del Select Radix, permettendo di espandere/comprimere le sottocategorie con un chevron.

## Comportamento

- Le categorie padre **senza figli** sono voci normali: click seleziona e chiude
- Le categorie padre **con figli** hanno un chevron (▶/▼):
  - Click sul **chevron**: espande/comprime i figli senza chiudere il menu
  - Click sul **nome**: seleziona la categoria padre e chiude il menu
- Le **sottocategorie** appaiono indentate con prefisso `↳`: click seleziona e chiude
- Stile coerente con i Select esistenti (bordi, colori, dimensioni)

## File coinvolti

### 1. Nuovo: `src/components/CategorySelect.tsx`

Componente riutilizzabile con:
- **Props**: `value`, `onChange`, `categories` (CategoryWithChildren[]), `placeholder`, `showAllOption?`, `className?`
- **Stato interno**: `open` (popover), `expanded` (Set di id categorie espanse)
- **UI**: Popover con Button trigger che mostra il nome della categoria selezionata
- Lista interna con:
  - Riga padre: nome cliccabile + chevron se ha figli
  - Righe figlie: indentate, visibili solo se il padre e' espanso
- Stile hover e focus coerente con il design system

### 2. `src/components/TransactionDialog.tsx`
- Importare `CategorySelect`
- Sostituire il blocco Select categoria (righe 350-368) con `<CategorySelect>`
- Rimuovere import inutilizzati di Select se non servono altrove (ma servono ancora per Conto e altri campi)

### 3. `src/components/TransactionFilters.tsx`
- Importare `CategorySelect`
- Sostituire il blocco Select categoria (righe 191-214) con `<CategorySelect>` con prop `showAllOption`
