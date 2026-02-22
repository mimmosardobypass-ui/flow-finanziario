

# Fix: Cursore di ricerca che si resetta

## Problema
Quando digiti nella barra di ricerca, ogni lettera provoca questo ciclo:

1. Digiti "c" → `searchInput` cambia → dopo 300ms debounce → `onFiltersChange({searchText: "c"})` viene chiamato
2. `filters` si aggiorna nel componente `Transactions`
3. Il `useEffect` di sincronizzazione URL rileva il cambio di `filters` e chiama `setSearchParams()`
4. React Router processa il cambio URL come una "navigazione", causando un re-render che resetta la posizione del cursore nell'input

## Soluzione

Modificare `src/pages/Transactions.tsx` per **escludere `searchText` dalla sincronizzazione URL**, oppure debounce anche la scrittura URL. La soluzione piu pulita e semplice:

### File: `src/pages/Transactions.tsx`

**Cambiamento 1**: Leggere anche `search` dai parametri URL nell'inizializzazione dei filtri (riga 44-48), cosi il filtro si ripristina se l'utente arriva con `?search=...` nel link.

**Cambiamento 2**: Nel `useEffect` di sincronizzazione URL (riga 51-60), **non scrivere `searchText` nell'URL ad ogni battitura**. Rimuovere la riga:
```ts
if (filters.searchText) params.set("search", filters.searchText);
```

Oppure, soluzione alternativa migliore: aggiungere un **debounce separato** per la scrittura URL, usando un `useRef` per evitare che `setSearchParams` venga chiamato mentre l'utente sta ancora digitando.

**Approccio scelto (piu robusto)**: usare `useRef` + `setTimeout` dedicato per la sincronizzazione URL, separato dal debounce della ricerca. In questo modo:
- La ricerca continua a funzionare con debounce 300ms (come oggi)
- L'URL si aggiorna solo dopo 500ms di inattivita, senza interrompere la digitazione
- Il cursore non si resetta mai

### Dettaglio tecnico

```typescript
// Ref per debounce URL separato
const urlSyncTimerRef = useRef<NodeJS.Timeout>();

useEffect(() => {
  clearTimeout(urlSyncTimerRef.current);
  urlSyncTimerRef.current = setTimeout(() => {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== "all") params.set("type", filters.type);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.searchText) params.set("search", filters.searchText);
    if (filters.amountMin) params.set("amountMin", filters.amountMin.toString());
    if (filters.amountMax) params.set("amountMax", filters.amountMax.toString());
    setSearchParams(params, { replace: true });
  }, 500);
  
  return () => clearTimeout(urlSyncTimerRef.current);
}, [filters, setSearchParams]);
```

Inoltre, leggere `search` dall'URL nell'inizializzazione:
```typescript
const [filters, setFilters] = useState<FiltersType>(() => {
  // ... existing code ...
  const search = searchParams.get("search");
  return {
    // ... existing fields ...
    searchText: search || undefined,
  };
});
```

### File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/Transactions.tsx` | Debounce separato per sync URL + leggere `search` da URL |

