

# Escludere i giroconti dalle statistiche

## Obiettivo

Le transazioni che rappresentano trasferimenti interni tra conti (giroconti) non devono essere conteggiate come entrate o uscite nelle statistiche della dashboard e nei report. Sono movimenti interni che non cambiano il patrimonio complessivo.

## Criteri di esclusione

Una transazione e' un giroconto interno se:
- Ha un `transfer_id` (creata tramite la funzione Trasferimento), oppure
- Ha `reconciliation_type = "transfer"` con `reconciliation_status = "reconciled"` (riconciliata manualmente come giroconto)

## Modifiche

### 1. Hook statistiche dashboard (`src/hooks/useDashboardStats.ts`)

Aggiungere una funzione helper `isInternalTransfer(t)` che verifica i due criteri sopra. Usarla per:

- **Saldo totale**: continuare a conteggiare tutto (il saldo dei conti deve rimanere corretto)
- **Entrate/Uscite di periodo**: escludere i giroconti dal calcolo di `periodIncome` e `periodExpenses`
- **Breakdown per categoria**: escludere i giroconti
- **Insights** (tasso risparmio, spesa media giornaliera): derivano dai totali, quindi si aggiornano automaticamente

### 2. Confronto periodi (`usePeriodComparison` nello stesso file)

Applicare lo stesso filtro `isInternalTransfer` nel calcolo delle entrate/uscite del periodo corrente e precedente.

### 3. Export Excel (`src/utils/exportExcel.ts`)

Aggiungere una colonna "Giroconto" (Si/No) nel foglio transazioni, e nel riepilogo mostrare separatamente il totale dei giroconti esclusi dalle statistiche, per trasparenza.

### 4. Indicatore visivo nella lista transazioni (`src/pages/Transactions.tsx`)

Le transazioni con `transfer_id` hanno gia' il badge "Trasf." - verificare che anche quelle riconciliate come giroconto mostrino un indicatore simile (gia' presente il badge del tipo di riconciliazione).

## Comportamento atteso

- Dashboard: entrate e uscite riflettono solo operazioni reali (stipendi, bollette, acquisti...)
- Saldo totale: invariato (i giroconti si annullano tra loro)
- Export: i giroconti sono presenti ma segnalati come tali
- Transazioni gia' riconciliate come "transfer": escluse retroattivamente dalle statistiche

## File coinvolti

1. `src/hooks/useDashboardStats.ts` - filtro principale
2. `src/utils/exportExcel.ts` - colonna giroconto e riepilogo
3. `src/hooks/useTransactions.ts` - aggiungere i campi `reconciliation_type` e `reconciliation_status` al tipo `TransactionWithCategory` se non presenti
