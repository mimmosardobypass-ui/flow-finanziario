# Card Andamento nella pagina Finanziamenti

## Obiettivo
Sostituire l’attuale grafico “Impegno mensile nei prossimi 24 mesi” con una sola card “Andamento”, collocata tra i filtri e l’elenco contratti, coordinata con i filtri Per/Stato e leggibile sia come grafico sia come tabella.

## Intervento

1. **Dati e coerenza contabile**
   - Riutilizzare le rate non pagate già caricate da `scadenze_rate` e i contratti da `v_finanziamenti`, senza modifiche al database.
   - Estendere i dati delle rate solo quanto serve per distinguere contratto, piano stimato e scadenze arretrate.
   - Applicare gli stessi filtri Per/Stato dell’elenco contratti prima di costruire grafico, riepiloghi e tabella.
   - Nel mese corrente sommare sia le rate del mese sia tutte le rate non pagate già scadute, mantenendo separato il subtotale “già scaduti” per il tooltip.

2. **Calcoli dell’andamento**
   - Creare funzioni pure per intervalli 12/24/36 mesi e Tutto, aggregazioni mensili/annuali, totali, media, mesi coperti e punti in cui l’impegno cambia.
   - “Tutto” partirà dal mese corrente e terminerà al mese dell’ultima rata dei contratti filtrati.
   - Ordinare stabilmente i contratti per debito residuo decrescente; assegnare i primi otto colori per id e raggruppare gli altri nella serie grigia “Altri”.

3. **Vista Grafico**
   - Creare una card dedicata con titolo, sottotitolo dinamico, selettore Grafico/Tabella e controllo Periodo.
   - Mostrare barre impilate compatte, griglia continua, asse Y con valori arrotondati, asse X diradato, tooltip completo e legenda permanente.
   - Evidenziare sopra le colonne i totali dei mesi in cui l’impegno cambia; il comando “Importo su ogni mese” aggiungerà gli altri totali solo quando lo spazio lo consente.
   - Disabilitare automaticamente quel comando nei periodi troppo densi, spiegandone il motivo nell’etichetta.

4. **Vista Tabella**
   - Generare i pulsanti anno dai dati realmente presenti, più “Tutti gli anni”.
   - Per un singolo anno mostrare una riga per mese, una colonna per serie e i totali finali; evidenziare i mesi in cui l’impegno cambia.
   - Per tutti gli anni mostrare una riga aggregata per anno, il numero di mesi e il totale complessivo.
   - Mantenere importi allineati a destra con cifre tabulari e celle vuote indicate da un trattino.

5. **Integrazione e pulizia**
   - Inserire la card sotto i filtri e rimuovere il vecchio grafico dal pannello inferiore, lasciando lì solo “In scadenza nei prossimi 30 giorni”.
   - Definire i colori richiesti come token del tema e usarli solo per pallini e segmenti, mai per il testo.
   - Verificare il controllo TypeScript e la resa della card nei principali intervalli e filtri.

## Assunzioni
- Con Stato “Estinti” il grafico sarà vuoto, perché la fonte richiesta comprende esclusivamente rate non pagate di contratti attivi.
- La media mensile sarà il totale del periodo diviso per il numero di mesi visualizzati, inclusi gli eventuali mesi senza rate.
