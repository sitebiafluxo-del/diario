-- Supabase SQL: Create entries table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  translated_content TEXT DEFAULT '',
  original_language TEXT DEFAULT 'pt-BR',
  mood TEXT DEFAULT '😊',
  audio_url TEXT,
  stationery_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Se a tabela já existir, adicione a coluna com:
-- ALTER TABLE entries ADD COLUMN IF NOT EXISTS stationery_url TEXT;

-- Enable RLS
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own entries
CREATE POLICY "Users can view own entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster date queries
CREATE INDEX idx_entries_user_created ON entries(user_id, created_at DESC);

-- Storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

CREATE POLICY "Users can delete own audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage bucket for custom stationery images
INSERT INTO storage.buckets (id, name, public)
VALUES ('stationery', 'stationery', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload stationery"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stationery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view stationery"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stationery');

CREATE POLICY "Users can delete own stationery"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stationery' AND auth.uid()::text = (storage.foldername(name))[1]);
