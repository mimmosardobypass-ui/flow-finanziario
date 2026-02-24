
-- Migrazione: Rinomina "Conto Principale" in "Cassa"
-- Sicura e idempotente

-- Step 1: Rinomina "Conto Principale" in "Cassa" dove non esiste già un conto "Cassa" per lo stesso utente
UPDATE conti
SET nome_conto = 'Cassa'
WHERE nome_conto = 'Conto Principale'
  AND NOT EXISTS (
    SELECT 1 FROM conti c2
    WHERE c2.user_id = conti.user_id
      AND c2.nome_conto = 'Cassa'
  );

-- Step 2: Per utenti che hanno sia "Conto Principale" che "Cassa",
-- sposta le transazioni dal "Conto Principale" al "Cassa" esistente
UPDATE transactions
SET conto_id = (
  SELECT c2.id FROM conti c2
  WHERE c2.user_id = transactions.user_id
    AND c2.nome_conto = 'Cassa'
)
WHERE conto_id IN (
  SELECT cp.id FROM conti cp
  WHERE cp.nome_conto = 'Conto Principale'
    AND EXISTS (
      SELECT 1 FROM conti c3
      WHERE c3.user_id = cp.user_id
        AND c3.nome_conto = 'Cassa'
    )
);

-- Step 3: Elimina i "Conto Principale" rimasti (ormai senza transazioni)
DELETE FROM conti
WHERE nome_conto = 'Conto Principale'
  AND EXISTS (
    SELECT 1 FROM conti c2
    WHERE c2.user_id = conti.user_id
      AND c2.nome_conto = 'Cassa'
  );
