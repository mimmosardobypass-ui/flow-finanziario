

# Fix build error + Pagina Bilancio rivista

## 1. Fix errore TypeScript

Nel file `src/pages/Transactions.tsx` riga 84, cambiare `NodeJS.Timeout` in `ReturnType<typeof setTimeout>` per risolvere l'errore `Cannot find namespace 'NodeJS'`.

## 2. Pagina Bilancio - mockup corretto

La pagina mostra solo **categorie e sottocategorie** con i relativi totali, senza codici piano dei conti.

```text
┌──────────────────────────────┬──────────────────────────────┐
│          USCITE              │          ENTRATE             │
├──────────────────────────────┼──────────────────────────────┤
│                              │                              │
│ Affitto              1.200   │ Stipendio            3.000   │
│   Casa                 800   │   Netto              2.500   │
│   Ufficio              400   │   Bonus                500   │
│                              │                              │
│ Alimentari             650   │ Investimenti           800   │
│   Supermercato         500   │   Dividendi            800   │
│   Ristorante           150   │                              │
│                              │                              │
│ Trasporti              320   │ Freelance              600   │
│   Benzina              200   │   Consulenze           400   │
│   Abbonamento          120   │   Progetti             200   │
│                              │                              │
├──────────────────────────────┼──────────────────────────────┤
│ Totale Uscite        2.170   │ Totale Entrate       4.400   │
└──────────────────────────────┴──────────────────────────────┘
                   Utile/Perdita: +2.230
```

- **Categoria madre** in grassetto con totale aggregato
- **Sottocategorie** indentate sotto in testo normale
- Filtri periodo (mese, trimestre, anno, personalizzato) e conto in alto
- Esportazione PDF

## File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/Transactions.tsx` | Fix `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| `src/components/AppSidebar.tsx` | Aggiungere voce "Bilancio" con icona `Scale` |
| `src/pages/Bilancio.tsx` | Nuovo file - pagina bilancio a due colonne |
| `src/App.tsx` | Aggiungere rotta `/bilancio` |

