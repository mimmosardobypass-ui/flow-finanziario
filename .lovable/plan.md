

# Aggiungere gestione categorie inline nel selettore

## Obiettivo

Trasformare il dropdown di selezione categoria (nel dialog "Nuova Transazione") in un punto unico dove l'utente puo' non solo selezionare, ma anche **creare**, **modificare** e **eliminare** categorie e sottocategorie, come mostrato nello screenshot.

## Modifiche previste

### 1. `src/components/CategorySelect.tsx`

Aggiungere icone di azione accanto a ogni categoria nel dropdown:

- **Modifica** (icona matita) -- apre il `CategoryDialog` in modalita' edit
- **Aggiungi sottocategoria** (icona +) -- apre il `CategoryDialog` con `defaultParentId` pre-impostato
- **Elimina** (icona cestino) -- apre il `DeleteConfirmDialog`

Le icone appariranno sulla destra di ogni riga categoria (sia padre che figlio), visibili al passaggio del mouse.

Nuove props opzionali:
- `allowManage?: boolean` (default `false`) -- attiva le azioni inline. Il componente rimane invariato dove usato come semplice selettore (es. filtri transazioni).

Nuovi stati interni:
- `editCategory` -- la categoria da modificare
- `addSubcategoryParentId` -- il parent per cui creare una sottocategoria
- `deleteCategory` -- la categoria da eliminare
- `categoryDialogOpen` e `deleteDialogOpen`

I dialog (`CategoryDialog`, `DeleteConfirmDialog`) vengono renderizzati **fuori** dal Popover per evitare problemi di z-index e propagazione eventi.

### 2. `src/components/TransactionDialog.tsx`

- Rimuovere il pulsante "+ Nuova" esterno sopra il selettore categoria
- Passare `allowManage={true}` al `CategorySelect`
- Rimuovere il `QuickCategoryDialog` (non piu' necessario, il `CategoryDialog` completo lo sostituisce)

### 3. Header del dropdown

Cambiare il testo del placeholder della ricerca in "Cerca o crea una categoria" e aggiungere un pulsante "+" accanto alla barra di ricerca per creare una nuova categoria principale (apre `CategoryDialog` senza parent).

## Dettaglio tecnico -- Layout riga categoria

```text
[Chevron] [Nome categoria]              [Modifica] [+ Sotto] [Elimina]
          ↳ [Nome sottocategoria]        [Modifica]           [Elimina]
```

Le icone azione hanno dimensione ridotta (h-3.5 w-3.5) e sono visibili solo on hover della riga (`group/hover`), tranne su mobile dove sono sempre visibili.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/CategorySelect.tsx` | Aggiungere prop `allowManage`, icone azione inline, rendering dei dialog di gestione |
| `src/components/TransactionDialog.tsx` | Passare `allowManage={true}`, rimuovere pulsante "+ Nuova" e `QuickCategoryDialog` |

