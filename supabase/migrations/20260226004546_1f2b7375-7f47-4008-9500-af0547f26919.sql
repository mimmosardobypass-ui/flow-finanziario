
-- Create reconciliation_suggestions table
CREATE TABLE public.reconciliation_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  source_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  candidate_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed boolean NOT NULL DEFAULT false,
  UNIQUE(source_transaction_id, candidate_transaction_id)
);

-- Enable RLS
ALTER TABLE public.reconciliation_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own suggestions"
  ON public.reconciliation_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suggestions"
  ON public.reconciliation_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestions"
  ON public.reconciliation_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggestions"
  ON public.reconciliation_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Update existing reconciliation_status values: convert partial/complete to reconciled
UPDATE public.transactions
SET reconciliation_status = 'reconciled'
WHERE reconciliation_status IN ('partial', 'complete');

-- Create index for fast lookups
CREATE INDEX idx_recon_suggestions_source ON public.reconciliation_suggestions(source_transaction_id) WHERE NOT dismissed;
CREATE INDEX idx_recon_suggestions_candidate ON public.reconciliation_suggestions(candidate_transaction_id) WHERE NOT dismissed;
CREATE INDEX idx_transactions_recon_status ON public.transactions(reconciliation_status) WHERE deleted_at IS NULL;
