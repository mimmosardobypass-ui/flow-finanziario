# Sezione "Smartphone" — carichi, prezzi previsti, vendite e marginalità

Tutto nuovo e additivo: nessuna tabella, pagina o funzione esistente viene modificata, salvo la voce di menu e la route.

## 1. Database (una sola migrazione)

Quattro tabelle nuove, ciascuna con `user_id`, GRANT a `authenticated` + `service_role`, RLS attiva e 4 policy "solo i propri dati" (`auth.uid() = user_id`), come le tabelle esistenti.

**smartphone_documenti**
- id, user_id, tipo text, numero text, data_documento date, nome_file text, created_at
- UNIQUE (user_id, numero, data_documento) — blocca i doppioni anche lato database

**smartphone_articoli**
- id, user_id, documento_id → documenti (ON DELETE CASCADE), marca, codice_articolo, modello, descrizione, categoria text, costo_unitario numeric(12,2) NOT NULL, aliquota_iva numeric (solo memorizzata), prezzo_previsto numeric(12,2) NULL, created_at, updated_at
- categoria validata da trigger su ('Smartphone','Accessorio','Cellulare','Altro'); costo_unitario >= 0, prezzo_previsto >= 0
- indice (user_id, codice_articolo, created_at desc) per proporre l'ultimo prezzo previsto

**smartphone_pezzi**
- id, user_id, articolo_id → articoli (CASCADE), documento_id → documenti (CASCADE), imei text NULL, stato text default 'disponibile' ('disponibile'|'venduto'), created_at
- indice univoco parziale (user_id, imei) dove imei non nullo

**smartphone_vendite**
- id, user_id, pezzo_id UNIQUE → pezzi (CASCADE), data_vendita date, prezzo_vendita numeric(12,2) NOT NULL, prezzo_previsto_al_momento numeric(12,2) NULL, imei text NULL, created_at
- Trigger AFTER INSERT → pezzo 'venduto' (e copia l'IMEI sul pezzo se fornito); AFTER DELETE → pezzo 'disponibile'. Così lo stato resta coerente anche se qualcosa fallisce lato app.

**Funzioni RPC (security definer, controllo `p_user_id = auth.uid()`)**
- `smartphone_importa_documento(p_user_id, p_documento jsonb, p_articoli jsonb)` — in un'unica transazione: verifica doppione (errore chiaro in italiano), crea documento, articoli e N pezzi per quantità. Evita import a metà.
- `smartphone_registra_vendita(p_user_id, p_pezzo_id, p_data, p_prezzo, p_imei)` — verifica che il pezzo sia disponibile e salva lo snapshot del prezzo previsto.
- Eliminazione vendita: delete diretto (il trigger rimette il pezzo disponibile).

Dopo la migrazione i tipi Supabase vengono rigenerati automaticamente.

## 2. Lettura del file (.xls HTML o Excel vero)

File `src/lib/smartphone/parserCarico.ts` (funzioni pure, testabili):
1. `file.text()`; se dopo trim/BOM inizia con `<` → `DOMParser` (`text/html`), prima `<table>`; altrimenti `file.arrayBuffer()` + `xlsx` (già installata) con `sheet_to_json({header:1})`.
2. Riga titolo: regex `/^(.*?)\s*-\s*N\.doc\.\s*(\S+)\s+del\s+(\d{2}\/\d{2}\/\d{4})/i` → tipo, numero, data. Se manca, l'anteprima chiede numero e data.
3. Colonne mappate per nome intestazione normalizzato (Marca, Id univoco articolo, Modello, Descrizione, Quantità, Valore, Importo, Iva), non per posizione.
4. Pulizia: rimozione U+200B–U+200D, U+FEFF, U+00A0 → spazio, spazi multipli; ogni correzione registrata nel box "Sistemato in automatico".
5. Numeri italiani con `parseImporto` già esistente (ha le regole virgola/punto corrette).
6. Costo unitario = **Valore**; Importo usato solo come controllo (segnala se ≠ quantità × valore).
7. Marca: maiuscolo, confronto senza spazi ("REAL ME" = "REALME" → forma senza spazi).
8. Raggruppamento per codice + costo: somma quantità, segnala "N righe identiche nel file – conferma che sono N pezzi".
9. Categoria proposta da parole chiave (Accessorio / Cellulare / Smartphone), modificabile.
10. Prima di importare: controllo doppione via query, poi conferma via RPC (doppio controllo). Ultimo prezzo previsto per codice letto da `smartphone_articoli`.

## 3. File da creare

- `src/pages/Smartphone.tsx` — 6 schede (Tabs shadcn), stato della scheda in URL `?tab=` e `?pezzo=` per il pulsante Vendi.
- `src/hooks/useSmartphone.ts` — query (documenti, articoli, pezzi, vendite), mutation (importa, aggiorna prezzo previsto, registra/elimina vendita) con invalidazione `['smartphone']`.
- `src/lib/smartphone/calcoli.ts` — utile, ricarico, margine, totali (sempre sui totali, mai media delle percentuali), aggregazioni per documento/marca/modello/mese, rientro del capitale, scomposizione differenza, estrazione modello senza colore.
- `src/lib/smartphone/formato.ts` — `fmtEur` (riuso), `fmtPct` "12,3%", punti "±1,2 pt".
- `src/lib/smartphone/esporta.ts` — export Excel con `xlsx`.
- `src/components/smartphone/`: `TabImporta`, `TabMagazzino`, `TabVendi`, `TabRiepilogo`, `TabDocumenti`, `DettaglioDocumento`, `TabStatistiche`, `TabellaGestionale` (tabella con fascia blu, righe alternate, riga totali blu), `Segmentato` (pulsanti uniti), `Riquadro` (KPI senza colori semaforo), `CampoPrezzo`.
- Test: `src/lib/smartphone/*.test.ts` per parser (esempio HTML fornito), numeri italiani, raggruppamento doppioni, formule e totali.

Modifiche minime a file esistenti: `AppSidebar.tsx` (voce "Smartphone" tra Fatture Fornitori e Bilancio), `App.tsx` (route `/smartphone` protetta con Layout), `src/index.css` (classi per la tabella gestionale con token esistenti).

## 4. Schede (sintesi)

Importa, Magazzino, Vendi, Riepilogo, Documenti (con dettaglio: Previsto/Realizzato/Residuo, avanzamento, rientro capitale, "Da dove viene la differenza", grafico a gradini recharts con linea tratteggiata), Statistiche (periodo con frecce e scorciatoie, filtro categoria, barre per mese cliccabili, drill-down Marca → Modelli → vendite con percorso, ordinamento, filtri per colonna, "Totale" e "Totale senza filtri") — esattamente come descritto nella richiesta. Testi in italiano, formato 1.234,56 € e 12,3%, nessun semaforo, tabelle con scroll orizzontale su schermi stretti.

## 5. Librerie

Solo quelle già presenti: `xlsx`, `recharts`, `date-fns`, shadcn/ui, `lucide-react` (icona `Smartphone`). `DOMParser` è del browser. Nessuna nuova dipendenza.

## 6. Possibili conflitti / note

- **Colori**: la regola del progetto prevede verde entrate / rosso uscite; in questa sezione, come richiesto, non userò colori semaforo — numeri negativi solo con il segno "−".
- **Icona `Smartphone`** è già usata nella pagina Conti per i conti POS: solo un'omonimia visiva, nessun conflitto tecnico.
- **Nessun legame con transazioni/conti/categorie**: le vendite non generano movimenti contabili e non toccano Dashboard e Bilancio. Se in futuro vorrai collegarle, sarà un passo separato.
- **IMEI**: univoco per utente solo se compilato.
- **Eliminazione documento**: non prevista dalla richiesta; il CASCADE la rende possibile in futuro senza orfani.
- **Doppioni con stesso codice ma costo diverso** nello stesso file restano righe articolo separate.
