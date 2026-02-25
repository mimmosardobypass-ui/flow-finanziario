

# Semplificazione Selettore "Tipo File" a 2 Opzioni + Validazione Colonne

## Cosa cambia

Il selettore "Tipo file" viene ridotto a sole 2 opzioni (rimuovendo "Bancoposta" e "Manuale"). Viene aggiunta una validazione dopo il parsing che mostra un errore se le colonne richieste per il tipo selezionato non vengono trovate.

## Modifiche

### Entrambi i file: `src/pages/ImportTransazioni.tsx` e `src/components/ImportTransactionsDialog.tsx`

**1. Ridurre `FileType` e `FILE_TYPE_LABELS` a 2 opzioni**

```typescript
type FileType = "postepay-importo" | "postepay-split";

const FILE_TYPE_LABELS: Record<FileType, string> = {
  "postepay-importo": "Postepay – Importo unico",
  "postepay-split": "Postepay – Addebiti/Accrediti",
};
```

**2. Ridurre `AUTO_MAP_KEYS` a 2 voci**

Rimuovere le entry `bancoposta` e `manuale`. Lasciare invariate le keywords per `postepay-importo` e `postepay-split`.

**3. Validazione colonne mancanti in `processFile`**

Dopo l'auto-mapping, verificare che le colonne richieste per il tipo selezionato siano state trovate. Se mancano, mostrare errore e interrompere:

- Per `postepay-importo`: servono `data` + `descrizione` + `importo`
- Per `postepay-split`: servono `data` + `descrizione` + `addebiti` + `accrediti`

```typescript
// Dopo il calcolo di autoMapping:
if (ft === "postepay-importo") {
  if (!autoMapping.data || !autoMapping.descrizione || !autoMapping.importo) {
    toast({
      title: "Colonne mancanti per il formato scelto",
      description: "Servono: Data Contabile, Descrizione operazioni, Importo (euro).",
      variant: "destructive",
    });
    return;
  }
} else if (ft === "postepay-split") {
  if (!autoMapping.data || !autoMapping.descrizione || !autoMapping.addebiti || !autoMapping.accrediti) {
    toast({
      title: "Colonne mancanti per il formato scelto",
      description: "Servono: Data Contabile, Descrizione operazioni, Addebiti (euro), Accrediti (euro).",
      variant: "destructive",
    });
    return;
  }
}
```

**4. Rimuovere logica "manuale"**

- Rimuovere i blocchi condizionali `ft !== "manuale"` / `fileType === "manuale"` nella UI e nel processFile (la scansione "Data Contabile" avviene sempre)
- Semplificare i selettori colonna mostrati: per `postepay-importo` mostra data/descrizione/importo, per `postepay-split` mostra data/descrizione/addebiti/accrediti
- Rimuovere `isSplitMode` useMemo nella pagina e derivarlo direttamente da `fileType === "postepay-split"`

**5. Stato iniziale**

Il default `fileType` resta `"postepay-importo"`.

## Dettagli tecnici

| File | Modifica |
|------|----------|
| `src/pages/ImportTransazioni.tsx` | Tipo ridotto a 2, validazione colonne, rimozione logica manuale/bancoposta |
| `src/components/ImportTransactionsDialog.tsx` | Stesse modifiche |

La logica di parsing (trim header, scansione multi-sheet, calcolo importi) resta invariata.
