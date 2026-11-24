/**
 * Utilitários de segurança compartilhados pelas rotas /api.
 * (Pastas com "_" não viram endpoints na Vercel.)
 *
 * Ordem de defesa de cada requisição:
 *   1. limite por IP + formato do token (barato, antes de qualquer rede)
 *   2. valida o JWT no Supabase e exige conta Google (não anônima)
 *   3. allowlist de e-mails opcional (ALLOWED_EMAILS)
 *   4. cota diária PERSISTENTE no banco (vale para todas as instâncias)
 */

import { env, envUrl } from './env.js';

const SUPABASE_URL = envUrl('SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ALLOWED_EMAILS = new Set(
  (env('ALLOWED_EMAILS') || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
}

function isGoogleUser(user) {
  if (user.is_anonymous) return false;
  const providers = user.app_metadata?.providers || [user.app_metadata?.provider];
  return Array.isArray(providers) && providers.includes('google');
}

/**
 * Retorna { user, token } ou null (já tendo respondido com erro).
 */
export async function requireUser(req, res) {
  // 1. Barato: antes de chamar o Supabase
  if (!rateLimit(res, `ip:${clientIp(req)}`, { limit: 30 })) return null;

  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token.length > 4096 || !JWT_RE.test(token)) {
    res.status(401).json({ error: 'Faça login para usar este recurso.' });
    return null;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('SUPABASE_URL / SUPABASE_ANON_KEY não configurados no servidor');
    res.status(503).json({ error: 'Servidor não configurado.' });
    return null;
  }

  // 2. Valida a sessão no Supabase
  let user;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!r.ok) {
      res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' });
      return null;
    }
    user = await r.json();
  } catch (err) {
    const code = err?.cause?.code || err?.code || err?.name || 'erro';
    console.error('Falha ao validar sessão no Supabase:', err.message, code, '| host:', SUPABASE_URL);
    // Diagnóstico sem segredos: tipo do erro + domínio público do Supabase
    res.status(503).json({
      error: 'Não foi possível validar a sessão.',
      diag: `${code} @ ${SUPABASE_URL ? new URL(SUPABASE_URL).host : 'sem-url'}`,
    });
    return null;
  }

  if (!user?.id || !isGoogleUser(user)) {
    res.status(403).json({ error: 'Recurso disponível apenas para contas Google.' });
    return null;
  }

  // 3. Allowlist opcional (app privado)
  if (ALLOWED_EMAILS.size && !ALLOWED_EMAILS.has(String(user.email || '').toLowerCase())) {
    res.status(403).json({ error: 'Conta sem permissão para este recurso.' });
    return null;
  }

  return { user, token };
}

/**
 * Cota diária persistente (tabela api_usage + RPC bump_usage, ver supabase-security-migration.sql).
 * Executa com o JWT do próprio usuário: auth.uid() no banco garante que ele só
 * incrementa o próprio contador. Em caso de falha, NEGA (fail-closed) para não gerar custo.
 */
export async function consumeDailyQuota(res, token, route, max) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_route: route, p_max: max }),
    });
    if (!r.ok) throw new Error(`RPC ${r.status}: ${await r.text()}`);
    const allowed = await r.json();
    if (allowed !== true) {
      res.status(429).json({ error: 'Limite diário atingido. Tente novamente amanhã.' });
      return false;
    }
    return true;
  } catch (err) {
    console.error('Falha ao verificar cota:', err.message);
    res.status(503).json({ error: 'Recurso temporariamente indisponível.' });
    return false;
  }
}

const buckets = new Map();

/**
 * Limite curto em memória (por instância) — complementa a cota diária persistente,
 * segurando rajadas sem custo de rede.
 */
export function rateLimit(res, key, { limit = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  if (buckets.size > 10_000) buckets.clear(); // evita crescer sem limite
  const entry = buckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  if (entry.count > limit) {
    res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000));
    res.status(429).json({ error: 'Muitas solicitações. Aguarde um minuto.' });
    return false;
  }
  return true;
}

export function fail(res, status, publicMessage, internalDetail) {
  if (internalDetail) console.error(publicMessage, internalDetail);
  return res.status(status).json({ error: publicMessage });
}

/** Cabeçalhos para respostas de API (não cachear dados de usuário). */
export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
