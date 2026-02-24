

# Migrazione: Rinomina "Conto Principale" in "Cassa"

## Cosa viene fatto

Una migrazione SQL che, per ogni utente:

1. Verifica se esiste gia un conto chiamato "Cassa"
2. Se non esiste, rinomina il "Conto Principale" (creato dalla migrazione precedente) in "Cassa"
3. Se "Conto Principale" non esiste ma nemmeno "Cassa", crea un nuovo conto "Cassa" attivo
4. Aggiorna tutte le transazioni attualmente collegate al vecchio "Conto Principale" per puntare a "Cassa"

Le transazioni non vengono eliminate ne modificate nei loro dati (importo, data, descrizione, categoria). Viene solo aggiornato il riferimento al conto.

## Sicurezza

- Nessun dato viene cancellato
- L'operazione e idempotente: se eseguita piu volte non causa errori
- Le transazioni future non vengono toccate (la migrazione agisce solo sui record esistenti al momento dell'esecuzione)

## Dettagli tecnici

| File | Azione |
|------|--------|
| `supabase/migrations/[timestamp].sql` | Creare nuova migrazione SQL |

### Logica SQL

```text
1. Rinomina i conti "Conto Principale" in "Cassa" (dove non esiste gia un conto "Cassa" per lo stesso utente)
2. Se per qualche utente esiste gia "Cassa" ma anche "Conto Principale":
   - Sposta le transazioni dal "Conto Principale" al conto "Cassa" esistente
   - Elimina il "Conto Principale" ormai vuoto
```

