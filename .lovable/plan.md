

# Fix visibilita sottocategorie nel selettore categoria

## Problema identificato

Le sottocategorie esistono nel database e il codice le gestisce correttamente. Il problema e' che nel componente `CategorySelect`, tutte le categorie padre partono **chiuse** (collapsed), quindi le sottocategorie non sono immediatamente visibili. L'utente deve cliccare la piccola freccia accanto alla categoria padre per espandere e vedere le figlie -- un comportamento facilmente ignorabile.

## Soluzione proposta

Modificare `CategorySelect.tsx` per **espandere automaticamente** tutte le categorie padre che hanno figli, cosi le sottocategorie sono subito visibili quando si apre il dropdown.

## Dettaglio tecnico

### `src/components/CategorySelect.tsx`

Cambiare l'inizializzazione dello stato `expanded` da un Set vuoto a un Set contenente tutti gli ID delle categorie che hanno figli. Questo viene calcolato con un `useMemo` basato sulla prop `categories`:

```tsx
// Prima (tutto chiuso):
const [expanded, setExpanded] = useState<Set<string>>(new Set());

// Dopo (auto-espande categorie con figli):
const parentIds = useMemo(
  () => new Set(categories.filter(c => c.children.length > 0).map(c => c.id)),
  [categories]
);
```

Usare un `useEffect` per sincronizzare lo stato `expanded` con `parentIds` quando le categorie cambiano, oppure usare direttamente `parentIds` come valore iniziale e aggiornarlo all'apertura del popover.

L'approccio piu' pulito: resettare `expanded` a "tutti aperti" ogni volta che il Popover si apre, cosi l'utente vede sempre tutte le sottocategorie disponibili.

### Riepilogo modifiche

| File | Modifica |
|------|----------|
| `src/components/CategorySelect.tsx` | Auto-espandere categorie padre con figli all'apertura del dropdown |

Nessun altro file necessita di modifiche -- il `TransactionDialog`, `useCategories` e il database funzionano gia' correttamente.

