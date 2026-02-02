
Obiettivo: rendere i calcoli della Dashboard “coerenti e verificabili” (stessi dati = stessi totali ovunque) e poi aggiungere interattività (drill-down, confronto periodi, insight), senza cambiare il modello dati.

## 1) Analisi della causa “card non allineate” (audit logico)
Dalla tua segnalazione e dal codice attuale (`src/pages/Dashboard.tsx`) ci sono 3 punti che possono generare disallineamenti percepiti o reali:

1. **Transazioni senza categoria**
   - Oggi i totali “Entrate/Uscite” includono tutto.
   - I box “per Categoria” conteggiano solo se `t.categories` esiste:
     ```ts
     if (t.categories) { ... }
     ```
   - Risultato: se esistono movimenti con `category_id = null` (anche in altri periodi o nel “Personalizzato”), i totali e i breakdown divergono.

2. **Gestione date con `new Date(t.date)` + custom range**
   - `t.date` arriva come stringa `YYYY-MM-DD` (campo Postgres `date`).
   - `new Date("YYYY-MM-DD")` in JS è interpretato come UTC; può spostare il giorno in locale e creare effetti ai bordi.
   - Nel periodo **custom** oggi `endDate = customDateRange.to` è mezzanotte: rischi di **escludere** tutte le transazioni dell’ultimo giorno (perché `txDate` può risultare > endDate). Questo può far “saltare” allineamenti (soprattutto con “Personalizzato”).

3. **Chiavi React nei breakdown**
   - In “Entrate/Spese per Categoria” usiamo `key={item.name}`. Se due categorie avessero lo stesso nome (o in futuro succede), React può riutilizzare nodi e visualizzare importi in modo incoerente.
   - Anche se non è sempre la causa principale, è un bug potenziale che va eliminato.

## 2) Correzioni per allineare i calcoli (coerenza matematica)
### 2.1 Normalizzare le date in modo consistente
- Sostituire `new Date(t.date)` con `parseISO(t.date)` (date-fns), così la data viene interpretata in modo “date-only” coerente in locale.
- Normalizzare il range:
  - `startDate = startOfDay(...)`
  - `endDate = endOfDay(...)` (specialmente per il custom)
- Questo elimina gli errori ai bordi e rende coerenti:
  - Card
  - Breakdown per categoria
  - Grafico

### 2.2 Derivare una sola fonte per “periodTransactions”
Invece di ripetere logiche “a pezzi”:
- creare `periodTransactions = transactions.filter(isInPeriod)`
- poi calcolare tutto SOLO da `periodTransactions`:
  - periodIncome, periodExpenses, netSavings
  - spendingByCategory, incomeByCategory
  - recentTransactions (opzionale: del periodo o globali)
Questo garantisce che **la somma dei breakdown = totale card** (salvo arrotondamenti percentuali).

### 2.3 Inserire “Senza categoria” nei breakdown
- Aggiungere due accumulatori:
  - `uncategorizedIncome`
  - `uncategorizedExpenses`
- Se `t.categories` è null, sommare lì.
- In output, aggiungere una riga “Senza categoria” ai breakdown quando > 0.
- (Bonus UX) mostrare un badge/alert “Hai X movimenti senza categoria” con link a Transazioni filtrate per “Senza categoria”.

### 2.4 Sistemare le keys e includere l’id categoria
- Nei totali per categoria, mantenere anche `id` (catId) nel dato aggregato.
- Usare `key={item.id}` (e per “Senza categoria” una key fissa tipo `"uncategorized-income"`).

### 2.5 Rendere verificabili i totali sotto ogni card “per categoria”
Sotto la lista:
- “Totale entrate nel periodo: €X”
- “Totale uscite nel periodo: €Y”
Così l’utente vede immediatamente che la somma torna.

## 3) Dashboard più interattiva (drill-down e controlli)
### 3.1 Click-to-filter: dalla Dashboard alle Transazioni
Rendere cliccabili:
- Card “Entrate”, “Uscite”, “Netto” (porta a `/transactions?type=income|expense&dateFrom=...&dateTo=...`)
- Ogni riga categoria (porta a `/transactions?type=income|expense&categoryId=...&dateFrom=...&dateTo=...`)
- Riga “Senza categoria” (porta a `/transactions?...&categoryId=uncategorized`)
Per farlo bene:
- Aggiornare `src/pages/Transactions.tsx` per leggere querystring con `useSearchParams` e inizializzare `filters` da URL.
- In `useFilteredTransactions`, gestire `categoryId=uncategorized` traducendolo in `category_id IS NULL` (query supabase con `.is("category_id", null)`).

### 3.2 “Recenti” più sensati
Attualmente “Transazioni Recenti” mostra le ultime 5 globali, non del periodo selezionato.
Proposta interattiva:
- Toggle: “Recenti nel periodo” / “Recenti (tutte)”
- Default: “nel periodo”, per coerenza con le altre card.

## 4) Dashboard più completa (senza complicare troppo)
### 4.1 Confronto col periodo precedente (KPI professionali)
Per ciascuna card:
- Entrate periodo vs periodo precedente (es. “Questo mese” vs “Mese scorso”)
- Uscite vs periodo precedente
- Netto vs periodo precedente
Mostrare:
- delta € e % (con freccia su/giù)
Questo rende la dashboard molto più “contabilità aziendale”.

### 4.2 “Insight” automatici (box a destra o sotto)
Esempi:
- “Categoria spesa principale del periodo”
- “Categoria entrata principale”
- “Savings rate” = netto / entrate
- “Spesa media giornaliera” (nel periodo)
- “Giorno con spesa massima”

### 4.3 Grafico: opzioni di visualizzazione
Mantenere il line chart attuale ma aggiungere:
- Toggle “Saldo cumulato” (cumulative net nel periodo) oltre a saldo giornaliero/mensile
- Tooltip più ricco (entrate, uscite, netto del punto, saldo cumulato)
- (Opzionale) click su un punto del grafico => apre Transazioni filtrate per quel giorno/mese

## 5) File coinvolti (stima intervento)
- `src/pages/Dashboard.tsx`
  - normalizzazione date (parseISO + startOfDay/endOfDay)
  - periodTransactions
  - uncategorized rows
  - totals “verificabili”
  - click handlers verso /transactions
  - toggle recenti
  - (fase 2) confronto periodo precedente + insight + opzioni grafico
- `src/pages/Transactions.tsx`
  - leggere querystring e inizializzare `filters`
  - aggiornare URL quando i filtri cambiano (opzionale ma consigliato)
- `src/hooks/useFilteredTransactions.ts`
  - supporto `categoryId=uncategorized` => `.is("category_id", null)`

## 6) Verifica (checklist)
1. Seleziono “Questo mese”: Entrate card = somma righe “Entrate per Categoria” (incluso “Senza categoria” se presente).
2. Seleziono “Personalizzato” includendo l’ultimo giorno: le transazioni dell’ultimo giorno vengono conteggiate (fix endOfDay).
3. Clic su una categoria => vado in Transazioni già filtrate e i totali corrispondono.
4. Se esistono transazioni senza categoria in qualsiasi periodo: compaiono nei breakdown e non “spariscono”.
5. (Se implementato) confronto con periodo precedente coerente e stabile.

## Suggerimenti feature (prossimi step utili per uso “aziendale”)
<lov-actions>
  <lov-suggestion message="Aggiungi Budget per Categoria (mensile) con barra avanzamento e alert quando superi una soglia; salva i budget su Supabase e mostra scostamento nella Dashboard.">Budget per Categoria</lov-suggestion>
  <lov-suggestion message="Implementa transazioni ricorrenti (affitti, stipendi, abbonamenti) con generazione automatica mensile e possibilità di sospendere/modificare la ricorrenza.">Transazioni Ricorrenti</lov-suggestion>
  <lov-suggestion message="Aggiungi report 'Chiusura Mensile' con lock del periodo (nessuna modifica oltre la chiusura) e PDF/Excel dedicato.">Chiusura Mensile</lov-suggestion>
  <lov-suggestion message="Crea un 'Centro di Costo' (progetto/commessa) da associare alle transazioni, con dashboard e report per centro di costo.">Centri di Costo</lov-suggestion>
  <lov-suggestion message="Aggiungi regole automatiche di categorizzazione (es. se descrizione contiene 'POS' => categoria Incasso POS) con anteprima e applicazione batch.">Regole Auto-Categoria</lov-suggestion>
</lov-actions>
