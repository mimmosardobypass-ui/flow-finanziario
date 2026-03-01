
# Sottocategorie per filtraggio statistico

## Concetto

Aggiungere un livello di gerarchia alle categorie esistenti: ogni categoria puo' avere un `parent_id` opzionale che la rende una sottocategoria. La struttura rimane semplice (massimo 2 livelli: categoria padre e sottocategorie).

Esempio pratico:
- **Abbonamenti** (categoria padre, tipo: uscita)
  - Abbonamento Lovable
  - Netflix
  - Spotify
- **Stipendio** (categoria padre, tipo: entrata)
  - Stipendio principale
  - Bonus

## Modifiche

### 1. Database: nuova colonna `parent_id`

Migrazione SQL per aggiungere `parent_id` (UUID, nullable, FK verso `categories.id`) alla tabella `categories`. Quando `parent_id` e' valorizzato, la categoria e' una sottocategoria.

### 2. Hook `useCategories` - struttura gerarchica

Aggiornare il hook per esporre sia la lista piatta (per i select) che una versione raggruppata per padre (per la pagina gestione e le statistiche).

### 3. Pagina Categorie - gestione sottocategorie

- Sotto ogni categoria padre, mostrare le sottocategorie indentate
- Nel dialog di creazione/modifica, aggiungere un campo opzionale "Categoria padre" per rendere la nuova categoria una sottocategoria
- Possibilita' di creare sottocategorie direttamente dalla categoria padre (pulsante "+")

### 4. TransactionDialog - selettore con gruppi

Raggruppare le categorie nel dropdown con `OptGroup` visivi: il nome della categoria padre come intestazione, le sottocategorie indentate sotto. Le categorie senza padre restano al primo livello.

### 5. Filtri Transazioni - filtro gerarchico

- Selezionando una categoria padre, vengono incluse automaticamente tutte le sue sottocategorie
- Possibilita' di filtrare per singola sottocategoria

### 6. Dashboard e statistiche

- Le statistiche (breakdown per categoria) raggruppano per categoria padre
- Il drill-down mostra il dettaglio delle sottocategorie all'interno di ogni padre
- La card Insight mostra la categoria padre come "spesa principale"

## Dettagli tecnici

### Migrazione SQL
```text
ALTER TABLE categories
ADD COLUMN parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;
```

### File coinvolti
1. `supabase/migrations/` - nuova migrazione per `parent_id`
2. `src/integrations/supabase/types.ts` - aggiornare tipo Category
3. `src/hooks/useCategories.ts` - aggiungere `parent_id`, helper per struttura gerarchica
4. `src/hooks/useCategoryMutations.ts` - supporto `parent_id` in create/update
5. `src/components/CategoryDialog.tsx` - campo "Categoria padre" opzionale
6. `src/pages/Categories.tsx` - visualizzazione gerarchica con sottocategorie indentate
7. `src/components/TransactionDialog.tsx` - dropdown raggruppato
8. `src/components/TransactionFilters.tsx` - filtro gerarchico (padre include figli)
9. `src/hooks/useFilteredTransactions.ts` - logica filtro con sottocategorie
10. `src/hooks/useDashboardStats.ts` - raggruppamento statistiche per padre
11. `src/components/dashboard/CategoryBreakdownCard.tsx` - drill-down sottocategorie
