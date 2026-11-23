import { supabase, isSupabaseConfigured } from './supabase';
import { apiUrl } from './capacitor';

/**
 * fetch para as rotas /api que envia o token da sessão do Supabase.
 * As chaves de IA ficam somente no servidor; o servidor exige login válido.
 */
export async function authFetch(path, { body, ...options } = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Recurso disponível apenas com login.');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Entre com sua conta Google para usar este recurso.');
  }

  const response = await fetch(apiUrl(path), {
    method: 'POST',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || `Erro ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}
