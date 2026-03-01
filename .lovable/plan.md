

# Aggiungere ricerca nel selettore categoria

## Problema

Il componente `CategorySelect` (usato nel dialog "Nuova Transazione") non ha un campo di ricerca. Con molte categorie, l'utente deve scorrere tutta la lista per trovare quella desiderata.

## Soluzione

Aggiungere un campo di ricerca in cima al dropdown del `CategorySelect`. Filtra in tempo reale sia categorie padre che sottocategorie.

## Dettaglio tecnico

### `src/components/CategorySelect.tsx`

- Aggiungere stato `searchQuery`
- Aggiungere un `<Input>` con icona `Search` subito dopo l'apertura del `PopoverContent`, prima della `ScrollArea`
- Filtrare le categorie con `useMemo`: se il nome del padre o di un figlio contiene la query, mostrare quella categoria (se match su figlio, mostrare anche il padre)
- Resettare `searchQuery` a stringa vuota quando il popover si apre
- Importare `Search` da lucide-react e `Input` da ui/input

### Logica di filtro

```
Per ogni categoria padre:
  - Se il nome padre matcha -> mostrare padre + tutti i figli
  - Altrimenti filtrare solo i figli che matchano
  - Se almeno un figlio matcha -> mostrare padre (con solo figli filtrati)
  - Se nessun match -> nascondere
```

Nessun altro file da modificare.
