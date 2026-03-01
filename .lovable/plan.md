

# Fix: Pulsanti di conferma visibili nel pannello Riconciliazione

## Problema

Nella schermata di riconciliazione, ogni proposta ha i pulsanti Accetta (spunta) e Rifiuta (X) come piccole icone da 32x32px a destra della riga. Sono poco visibili e facilmente ignorabili dall'utente, che non riesce a trovare come confermare la scelta.

## Soluzione

Trasformare i pulsanti da piccole icone in **pulsanti con testo esplicito** posizionati sotto ogni proposta, rendendoli immediatamente riconoscibili.

## Modifica: `src/components/ReconciliationSheet.tsx`

Per ogni suggerimento, sostituire i due icon button (Check e X) con una riga di pulsanti visibili sotto i dettagli della proposta:

- **Pulsante "Riconcilia"**: verde, con icona Check + testo, variante `default` con sfondo verde
- **Pulsante "Rifiuta"**: outline/ghost, con icona X + testo, meno prominente

Layout attuale di ogni proposta:
```text
[Descrizione + Badge]  [Importo]  [icona-check] [icona-x]
```

Nuovo layout:
```text
[Descrizione + Badge]
[Conto - Data - Delta giorni]         [Importo]
[Pulsante "Riconcilia"]  [Pulsante "Rifiuta"]
```

I pulsanti saranno a larghezza piena sotto ogni card di proposta, con testo chiaro e dimensioni adeguate (h-9 invece di h-8), garantendo visibilita' immediata.

### Dettagli tecnici

- Rimuovere il `div` con `flex gap-1 shrink-0` che contiene i due icon button
- Aggiungere sotto il blocco info un `div` con `flex gap-2 mt-2`:
  - `Button` variant `default` con classe `bg-green-600 hover:bg-green-700` + icona Check + testo "Riconcilia"
  - `Button` variant `outline` + icona X + testo "Rifiuta"
- Cambiare il layout del container della proposta da `flex items-center` a `flex flex-col` per impilare info e pulsanti verticalmente

File coinvolto: solo `src/components/ReconciliationSheet.tsx`
