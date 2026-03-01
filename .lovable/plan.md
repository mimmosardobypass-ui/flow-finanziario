

# Assegnazione automatica categoria "Giroconti" alla riconciliazione

## Obiettivo

Quando una riconciliazione di tipo "transfer" viene confermata, il sistema assegna automaticamente la categoria "Giroconti" (tipo expense) a tutte le transazioni coinvolte che non hanno gia' una categoria. Se la categoria non esiste, viene creata al volo.

## Modifiche

### 1. `src/hooks/useReconciliation.ts` - funzione `useReconcile`

Nella `mutationFn`, dopo l'update di riconciliazione (riga 118-121), aggiungere la logica di auto-categorizzazione solo quando `reconciliationType === "transfer"`:

1. Cercare la categoria "Giroconti" dell'utente (`categories` con `name = "Giroconti"`)
2. Se non esiste, crearla con `type = "expense"` e `user_id` dell'utente
3. Aggiornare il `category_id` di tutte le transazioni del gruppo che hanno `category_id = null`

Aggiungere anche `queryClient.invalidateQueries({ queryKey: ["categories"] })` nell'`onSuccess`.

### 2. `src/hooks/useReconciliation.ts` - funzione `useUnreconcile`

Quando si annulla una riconciliazione, rimuovere anche la categoria "Giroconti" dalle transazioni coinvolte (ripristinare `category_id = null` solo se la categoria e' "Giroconti"), per coerenza.

## Comportamento

- Riconciliazione tipo "transfer": categoria "Giroconti" assegnata automaticamente alle transazioni senza categoria
- Transazioni gia' categorizzate: non vengono sovrascritte
- Annullamento riconciliazione: la categoria "Giroconti" viene rimossa (le altre categorie restano)
- La categoria "Giroconti" viene creata una sola volta e riutilizzata

## File coinvolto

Solo `src/hooks/useReconciliation.ts`

