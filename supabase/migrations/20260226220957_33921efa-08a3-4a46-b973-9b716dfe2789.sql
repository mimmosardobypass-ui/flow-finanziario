
-- Reset: delete all non-dismissed suggestions (will be regenerated with stricter algorithm)
DELETE FROM reconciliation_suggestions WHERE dismissed = false;

-- Reset all 'suggested' transactions back to 'none' (clean slate)
UPDATE transactions SET reconciliation_status = 'none' WHERE reconciliation_status = 'suggested';
