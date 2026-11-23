-- Supabase Schema: Tabela de Papéis de Carta para Múltiplos Usuários
-- Execute este script no SQL Editor do seu projeto Supabase

-- 1. Cria a tabela de papéis de carta
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Papel de Carta',
  image_url TEXT NOT NULL,
  content TEXT DEFAULT '',
  options JSONB DEFAULT '{"position": "frame", "colorMode": "color", "lineStyle": "dotted"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ativa Row Level Security (RLS) para isolar dados entre usuários
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança: cada usuário só enxerga, cria, altera e deleta os SEUS papéis
CREATE POLICY "Usuário vê apenas seus papéis"
  ON papers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário cria seus próprios papéis"
  ON papers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza apenas seus papéis"
  ON papers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário exclui apenas seus papéis"
  ON papers FOR DELETE
  USING (auth.uid() = user_id);

-- Índice para carregamento ultra rápido da galeria
CREATE INDEX IF NOT EXISTS idx_papers_user_created ON papers(user_id, created_at DESC);

-- 3. Bucket de Storage PRIVADO (acesso só por URL assinada, gerada para o dono)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stationery-images', 'stationery-images', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4. Policies do Storage: rode o arquivo supabase-security-migration.sql
--    (cada usuário só lê/envia/apaga arquivos da própria pasta <user_id>/).
