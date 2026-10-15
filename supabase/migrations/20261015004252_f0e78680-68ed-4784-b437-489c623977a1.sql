CREATE TABLE public.smartphone_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT '',
  numero text NOT NULL,
  data_documento date NOT NULL,
  nome_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, numero, data_documento)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartphone_documenti TO authenticated;
GRANT ALL ON public.smartphone_documenti TO service_role;
ALTER TABLE public.smartphone_documenti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sd_sel" ON public.smartphone_documenti FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sd_ins" ON public.smartphone_documenti FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sd_upd" ON public.smartphone_documenti FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sd_del" ON public.smartphone_documenti FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.smartphone_articoli (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  documento_id uuid NOT NULL REFERENCES public.smartphone_documenti(id) ON DELETE CASCADE,
  marca text NOT NULL DEFAULT '',
  codice_articolo text NOT NULL,
  modello text NOT NULL DEFAULT '',
  descrizione text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'Smartphone',
  costo_unitario numeric(12,2) NOT NULL CHECK (costo_unitario >= 0),
  aliquota_iva numeric,
  prezzo_previsto numeric(12,2) CHECK (prezzo_previsto IS NULL OR prezzo_previsto >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX smartphone_articoli_codice_idx ON public.smartphone_articoli(user_id, codice_articolo, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartphone_articoli TO authenticated;
GRANT ALL ON public.smartphone_articoli TO service_role;
ALTER TABLE public.smartphone_articoli ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_sel" ON public.smartphone_articoli FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sa_ins" ON public.smartphone_articoli FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sa_upd" ON public.smartphone_articoli FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sa_del" ON public.smartphone_articoli FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.smartphone_articoli_valida() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.categoria NOT IN ('Smartphone','Accessorio','Cellulare','Altro') THEN
    RAISE EXCEPTION 'Categoria non valida: %', NEW.categoria;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER smartphone_articoli_valida BEFORE INSERT OR UPDATE ON public.smartphone_articoli FOR EACH ROW EXECUTE FUNCTION public.smartphone_articoli_valida();

CREATE TABLE public.smartphone_pezzi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  articolo_id uuid NOT NULL REFERENCES public.smartphone_articoli(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.smartphone_documenti(id) ON DELETE CASCADE,
  imei text,
  stato text NOT NULL DEFAULT 'disponibile' CHECK (stato IN ('disponibile','venduto')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX smartphone_pezzi_imei_uq ON public.smartphone_pezzi(user_id, imei) WHERE imei IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartphone_pezzi TO authenticated;
GRANT ALL ON public.smartphone_pezzi TO service_role;
ALTER TABLE public.smartphone_pezzi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_sel" ON public.smartphone_pezzi FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sp_ins" ON public.smartphone_pezzi FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sp_upd" ON public.smartphone_pezzi FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sp_del" ON public.smartphone_pezzi FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.smartphone_vendite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pezzo_id uuid NOT NULL UNIQUE REFERENCES public.smartphone_pezzi(id) ON DELETE CASCADE,
  data_vendita date NOT NULL,
  prezzo_vendita numeric(12,2) NOT NULL CHECK (prezzo_vendita >= 0),
  prezzo_previsto_al_momento numeric(12,2),
  imei text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartphone_vendite TO authenticated;
GRANT ALL ON public.smartphone_vendite TO service_role;
ALTER TABLE public.smartphone_vendite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_sel" ON public.smartphone_vendite FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ins" ON public.smartphone_vendite FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_upd" ON public.smartphone_vendite FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_del" ON public.smartphone_vendite FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.smartphone_vendite_stato() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.smartphone_pezzi SET stato = 'venduto', imei = COALESCE(NULLIF(NEW.imei,''), imei)
      WHERE id = NEW.pezzo_id AND user_id = NEW.user_id;
    RETURN NEW;
  ELSE
    UPDATE public.smartphone_pezzi SET stato = 'disponibile' WHERE id = OLD.pezzo_id AND user_id = OLD.user_id;
    RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER smartphone_vendite_stato AFTER INSERT OR DELETE ON public.smartphone_vendite FOR EACH ROW EXECUTE FUNCTION public.smartphone_vendite_stato();

CREATE OR REPLACE FUNCTION public.smartphone_importa_documento(p_user_id uuid, p_documento jsonb, p_articoli jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_doc uuid; v_art uuid; a jsonb; q int; v_pezzi int := 0;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Utente non autorizzato'; END IF;
  IF EXISTS (SELECT 1 FROM smartphone_documenti WHERE user_id = p_user_id AND numero = p_documento->>'numero' AND data_documento = (p_documento->>'data_documento')::date) THEN
    RAISE EXCEPTION 'Il documento n. % del % è già stato importato', p_documento->>'numero', to_char((p_documento->>'data_documento')::date,'DD/MM/YYYY');
  END IF;
  INSERT INTO smartphone_documenti(user_id, tipo, numero, data_documento, nome_file)
  VALUES (p_user_id, COALESCE(p_documento->>'tipo',''), p_documento->>'numero', (p_documento->>'data_documento')::date, p_documento->>'nome_file')
  RETURNING id INTO v_doc;
  FOR a IN SELECT * FROM jsonb_array_elements(p_articoli) LOOP
    q := GREATEST(0, round((a->>'quantita')::numeric)::int);
    IF q = 0 THEN CONTINUE; END IF;
    INSERT INTO smartphone_articoli(user_id, documento_id, marca, codice_articolo, modello, descrizione, categoria, costo_unitario, aliquota_iva, prezzo_previsto)
    VALUES (p_user_id, v_doc, COALESCE(a->>'marca',''), a->>'codice_articolo', COALESCE(a->>'modello',''), COALESCE(a->>'descrizione',''),
      COALESCE(a->>'categoria','Smartphone'), (a->>'costo_unitario')::numeric, NULLIF(a->>'aliquota_iva','')::numeric, NULLIF(a->>'prezzo_previsto','')::numeric)
    RETURNING id INTO v_art;
    INSERT INTO smartphone_pezzi(user_id, articolo_id, documento_id) SELECT p_user_id, v_art, v_doc FROM generate_series(1, q);
    v_pezzi := v_pezzi + q;
  END LOOP;
  RETURN jsonb_build_object('documento_id', v_doc, 'pezzi', v_pezzi);
END $$;

CREATE OR REPLACE FUNCTION public.smartphone_registra_vendita(p_user_id uuid, p_pezzo_id uuid, p_data date, p_prezzo numeric, p_imei text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev numeric; v_id uuid;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Utente non autorizzato'; END IF;
  SELECT a.prezzo_previsto INTO v_prev FROM smartphone_pezzi p JOIN smartphone_articoli a ON a.id = p.articolo_id
   WHERE p.id = p_pezzo_id AND p.user_id = p_user_id AND p.stato = 'disponibile' FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Il pezzo non è disponibile o è già stato venduto'; END IF;
  INSERT INTO smartphone_vendite(user_id, pezzo_id, data_vendita, prezzo_vendita, prezzo_previsto_al_momento, imei)
  VALUES (p_user_id, p_pezzo_id, p_data, p_prezzo, v_prev, NULLIF(trim(p_imei),''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.smartphone_importa_documento(uuid, jsonb, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.smartphone_registra_vendita(uuid, uuid, date, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.smartphone_importa_documento(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.smartphone_registra_vendita(uuid, uuid, date, numeric, text) TO authenticated;