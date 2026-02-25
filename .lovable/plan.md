

# Selettore "Tipo File" per l'Importazione

## Cosa cambia

Si aggiunge un selettore "Tipo file" nella zona di upload, prima di caricare il file. In base alla selezione, il sistema applica regole di parsing e mapping diverse.

## Opzioni del selettore

| Tipo | Comportamento |
|------|--------------|
| **Postepay - Importo unico** | Cerca "Data Contabile" come header, mappa "Importo (euro)" con segno originale |
| **Postepay - Addebiti/Accrediti** | Cerca "Data Contabile" come header, mappa "Addebiti (euro)" e "Accrediti (euro)" separatamente |
| **Bancoposta** | Mapping specifico Bancoposta (da definire, stesso pattern di scansione header) |
| **Manuale** | Nessun auto-mapping, l'utente sceglie tutte le colonne manualmente |

## Flusso utente

1. L'utente vede la zona di upload con un selettore "Tipo file" sopra l'area drag-and-drop
2. Seleziona il tipo di file
3. Carica il file
4. Il sistema applica la logica corrispondente al tipo selezionato
5. Per "Manuale", tutti i selettori colonna restano vuoti e l'utente li compila

## Dettagli tecnici

### File: `src/pages/ImportTransazioni.tsx`

**1. Nuovo tipo e stato**

Aggiungere un tipo `FileType` con i 4 valori e uno stato `selectedFileType`:

```typescript
type FileType = "postepay-importo" | "postepay-split" | "bancoposta" | "manuale";
```

**2. Configurazioni per tipo**

Definire un oggetto di configurazione per ogni tipo con le keyword di auto-mapping specifiche:

- `postepay-importo`: cerca solo `importo` keywords, ignora addebiti/accrediti
- `postepay-split`: cerca solo `addebiti`/`accrediti` keywords, ignora importo
- `bancoposta`: keywords specifiche Bancoposta (stesse di Postepay come base, personalizzabili)
- `manuale`: nessun auto-mapping

**3. Modifica `processFile`**

- Riceve il `fileType` come parametro
- Tutti i tipi tranne "manuale": scansione multi-sheet per "Data Contabile" (logica esistente)
- Per "manuale": nessuna scansione header, usa prima riga come header (comportamento standard)
- Rimuovere il blocco di errore "Formato non riconosciuto" -- la validazione avviene tramite il tipo selezionato
- Per "postepay-importo": auto-mappa solo data, descrizione, importo
- Per "postepay-split": auto-mappa solo data, descrizione, addebiti, accrediti
- Per "manuale": non auto-mappa nulla

**4. UI: selettore nella zona upload**

Aggiungere un `Select` sopra l'area drag-and-drop con le 4 opzioni. Il selettore resta visibile anche dopo il caricamento del file (nell'header, accanto al conto destinazione).

**5. Mapping manuale completo**

Per il tipo "Manuale", mostrare sempre tutti e 5 i selettori colonna (data, descrizione, importo, addebiti, accrediti) cosi l'utente puo scegliere il formato che preferisce.

### File: `src/components/ImportTransactionsDialog.tsx`

Stesse modifiche applicate al dialog (usato altrove nell'app), mantenendo coerenza tra i due componenti.

