
CREATE OR REPLACE FUNCTION public.apply_categorization_rule(p_rule_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule            categorization_rules%ROWTYPE;
  v_classif_ids     UUID[];
  v_updated         integer := 0;
  v_keyword         text;
  v_keyword_clauses text := '';
  v_excl_clauses    text := '';
  v_sql             text;
  v_desc_expr       text := $$regexp_replace(lower(description), '\s+', ' ', 'g')$$;
BEGIN
  SELECT * INTO v_rule FROM categorization_rules
   WHERE id = p_rule_id AND user_id = p_user_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Regola non trovata o non attiva: %', p_rule_id; END IF;

  SELECT ARRAY_AGG(id) INTO v_classif_ids FROM categories
   WHERE user_id = p_user_id AND name = 'Da classificare';

  IF array_length(v_rule.keywords, 1) IS NULL THEN RETURN 0; END IF;

  FOR i IN 1 .. array_length(v_rule.keywords, 1) LOOP
    v_keyword := '%' || regexp_replace(lower(v_rule.keywords[i]), '\s+', ' ', 'g') || '%';
    IF v_keyword_clauses = '' THEN
      v_keyword_clauses := format('%s ILIKE %L', v_desc_expr, v_keyword);
    ELSE
      v_keyword_clauses := v_keyword_clauses || format(' OR %s ILIKE %L', v_desc_expr, v_keyword);
    END IF;
  END LOOP;

  IF v_rule.exclude_keywords IS NOT NULL AND array_length(v_rule.exclude_keywords, 1) > 0 THEN
    FOR i IN 1 .. array_length(v_rule.exclude_keywords, 1) LOOP
      v_keyword := '%' || regexp_replace(lower(v_rule.exclude_keywords[i]), '\s+', ' ', 'g') || '%';
      IF v_excl_clauses = '' THEN
        v_excl_clauses := format('%s ILIKE %L', v_desc_expr, v_keyword);
      ELSE
        v_excl_clauses := v_excl_clauses || format(' OR %s ILIKE %L', v_desc_expr, v_keyword);
      END IF;
    END LOOP;
  END IF;

  v_sql := format('
    UPDATE transactions SET category_id = %L
    WHERE user_id = %L
      AND deleted_at IS NULL
      AND transfer_id IS NULL
      AND (category_id IS NULL OR category_id != %L)
      AND (%s)
  ', v_rule.category_id, p_user_id, v_rule.category_id, v_keyword_clauses);

  IF v_rule.match_type = 'income' THEN v_sql := v_sql || ' AND type = ''income''';
  ELSIF v_rule.match_type = 'expense' THEN v_sql := v_sql || ' AND type = ''expense''';
  END IF;

  IF v_rule.conto_id IS NOT NULL THEN
    v_sql := v_sql || format('
      AND (conto_id = %L OR category_id IS NULL OR category_id = ANY(%L::uuid[]))
    ', v_rule.conto_id, v_classif_ids);
  END IF;

  IF NOT v_rule.apply_to_categorized THEN
    v_sql := v_sql || format('
      AND (category_id IS NULL OR category_id = ANY(%L::uuid[]))
    ', v_classif_ids);
  END IF;

  IF v_excl_clauses != '' THEN
    v_sql := v_sql || format(' AND NOT (%s)', v_excl_clauses);
  END IF;

  EXECUTE v_sql;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_categorization_rule_matches(p_rule_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule            categorization_rules%ROWTYPE;
  v_classif_ids     UUID[];
  v_count           integer := 0;
  v_keyword         text;
  v_keyword_clauses text := '';
  v_excl_clauses    text := '';
  v_sql             text;
  v_desc_expr       text := $$regexp_replace(lower(description), '\s+', ' ', 'g')$$;
BEGIN
  SELECT * INTO v_rule FROM categorization_rules WHERE id = p_rule_id AND user_id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT ARRAY_AGG(id) INTO v_classif_ids FROM categories
   WHERE user_id = p_user_id AND name = 'Da classificare';

  IF array_length(v_rule.keywords, 1) IS NULL THEN RETURN 0; END IF;

  FOR i IN 1 .. array_length(v_rule.keywords, 1) LOOP
    v_keyword := '%' || regexp_replace(lower(v_rule.keywords[i]), '\s+', ' ', 'g') || '%';
    IF v_keyword_clauses = '' THEN
      v_keyword_clauses := format('%s ILIKE %L', v_desc_expr, v_keyword);
    ELSE
      v_keyword_clauses := v_keyword_clauses || format(' OR %s ILIKE %L', v_desc_expr, v_keyword);
    END IF;
  END LOOP;

  IF v_rule.exclude_keywords IS NOT NULL AND array_length(v_rule.exclude_keywords, 1) > 0 THEN
    FOR i IN 1 .. array_length(v_rule.exclude_keywords, 1) LOOP
      v_keyword := '%' || regexp_replace(lower(v_rule.exclude_keywords[i]), '\s+', ' ', 'g') || '%';
      IF v_excl_clauses = '' THEN
        v_excl_clauses := format('%s ILIKE %L', v_desc_expr, v_keyword);
      ELSE
        v_excl_clauses := v_excl_clauses || format(' OR %s ILIKE %L', v_desc_expr, v_keyword);
      END IF;
    END LOOP;
  END IF;

  v_sql := format('
    SELECT count(*) FROM transactions
    WHERE user_id = %L
      AND deleted_at IS NULL
      AND transfer_id IS NULL
      AND (category_id IS NULL OR category_id != %L)
      AND (%s)
  ', p_user_id, v_rule.category_id, v_keyword_clauses);

  IF v_rule.match_type = 'income' THEN v_sql := v_sql || ' AND type = ''income''';
  ELSIF v_rule.match_type = 'expense' THEN v_sql := v_sql || ' AND type = ''expense''';
  END IF;

  IF v_rule.conto_id IS NOT NULL THEN
    v_sql := v_sql || format('
      AND (conto_id = %L OR category_id IS NULL OR category_id = ANY(%L::uuid[]))
    ', v_rule.conto_id, v_classif_ids);
  END IF;

  IF NOT v_rule.apply_to_categorized THEN
    v_sql := v_sql || format('
      AND (category_id IS NULL OR category_id = ANY(%L::uuid[]))
    ', v_classif_ids);
  END IF;

  IF v_excl_clauses != '' THEN
    v_sql := v_sql || format(' AND NOT (%s)', v_excl_clauses);
  END IF;

  EXECUTE v_sql INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$function$;
