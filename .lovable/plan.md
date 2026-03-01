

# Redesign pagina Categorie

## Cosa cambia

La pagina Categorie viene ridisegnata per avere un layout pulito e compatto come nello screenshot: lista unica in una Card con campo di ricerca in alto, quadratini colorati per le categorie padre, sottocategorie indentate con prefisso "/".

## Layout finale

```text
Categorie                         [+ Nuova Categoria]

┌───────────────────────────────────────────────────┐
│  🔍 Cerca o crea una categoria                    │
├───────────────────────────────────────────────────┤
│  ■ Accredito da Minis...         ✏️  ➕  🗑️      │
│  ■ Accredito Finanzia...         ✏️  ➕  🗑️      │
│    / Cofidis                                      │
│    / Compass                                      │
│    / Findomestic                                  │
│  ■ Accredito POS                 ✏️  ➕  🗑️      │
│    / BCC Bancomat                                 │
│  ■ Affitto                       ✏️  ➕  🗑️      │
└───────────────────────────────────────────────────┘
```

## Dettagli

### Campo di ricerca
- Input con icona Search in alto nella Card
- Filtra categorie in tempo reale (sia padre che figlie)
- Placeholder: "Cerca o crea una categoria"

### Categorie padre
- Quadratino colorato (colore generato da hash del nome, pastello)
- Nome troncato con ellipsis se troppo lungo
- 3 pulsanti inline a destra: modifica (matita), aggiungi sottocategoria (+), elimina (cestino)

### Sottocategorie
- Indentate sotto il padre, prefisso "/" prima del nome
- Pulsanti modifica e elimina visibili al hover
- Nessun quadratino colorato

### Colori automatici
Funzione helper che converte il nome categoria in un colore HSL pastello consistente (stesso nome = stesso colore sempre).

## File modificato

### `src/pages/Categories.tsx`
- Aggiungere stato `searchQuery` per il filtro
- Aggiungere funzione `stringToColor(name)` per generare colori pastello
- Rimuovere la divisione in due colonne (incomeTree/expenseTree)
- Usare `categoryTree` completo, filtrato per searchQuery
- Nuovo layout: Card singola con input di ricerca + lista unificata
- Categorie padre: quadratino colorato + nome + azioni inline
- Sottocategorie: indentate con "/" + azioni al hover
- Mantenere i dialog esistenti (CategoryDialog, DeleteConfirmDialog) senza modifiche

