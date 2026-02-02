
# Piano: Sezione Comparazione Periodi Dedicata

## Obiettivo
Aggiungere una nuova sezione nella Dashboard con due selettori di periodo affiancati per confrontare liberamente qualsiasi coppia di periodi (es. Gennaio 2025 vs Luglio 2024), mostrando una tabella con i delta in euro e percentuale.

---

## Struttura Proposta

```text
+------------------------------------------------------------------+
|                    COMPARAZIONE PERIODI                           |
+------------------------------------------------------------------+
|  Periodo A                    |   Periodo B                       |
|  [Mese ▼] [Anno ▼]           |   [Mese ▼] [Anno ▼]               |
|                               |                                   |
|  Gennaio 2025                 |   Dicembre 2024                   |
+------------------------------------------------------------------+
|             | Periodo A      | Periodo B      | Delta   | %      |
+------------------------------------------------------------------+
| Entrate     | €4.010,00      | €3.200,00      | +€810   | +25%   |
| Uscite      | €914,00        | €1.100,00      | -€186   | -17%   |
| Netto       | €3.096,00      | €2.100,00      | +€996   | +47%   |
+------------------------------------------------------------------+
```

---

## Dettagli Implementazione

### 1. Nuovo Componente: `PeriodComparisonCard.tsx`

**Percorso:** `src/components/dashboard/PeriodComparisonCard.tsx`

**Funzionalita:**
- Due gruppi di select affiancati (Mese + Anno per ciascun periodo)
- I mesi disponibili dipendono dall'anno selezionato e dai dati esistenti
- Tabella di confronto con 3 metriche: Entrate, Uscite, Netto
- Delta assoluto (euro) e percentuale con colori (verde positivo, rosso negativo)
- Frecce direzionali per indicare trend

**Props:**
```typescript
interface PeriodComparisonCardProps {
  transactions: TransactionWithCategory[];
  availableYears: number[];
}
```

**State interno:**
```typescript
const [periodA, setPeriodA] = useState({ month: currentMonth, year: currentYear });
const [periodB, setPeriodB] = useState({ month: prevMonth, year: prevYear });
```

### 2. Hook di Supporto: estensione di `useDashboardStats.ts`

Aggiungere una nuova funzione helper:

```typescript
export function getMonthDateRange(month: number, year: number): DateRange {
  const date = new Date(year, month, 1);
  return {
    startDate: startOfDay(startOfMonth(date)),
    endDate: endOfDay(endOfMonth(date)),
  };
}
```

Il componente riutilizzera `usePeriodComparison` gia esistente, passando i due range calcolati.

### 3. Integrazione in Dashboard.tsx

Aggiungere la nuova card sotto le card statistiche esistenti:

```tsx
{/* Period Comparison Section */}
<PeriodComparisonCard
  transactions={transactions}
  availableYears={availableYears}
/>
```

---

## Layout della Tabella

| Metrica   | Periodo A       | Periodo B       | Delta            | Variazione % |
|-----------|-----------------|-----------------|------------------|--------------|
| Entrate   | Euro X          | Euro Y          | +/- Euro (Z)     | +/- N%       |
| Uscite    | Euro X          | Euro Y          | +/- Euro (Z)     | +/- N%       |
| Netto     | Euro X          | Euro Y          | +/- Euro (Z)     | +/- N%       |

**Colori:**
- Verde (`text-success`): delta positivo per Entrate/Netto, negativo per Uscite
- Rosso (`text-destructive`): delta negativo per Entrate/Netto, positivo per Uscite

---

## File da Creare/Modificare

| File | Azione | Descrizione |
|------|--------|-------------|
| `src/components/dashboard/PeriodComparisonCard.tsx` | Creare | Nuovo componente con selettori + tabella |
| `src/hooks/useDashboardStats.ts` | Modificare | Aggiungere `getMonthDateRange()` |
| `src/pages/Dashboard.tsx` | Modificare | Importare e posizionare il nuovo componente |

---

## Comportamento UX

1. **Default**: Periodo A = mese corrente, Periodo B = mese precedente
2. **Selezione**: Dropdown per mese (Gennaio-Dicembre) e anno
3. **Validazione**: Se un periodo non ha dati, mostrare "Nessun dato" nella cella
4. **Responsive**: Su mobile, i due selettori si impilano verticalmente

---

## Esempio Visivo Finale

La card sara posizionata dopo le 4 StatCard principali e prima dei breakdown per categoria:

```text
[Saldo Totale] [Entrate] [Uscite] [Netto]

[=== COMPARAZIONE PERIODI (nuova sezione) ===]
|  Gen 2025  vs  Dic 2024                      |
|  Entrate: €4.010 vs €3.200  (+€810, +25%)   |
|  Uscite:  €914   vs €1.100  (-€186, -17%)   |
|  Netto:   €3.096 vs €2.100  (+€996, +47%)   |

[Spese per Categoria] [Entrate per Categoria] [Insights]
```

---

## Vantaggi

- Confronto libero tra qualsiasi coppia di mesi/anni
- Vista immediata delle variazioni rispetto a periodi passati
- Analisi trend stagionali (es. Gennaio 2025 vs Gennaio 2024)
- Mantenimento della struttura esistente della dashboard
