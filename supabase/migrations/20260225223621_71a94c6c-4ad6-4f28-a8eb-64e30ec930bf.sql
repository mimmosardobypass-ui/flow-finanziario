
-- Fix INPUT_VALIDATION: Add CHECK constraints for data integrity
ALTER TABLE transactions ADD CONSTRAINT check_amount_positive CHECK (amount > 0);
ALTER TABLE transactions ADD CONSTRAINT check_description_length CHECK (description IS NULL OR length(description) <= 500);
ALTER TABLE transactions ADD CONSTRAINT check_type_valid CHECK (type IN ('income', 'expense'));

ALTER TABLE categories ADD CONSTRAINT check_name_length CHECK (length(name) <= 100);
ALTER TABLE categories ADD CONSTRAINT check_type_valid CHECK (type IN ('income', 'expense'));

ALTER TABLE scadenziario ADD CONSTRAINT check_importo_positive CHECK (importo_totale > 0);
ALTER TABLE scadenziario ADD CONSTRAINT check_numero_rate_positive CHECK (numero_rate > 0);

ALTER TABLE scadenze_rate ADD CONSTRAINT check_stato_valid CHECK (stato IN ('pagata', 'non_pagata'));

-- Fix DEFINER_OR_RPC_BYPASS: Add auth.uid() validation to seed_user_data
CREATE OR REPLACE FUNCTION public.seed_user_data(user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cat_stipendio uuid;
  cat_freelance uuid;
  cat_abitazione uuid;
  cat_alimentari uuid;
  cat_trasporti uuid;
  cat_utenze uuid;
BEGIN
  -- Verify caller owns the user_uuid
  IF auth.uid() != user_uuid THEN
    RAISE EXCEPTION 'Cannot seed data for other users';
  END IF;

  -- Only seed if user has no categories
  IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_uuid) THEN
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
    
    INSERT INTO transactions (user_id, description, amount, type, date, category_id) VALUES
      (user_uuid, 'Stipendio Dicembre', 2500, 'income', CURRENT_DATE - 5, cat_stipendio),
      (user_uuid, 'Progetto freelance', 450, 'income', CURRENT_DATE - 8, cat_freelance),
      (user_uuid, 'Affitto', 800, 'expense', CURRENT_DATE - 4, cat_abitazione),
      (user_uuid, 'Spesa settimanale', 120, 'expense', CURRENT_DATE - 3, cat_alimentari),
      (user_uuid, 'Benzina', 65, 'expense', CURRENT_DATE - 2, cat_trasporti),
      (user_uuid, 'Bolletta luce', 95, 'expense', CURRENT_DATE - 1, cat_utenze);
  END IF;
END;
$function$;
