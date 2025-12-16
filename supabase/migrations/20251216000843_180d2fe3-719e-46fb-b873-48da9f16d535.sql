-- Enable RLS on categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Categories RLS policies
CREATE POLICY "Users can view own categories" ON public.categories
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.categories
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.categories
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.categories
FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on transactions table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions RLS policies
CREATE POLICY "Users can view own transactions" ON public.transactions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
FOR DELETE USING (auth.uid() = user_id);

-- Create seed function for new users
CREATE OR REPLACE FUNCTION public.seed_user_data(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_stipendio uuid;
  cat_freelance uuid;
  cat_abitazione uuid;
  cat_alimentari uuid;
  cat_trasporti uuid;
  cat_utenze uuid;
BEGIN
  -- Only seed if user has no categories
  IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_uuid) THEN
    -- Insert default categories
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Stipendio', 'income') RETURNING id INTO cat_stipendio;
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Freelance', 'income') RETURNING id INTO cat_freelance;
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Investimenti', 'income');
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Abitazione', 'expense') RETURNING id INTO cat_abitazione;
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Alimentari', 'expense') RETURNING id INTO cat_alimentari;
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Trasporti', 'expense') RETURNING id INTO cat_trasporti;
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Utenze', 'expense') RETURNING id INTO cat_utenze;
    INSERT INTO categories (user_id, name, type) VALUES
      (user_uuid, 'Intrattenimento', 'expense');
    
    -- Insert sample transactions
    INSERT INTO transactions (user_id, description, amount, type, date, category_id) VALUES
      (user_uuid, 'Stipendio Dicembre', 2500, 'income', CURRENT_DATE - 5, cat_stipendio),
      (user_uuid, 'Progetto freelance', 450, 'income', CURRENT_DATE - 8, cat_freelance),
      (user_uuid, 'Affitto', 800, 'expense', CURRENT_DATE - 4, cat_abitazione),
      (user_uuid, 'Spesa settimanale', 120, 'expense', CURRENT_DATE - 3, cat_alimentari),
      (user_uuid, 'Benzina', 65, 'expense', CURRENT_DATE - 2, cat_trasporti),
      (user_uuid, 'Bolletta luce', 95, 'expense', CURRENT_DATE - 1, cat_utenze);
  END IF;
END;
$$;