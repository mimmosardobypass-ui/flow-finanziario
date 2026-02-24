
-- 1. Create conti table
CREATE TABLE public.conti (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome_conto text NOT NULL,
  banca text,
  saldo_iniziale numeric NOT NULL DEFAULT 0,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conti ENABLE ROW LEVEL SECURITY;

-- RLS policies for conti
CREATE POLICY "Users can view own conti" ON public.conti FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conti" ON public.conti FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conti" ON public.conti FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conti" ON public.conti FOR DELETE USING (auth.uid() = user_id);

-- 2. Add conto_id column to transactions (nullable initially)
ALTER TABLE public.transactions ADD COLUMN conto_id uuid;

-- 3. Create a "Conto Principale" for every user that has transactions
INSERT INTO public.conti (user_id, nome_conto, banca, saldo_iniziale, attivo)
SELECT DISTINCT user_id, 'Conto Principale', NULL, 0, true
FROM public.transactions
WHERE user_id NOT IN (SELECT user_id FROM public.conti);

-- 4. Update existing transactions to link to the user's Conto Principale
UPDATE public.transactions t
SET conto_id = c.id
FROM public.conti c
WHERE t.user_id = c.user_id
  AND c.nome_conto = 'Conto Principale'
  AND t.conto_id IS NULL;

-- 5. Make conto_id NOT NULL and add FK
ALTER TABLE public.transactions
  ALTER COLUMN conto_id SET NOT NULL,
  ADD CONSTRAINT transactions_conto_id_fkey FOREIGN KEY (conto_id) REFERENCES public.conti(id);
