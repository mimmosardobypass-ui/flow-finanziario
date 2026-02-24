

# Aggiunta colonna "Conto" alla tabella Transazioni

## Cosa cambia

Una singola modifica al file `src/pages/Transactions.tsx`: aggiungere la colonna "Conto" tra "Data" e "Categoria" sia nell'header che nelle righe della tabella.

## Dettagli

- **Header**: aggiungere `<TableHead>Conto</TableHead>` dopo la colonna "Data"
- **Righe**: aggiungere una `<TableCell>` che mostra `transaction.conti?.nome_conto || "Conto Principale"`
- Il join con la tabella `conti` e gia presente nelle query (`useFilteredTransactions` e `useTransactions` includono gia `conti (id, nome_conto, banca)` nella select), quindi nessuna modifica lato dati
- La colonna sara sempre visibile, anche con filtro conto attivo
- Nessun impatto sulle performance: i dati sono gia caricati

## File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Transactions.tsx` | Aggiungere colonna "Conto" nell'header e nelle righe della tabella (2 punti di modifica) |

