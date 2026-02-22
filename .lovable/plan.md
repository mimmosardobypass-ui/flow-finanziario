
# Fix: Cursore ricerca che si resetta

## Causa radice identificata

Il problema NON e nel debounce URL (gia corretto), ma in un ciclo di montaggio/smontaggio del componente:

1. Quando si digita nella ricerca, `filters.searchText` cambia
2. `useFilteredTransactions` ha `filters` (incluso `searchText`) nella `queryKey`
3. Nuova queryKey = nessun dato in cache = `isLoading = true`
4. In `Transactions.tsx`, il blocco `if (isLoading)` restituisce gli skeleton SENZA il componente `TransactionFilters`
5. `TransactionFilters` viene SMONTATO, distruggendo lo stato locale `searchInput`
6. La query si risolve, `isLoading` torna `false`, `TransactionFilters` si RIMONTA
7. `searchInput` viene reinizializzato dal prop `filters.searchText`, il cursore si resetta

Nota chiave: `searchText` viene filtrato LATO CLIENT (righe 73-80 di `useFilteredTransactions.ts`), non viene inviato al server. Non ha senso includerlo nella queryKey.

## Correzioni (2 file)

### File 1: `src/hooks/useFilteredTransactions.ts`

**Cambiamento**: Separare la logica in due parti:
- La query Supabase usa una `queryKey` che ESCLUDE `searchText` (perche non influenza la query server)
- Il filtro testuale viene applicato tramite l'opzione `select` di React Query (trasformazione lato client, senza cambiare la queryKey)

```typescript
// queryKey SENZA searchText - evita refetch inutili
queryKey: ["transactions", "filtered", user?.id, {
  type: filters.type,
  categoryId: filters.categoryId,
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
  amountMin: filters.amountMin,
  amountMax: filters.amountMax,
}],
```

Il filtro `searchText` viene spostato nell'opzione `select` di React Query, che trasforma i dati senza causare un refetch:

```typescript
select: (data) => {
  if (!filters.searchText?.trim()) return data;
  const searchLower = filters.searchText.trim().toLowerCase();
  return data.filter(t =>
    t.description?.toLowerCase().includes(searchLower) ||
    t.categories?.name.toLowerCase().includes(searchLower)
  );
},
```

### File 2: `src/pages/Transactions.tsx`

**Cambiamento**: Aggiungere `placeholderData: keepPreviousData` come sicurezza aggiuntiva. Questo fa si che, anche quando i filtri server cambiano (tipo, categoria, date, importo), i dati precedenti restino visibili durante il caricamento, evitando lo smontaggio dei filtri.

Questo e gia gestito correttamente dal cambio in File 1, ma e una protezione extra.

## Risultato atteso

- Digitare nella ricerca NON causa piu refetch (queryKey stabile)
- `isLoading` resta `false` durante la ricerca
- `TransactionFilters` non viene MAI smontato durante la digitazione
- Il cursore resta nella posizione corretta
- La ricerca continua a funzionare con debounce 300ms come prima
