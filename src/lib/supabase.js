import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidConfig = supabaseUrl
  && supabaseAnonKey
  && !supabaseUrl.includes('your-project')
  && !supabaseAnonKey.includes('your-anon-key');

if (!isValidConfig) {
  console.warn('⚠️ Supabase credentials not configured. Using demo mode.');
}

export const supabase = isValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = () => !!supabase;
