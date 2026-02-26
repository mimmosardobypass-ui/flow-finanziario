

# Fix: Riconciliazione non genera proposte per trasferimenti interni

## Causa radice

La migrazione precedente converte `partial`/`complete` in `reconciled`, ma **non converte `unreconciled` in `none`**. Le transazioni importate con status `unreconciled` vengono ignorate silenziosamente dalle query di aggiornamento che filtrano per `reconciliation_status = 'none'`.

Inoltre manca "postagiro" tra le keyword forti e la raccolta degli ID dopo l'import e fragile.

## Modifiche

### 1. Nuova migrazione SQL

Convertire tutti i valori `unreconciled` in `none`:

```sql
UPDATE public.transactions
SET reconciliation_status = 'none'
WHERE reconciliation_status = 'unreconciled';
```

### 2. `src/hooks/useReconciliationSuggestions.ts`

**a) Aggiungere "postagiro" a `STRONG_KEYWORDS`** (riga 18-22)

```typescript
const STRONG_KEYWORDS = new Set([
  "sumup", "payout", "postepay", "bonifico", "giroconto", "postagiro", "compass",
  "paypal", "stripe", "sepa", "addebito", "accredito", "trasferimento",
  "stipendio", "affitto", "bolletta", "rid", "mav", "rav",
]);
```

**b) Rendere gli update di status piu robusti** (righe 209, 238)

Cambiare `.eq("reconciliation_status", "none")` in `.in("reconciliation_status", ["none", "unreconciled"])` come safety net, cosi anche eventuali valori legacy vengono aggiornati.

**c) Bonus scoring per trasferimenti interni**

Quando una coppia ha: importo assoluto uguale + segno opposto + keyword transfer (giroconto/postagiro/trasferimento), aggiungere un bonus di +15 punti per "internal_transfer" pattern. Questo porta il punteggio totale del caso specifico a ~110-125, rendendo la proposta altamente prioritaria.

### 3. `src/hooks/useImportTransactions.ts`

Raccogliere gli ID direttamente dalle risposte di insert invece di ri-interrogare il DB:

```typescript
const importedIds: string[] = [];
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error, data } = await supabase
    .from("transactions")
    .insert(chunk)
    .select("id");
  if (error) throw error;
  imported += data?.length ?? chunk.length;
  importedIds.push(...(data || []).map(t => t.id));
}
```

## Riepilogo file

| File | Modifica |
|------|----------|
| Migrazione SQL | `UPDATE SET 'none' WHERE 'unreconciled'` |
| `useReconciliationSuggestions.ts` | Aggiunta "postagiro", safety net su status update, bonus internal transfer |
| `useImportTransactions.ts` | Raccolta ID diretta dalle insert |

## Risultato atteso

Dopo l'implementazione, i due movimenti POSTAGIRO (+100 / -100, stessa data, conti diversi) genereranno automaticamente una proposta con score ~110+ e appariranno con il pallino ambra nella colonna Ric.

