# Scadenziario come agenda delle scadenze

## Obiettivo
Trasformare la pagina Scadenziario in una vista operativa centrata sulle rate imminenti, mantenendo il dialog di creazione e la gestione dei contratti già esistente. Nessuna modifica al database.

## Intervento

1. **Nuovi dati agenda**
   - Creare `useScadenzeAgenda` con tipi locali per `v_scadenze_agenda` e `v_entrate_previste`.
   - Caricare solo contratti attivi, rate aperte e pagamenti degli ultimi 90 giorni, con ordinamento per data di addebito.
   - Convertire sempre i campi numerici e usare la data locale italiana.
   - Invalidare l’agenda dopo creazione/eliminazione/modifica rate e dopo tutte le operazioni sui finanziamenti richieste.

2. **Calcoli centralizzati**
   - Creare funzioni pure per KPI, gruppi temporali, sei mesi di uscite, colori conto e copertura dei saldi.
   - Considerare commissioni previste, entrate ricorrenti, saldo confermato/stimato, contanti, minimo previsto e giorno di scoperto.
   - Applicare il filtro conto a agenda, KPI e grafico, lasciando “Conti da coprire” globale.

3. **Nuova pagina Agenda**
   - Intestazione con data odierna, quattro KPI, tab Agenda/Contratti/Pagate e filtro conto persistente.
   - Gruppi Scadute, Questa settimana, Entro 30 giorni e mesi futuri espandibili.
   - Righe rate accessibili con data, contratto, conto, importo, stato e menu azioni.
   - Apertura della scheda Finanziamento per i finanziamenti; espansione del contratto per gli altri piani.
   - Riutilizzo dei dialog esistenti per collegare movimenti e segnare rate pagate secondo l’ente.

4. **Pannelli di previsione**
   - Grafico impilato dei prossimi sei mesi, interattivo e leggibile anche da tastiera.
   - Pannello di copertura per conto con mini estratto cronologico, saldo minimo/finale e avvisi Coperto, Margine stretto, Non coperto, Saldo da confermare o Contanti.
   - Legenda per date stimate e addebiti spostati dal fine settimana.

5. **Tab Contratti e Pagate**
   - Tabella contratti attivi ordinata per urgenza, con riepilogo mensile, avanzamento, residuo, prossima rata, stato, espansione rate e cancellazione.
   - Interruttore “Mostra completati” al posto della vecchia Cronologia.
   - Pagamenti degli ultimi 90 giorni raggruppati per mese e ordinati per data decrescente.

6. **Struttura e verifica**
   - Suddividere la UI nei componenti richiesti sotto `src/components/scadenziario/agenda/`.
   - Usare componenti shadcn, token semantici, modalità scura, layout mobile senza scorrimento orizzontale della pagina.
   - Verificare TypeScript e la resa desktop/mobile della pagina; l’area contratti resta l’unica con scorrimento orizzontale interno.

## Assunzioni
- I colori fissi dei conti saranno rappresentati tramite classi CSS/token dedicati, senza colorare il testo.
- “Apri contratto” per un piano non finanziario selezionerà la tab Contratti e ne aprirà la riga.
- Il link “Imposta il saldo reale” porterà alla pagina Conti, come richiesto, senza cambiare quella pagina.
