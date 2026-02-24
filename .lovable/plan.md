

# Miglioramento Modale "Nuovo Contratto"

## Modifiche pianificate

### 1. Validazione completa prima del salvataggio

Aggiungere controlli espliciti per tutti i campi obbligatori (`numero_contratto`, `societa_finanziaria`, `tipo`, `numero_rate`, `importo_totale`) con messaggi di errore specifici per campo.

### 2. Tipo con opzione "Altro..." personalizzabile

Quando si seleziona "Altro" nella select Tipo, comparira un campo di testo aggiuntivo "Tipo personalizzato". Il valore digitato verra salvato direttamente nella colonna `tipo` del DB (es. "noleggio" invece di "altro").

### 3. Placeholder chiari

- Numero Contratto: "Es. 12345ABC"
- Societa Finanziaria: "Es. Compass"
- Importo Totale: "Es. 5000.00"
- Numero Rate: "Es. 12"
- Tipo personalizzato: "Es. Noleggio"

### 4. Autocomplete Societa Finanziaria

Aggiungere una query che recupera le societa gia usate dall'utente (distinct `societa_finanziaria` dalla tabella `scadenziario`). Mostrare i suggerimenti in un datalist HTML nativo sotto l'input, senza librerie aggiuntive.

### 5. Espansione contratto appena creato

Dopo il salvataggio, il dialog si chiude e la pagina `Scadenziario.tsx` espande automaticamente la riga del contratto appena creato. Per farlo:
- `useCreateScadenziario` restituisce gia il contratto creato
- `ScadenziarioDialog` ricevera un callback `onCreated(id: string)`
- `Scadenziario.tsx` impostera `expandedId` con l'id ricevuto

### 6. Messaggio errore leggibile

Il blocco catch mostrera il messaggio di errore dal server quando disponibile, con fallback generico.

---

## Dettagli tecnici

### File: `src/hooks/useScadenziario.ts`

Aggiungere hook `useSocietaSuggestions`:
```typescript
export function useSocietaSuggestions() {
  // SELECT DISTINCT societa_finanziaria FROM scadenziario WHERE user_id = auth.uid()
}
```

### File: `src/components/scadenziario/ScadenziarioDialog.tsx`

- Aggiungere stato `tipoCustom` per il campo personalizzato
- Aggiungere stato `errors` per validazione inline
- Aggiungere logica: se `tipo === "altro_custom"` mostra input, al salvataggio usa `tipoCustom` come valore
- Aggiungere `datalist` con societa suggerite collegato all'input
- Prop `onCreated?: (id: string) => void`
- Placeholder su tutti gli input

### File: `src/pages/Scadenziario.tsx`

- Passare callback `onCreated` al dialog per espandere il contratto appena creato
- Aggiornare `tipoLabels` per gestire valori custom (fallback al valore grezzo se non presente nelle label note)

