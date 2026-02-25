
ALTER TABLE public.transactions
ADD COLUMN reconciliation_id uuid DEFAULT NULL,
ADD COLUMN reconciliation_status text NOT NULL DEFAULT 'none';
