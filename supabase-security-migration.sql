-- ============================================================================
-- MIGRAÇÃO DE SEGURANÇA — rode inteiro no SQL Editor do Supabase.
-- Idempotente: pode ser executado mais de uma vez (rode de novo após atualizações).
--
-- O que faz:
--  1. Torna PRIVADOS os buckets de imagens/áudio (antes: qualquer pessoa com o
--     link via fotos enviadas e gravações de voz do diário).
--  2. Cada usuário só lê / envia / apaga arquivos da PRÓPRIA pasta (<user_id>/...).
--  3. Reforça RLS das tabelas papers e entries (WITH CHECK no UPDATE: impede
--     "transferir" uma linha para outro user_id).
-- ============================================================================

-- ─── 1. Buckets privados ────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false
WHERE id IN ('stationery-images', 'stationery', 'audio');

-- Buckets do diário antigo (sem uso): bloqueia novos uploads de qualquer tipo
UPDATE storage.buckets SET file_size_limit = 1, allowed_mime_types = ARRAY['application/x-disabled']
WHERE id IN ('audio', 'stationery');

-- Limites no próprio bucket (defesa extra além da validação no app)
UPDATE storage.buckets
SET file_size_limit = 3145728, -- 3MB (o app reencoda as imagens antes de enviar)
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'stationery-images';

-- ─── 2. Policies do Storage ─────────────────────────────────────────────────
-- Remove as policies antigas (abertas)
DROP POLICY IF EXISTS "Qualquer pessoa pode visualizar imagens dos papéis" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem enviar imagens"        ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem apagar suas próprias imagens"        ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio"                              ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view stationery"                         ON storage.objects;
DROP POLICY IF EXISTS "Users can upload audio"                             ON storage.objects;
DROP POLICY IF EXISTS "Users can upload stationery"                        ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio"                         ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own stationery"                    ON storage.objects;

DROP POLICY IF EXISTS "Dono lê seus arquivos"     ON storage.objects;
DROP POLICY IF EXISTS "Dono envia seus arquivos"  ON storage.objects;
DROP POLICY IF EXISTS "Dono apaga seus arquivos"  ON storage.objects;

CREATE POLICY "Dono lê seus arquivos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('stationery-images', 'stationery', 'audio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Upload SOMENTE no bucket ativo; nome no formato <uid>/<uuid>.<ext> (sem "..")
-- Conta os arquivos do PRÓPRIO usuário (usada na policy de INSERT abaixo)
CREATE OR REPLACE FUNCTION public.my_object_count() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = storage, public AS $$
  SELECT count(*)::int FROM storage.objects
  WHERE bucket_id = 'stationery-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
$$;
REVOKE ALL ON FUNCTION public.my_object_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_object_count() TO authenticated;

CREATE POLICY "Dono envia seus arquivos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stationery-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif)$'
    AND public.my_object_count() < 250   -- cota: 250 imagens × 3MB por usuário
  );

CREATE POLICY "Dono apaga seus arquivos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('stationery-images', 'stationery', 'audio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 3. RLS das tabelas ─────────────────────────────────────────────────────
ALTER TABLE IF EXISTS papers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.papers') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Usuário atualiza apenas seus papéis" ON papers;
    CREATE POLICY "Usuário atualiza apenas seus papéis"
      ON papers FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    -- Limite de tamanho para evitar abuso do banco
    ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_content_len;
    ALTER TABLE papers ADD CONSTRAINT papers_content_len CHECK (char_length(content) <= 20000);
    ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_title_len;
    ALTER TABLE papers ADD CONSTRAINT papers_title_len CHECK (char_length(title) <= 200);
    -- image_url só pode ser referência ao próprio storage ou um modelo do app
    -- (impede gravar imagens de vários MB como data URL direto no banco)
    ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_image_ref_fmt;
    ALTER TABLE papers ADD CONSTRAINT papers_image_ref_fmt CHECK (
      image_url ~ '^storage://stationery-images/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif)$'
      OR image_url ~ '^/backgrounds/[A-Za-z0-9_.-]+$'
    ) NOT VALID; -- NOT VALID: não quebra linhas antigas, mas vale para novas
    ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_options_size;
    ALTER TABLE papers ADD CONSTRAINT papers_options_size CHECK (pg_column_size(options) <= 1024);
  END IF;

  IF to_regclass('public.entries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own entries" ON entries;
    CREATE POLICY "Users can update own entries"
      ON entries FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 4. Cota por usuário: máx. 200 papéis ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.papers_quota() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Mesmo erro genérico da RLS: não revela nada sobre contas de outras pessoas
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  -- Serializa inserts do mesmo usuário: sem corrida no count(*)
  PERFORM pg_advisory_xact_lock(hashtext('papers_quota:' || NEW.user_id::text));
  IF (SELECT count(*) FROM papers WHERE user_id = NEW.user_id) >= 200 THEN
    RAISE EXCEPTION 'Limite de 200 papéis atingido';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF to_regclass('public.papers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS papers_quota ON papers;
    CREATE TRIGGER papers_quota BEFORE INSERT ON papers
      FOR EACH ROW EXECUTE FUNCTION public.papers_quota();
  END IF;
END $$;

-- ─── 5. Cota diária persistente das rotas de IA (/api) ──────────────────────
-- Compartilhada por todas as instâncias da Vercel (o limite em memória não é).
CREATE TABLE IF NOT EXISTS public.api_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route   TEXT NOT NULL,
  day     DATE NOT NULL DEFAULT current_date,
  n       INT  NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, route, day)
);
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
-- Sem policies: ninguém lê/escreve direto; só pela função abaixo.

-- Rotas e limites são definidos AQUI (não pelo cliente): p_max é ignorado.
-- Qualquer rota desconhecida é recusada, então ninguém cria linhas arbitrárias.
CREATE OR REPLACE FUNCTION public.bump_usage(p_route TEXT, p_max INT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c INT; lim INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  lim := CASE p_route
           WHEN 'analyze-image' THEN 30
           ELSE NULL
         END;
  IF lim IS NULL THEN RETURN false; END IF;

  INSERT INTO api_usage (user_id, route) VALUES (auth.uid(), p_route)
  ON CONFLICT (user_id, route, day) DO UPDATE SET n = api_usage.n + 1
  RETURNING n INTO c;

  -- Faxina: mantém só os últimos 7 dias do próprio usuário
  DELETE FROM api_usage WHERE user_id = auth.uid() AND day < current_date - 7;

  RETURN c <= lim;
END $$;

-- Remove linhas de rotas inválidas que possam ter sido criadas antes desta versão
DELETE FROM public.api_usage WHERE route <> 'analyze-image';

REVOKE ALL ON FUNCTION public.bump_usage(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_usage(TEXT, INT) TO authenticated;
REVOKE ALL ON FUNCTION public.papers_quota() FROM PUBLIC, anon, authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Policies ativas (confira se não sobrou nenhuma "Anyone can ..." criada pela UI):
SELECT schemaname, tablename, policyname, cmd FROM pg_policies
WHERE schemaname IN ('public', 'storage') ORDER BY 1, 2, 3;
-- Deve listar public = false para os 3 buckets:
SELECT id, public FROM storage.buckets WHERE id IN ('stationery-images', 'stationery', 'audio');
