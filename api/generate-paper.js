/**
 * Gera o papel de carta com Cloudflare Workers AI (FLUX.2 klein) — token só no servidor.
 *
 * Recebe: POST { theme, position, colorMode, monoColor, suggestedColors?, fresh? }
 *   (NÃO aceita prompt livre: o prompt é montado aqui, então a cota só serve para papéis)
 * Exige:  Authorization: Bearer <token do Supabase> (conta Google)
 * Retorna: { image: <base64 JPEG>, source: 'cache' | 'cloudflare' }
 *          503 { fallback: true } quando a cota grátis do dia acabou → o app usa o Pollinations
 *
 * Reaproveitamento: papéis com as mesmas escolhas já gerados por alguém saem do cache
 * (bucket privado "paper-cache", acessado só pelo servidor) sem gastar cota.
 */
import crypto from 'node:crypto';
import { requireUser, rateLimit, consumeDailyQuota, fail, noStore } from './_lib/auth.js';
import { buildStationeryPrompt, MONO_PALETTES } from '../src/lib/stationeryPrompt.js';
import { env, envUrl } from './_lib/env.js';

const CF_ACCOUNT = env('CLOUDFLARE_ACCOUNT_ID');
const CF_TOKEN = env('CLOUDFLARE_API_TOKEN');
const CF_MODEL = env('CLOUDFLARE_IMAGE_MODEL') || '@cf/black-forest-labs/flux-2-klein-4b';
const WIDTH = 768;   // proporção A5 (1 : 1,416), múltiplos de 64
const HEIGHT = 1088;

const SUPABASE_URL = envUrl('SUPABASE_URL', 'VITE_SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY'); // opcional: sem ela, sem cache
const CACHE_BUCKET = 'paper-cache';
// Chaves novas (sb_secret_...) vão só no header apikey; as antigas (JWT) também em Authorization
const serviceHeaders = () => (SERVICE_KEY?.startsWith('sb_secret_')
  ? { apikey: SERVICE_KEY }
  : { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
const CACHE_VERSION = 'v1'; // mude ao alterar o prompt, para não servir papéis antigos

const POSITIONS = new Set(['frame', 'top', 'bottom', 'sides', 'all']);
const COLOR_MODES = new Set(['color', 'mono']);
const MONO_IDS = new Set(MONO_PALETTES.map((p) => p.id));

function sanitizeText(value, max) {
  if (typeof value !== 'string') return '';
  // só letras, números, espaço e pontuação simples; sem quebras de linha
  return value.normalize('NFC').replace(/[^\p{L}\p{N} ,.'\-!?&]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cacheKey(opts) {
  const norm = JSON.stringify([CACHE_VERSION, opts.theme.toLowerCase(), opts.position, opts.colorMode, opts.monoColor]);
  return crypto.createHash('sha256').update(norm).digest('hex');
}

async function readCache(key) {
  if (!SERVICE_KEY || !SUPABASE_URL) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${CACHE_BUCKET}/${key}.jpg`, {
      headers: serviceHeaders(),
    });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer()).toString('base64');
  } catch {
    return null;
  }
}

async function writeCache(key, base64) {
  if (!SERVICE_KEY || !SUPABASE_URL) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${CACHE_BUCKET}/${key}.jpg`, {
      method: 'POST',
      headers: {
        ...serviceHeaders(),
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: Buffer.from(base64, 'base64'),
    });
  } catch (err) {
    console.warn('Cache não gravado:', err.message);
  }
}

async function generateWithCloudflare(prompt) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(WIDTH));
  form.append('height', String(HEIGHT));

  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}` },
    body: form,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.result?.image) {
    const msg = data?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.nsfw = /nsfw/i.test(msg);
    throw err;
  }
  return data.result.image; // base64 JPEG
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).end();

  const auth = await requireUser(req, res);
  if (!auth) return;
  const { user, token } = auth;
  if (!rateLimit(res, `paper:${user.id}`, { limit: 4 })) return;

  if (!CF_ACCOUNT || !CF_TOKEN) {
    return res.status(503).json({ error: 'Gerador indisponível.', fallback: true });
  }

  // Validação estrita das escolhas (nada de prompt livre)
  const body = req.body || {};
  const opts = {
    theme: sanitizeText(body.theme, 80),
    position: POSITIONS.has(body.position) ? body.position : 'frame',
    colorMode: COLOR_MODES.has(body.colorMode) ? body.colorMode : 'color',
    monoColor: MONO_IDS.has(body.monoColor) ? body.monoColor : 'rosa',
  };
  const suggestedColors = sanitizeText(body.suggestedColors, 160);
  const fresh = body.fresh === true;
  if (!opts.theme && !suggestedColors) return fail(res, 400, 'Escreva um tema para o papel.');

  // 1. Reaproveita papel igual já gerado (não gasta cota). Fotos de inspiração não usam cache.
  const key = suggestedColors ? null : cacheKey(opts);
  if (key && !fresh) {
    const cached = await readCache(key);
    if (cached) return res.status(200).json({ image: cached, source: 'cache' });
  }

  // 2. Cota diária por pessoa (no banco; vale para todas as instâncias)
  if (!(await consumeDailyQuota(res, token, 'generate-paper', 10))) return;

  const prompt = buildStationeryPrompt({
    ...opts,
    analyzedInfo: suggestedColors ? { suggestedColors } : null,
  });

  try {
    const image = await generateWithCloudflare(prompt);
    if (key) await writeCache(key, image);
    return res.status(200).json({ image, source: 'cloudflare' });
  } catch (err) {
    if (err.nsfw) {
      return fail(res, 422, 'Esse tema não pôde ser desenhado. Tente descrever de outro jeito.', err.message);
    }
    // Cota grátis do dia esgotada / instabilidade: o app usa o motor reserva
    console.error('Cloudflare falhou:', err.message);
    return res.status(503).json({ error: 'Gerador principal indisponível.', fallback: true });
  }
}
