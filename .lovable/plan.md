

# Fix: Contenuto delle proposte tagliato a destra nel pannello Riconciliazione

## Problema

Il pannello di riconciliazione ha larghezza sufficiente (`sm:max-w-2xl`), ma il contenuto interno delle card di proposta trabocca oltre il bordo destro. Le descrizioni con codici TRN lunghi spingono l'importo fuori dalla vista. Il `pr-4` sulla ScrollArea non e' sufficiente e la struttura `flex items-center` con `whitespace-nowrap` sull'importo causa l'overflow.

## Soluzione

Due interventi su `src/components/ReconciliationSheet.tsx`:

1. **Aggiungere `overflow-hidden`** al contenitore principale del contenuto per evitare traboccamento orizzontale.

2. **Riorganizzare il layout delle card di proposta**: spostare l'importo su una riga separata sotto la descrizione (accanto al conto e alla data), invece di tenerlo sulla stessa riga della descrizione lunga. In questo modo:
   - La descrizione puo' usare `truncate` correttamente sulla larghezza intera
   - L'importo e' sempre visibile sotto, allineato a destra
   - I badge restano sulla riga della descrizione

### Dettagli tecnici

**Riga 129**: Aggiungere `overflow-hidden` al `SheetContent`:
```
<SheetContent className="w-full sm:max-w-2xl overflow-hidden">
```

**Righe 223-274**: Riorganizzare la struttura della card proposta:
- Rimuovere il `flex items-center gap-3` wrapper esterno che mette descrizione e importo affiancati
- La descrizione (con `truncate`) occupa tutta la larghezza
- Sotto, una riga con conto/data a sinistra e importo a destra (`flex justify-between`)

Layout risultante per ogni proposta:
```text
[Descrizione troncata...]  [Badge Giroconto] [150pt]
[Conto · Data · Delta]                    [+€100,00]
[Pulsante Riconcilia]  [Pulsante Rifiuta]
```

File coinvolto: solo `src/components/ReconciliationSheet.tsx`
