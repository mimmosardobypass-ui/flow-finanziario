

# Invertire evidenziazione categoria nella tabella transazioni

## Modifica

Nel file `src/pages/Transactions.tsx`, nella colonna "Categoria" della tabella, invertire lo stile:

- **Categoria madre**: mostrata dentro un `Badge` (evidenziata)
- **Sottocategoria**: mostrata sotto in testo piccolo (`text-xs text-muted-foreground`)

Se la transazione ha solo una categoria padre (senza sottocategoria), viene mostrata normalmente nel Badge.

## Dettaglio tecnico

### `src/pages/Transactions.tsx`

Modificare il blocco della cella categoria (righe ~353-365): invece di mostrare il parent in `text-xs` e il figlio in `Badge`, fare il contrario. Il parent va nel `Badge` e il nome della categoria corrente (sottocategoria) va in `text-xs` sotto.

| Prima | Dopo |
|-------|------|
| Viviana (testo piccolo) | **Viviana** (Badge) |
| **Corso Cordua** (Badge) | Corso Cordua (testo piccolo) |

Un solo file da modificare.

