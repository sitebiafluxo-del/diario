/**
 * Proxy do Gemini Vision — a chave GEMINI_API_KEY fica SOMENTE no servidor.
 * Recebe: POST { image: <base64 sem prefixo>, mimeType }
 * Exige: Authorization: Bearer <token do Supabase>
 * Retorna: { themeDescription, suggestedColors, portugueseSummary }
 */
import { requireUser, rateLimit, consumeDailyQuota, fail, noStore } from './_lib/auth.js';

// Modelos em ordem de preferência (baratos e rápidos). Se um não existir mais (404)
// ou estiver sobrecarregado (429/503), tenta o próximo em vez de travar o app.
const MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
].filter(Boolean);
const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const RETRYABLE = new Set([404, 429, 500, 503]);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
// O limite real fica no banco (função bump_usage); este valor é só informativo
const DAILY_LIMIT = 30;
const MAX_BASE64_CHARS = 3_000_000; // ~2.2MB de imagem (o cliente já reduz para 1024px)

const PROMPT = `Você é um designer de papéis de carta elegantes.
Analise esta foto de referência e extraia os elementos visuais principais.
Ignore pessoas, rostos, textos e qualquer informação pessoal da foto.
Responda APENAS um JSON válido no formato:
{
  "themeDescription": "descrição concisa em inglês de 1 a 2 frases dos elementos visuais principais",
  "suggestedColors": "tons e cores principais em inglês",
  "portugueseSummary": "resumo curto em português do tema reconhecido (ex: Rosas e Borboletas vintage)"
}`;

function clean(value, max) {
  return typeof value === 'string' ? value.replace(/[<>]/g, '').slice(0, max).trim() : '';
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).end();

  const auth = await requireUser(req, res);
  if (!auth) return;
  const { user, token } = auth;
  if (!rateLimit(res, `analyze:${user.id}`, { limit: 5 })) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail(res, 503, 'Análise de imagem indisponível no momento.');

  // Valida a entrada ANTES de consumir cota
  const { image, mimeType } = req.body || {};
  if (typeof image !== 'string' || !image || image.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return fail(res, 400, 'Imagem inválida ou muito grande.');
  }
  if (!ALLOWED_MIME.has(mimeType)) return fail(res, 400, 'Formato de imagem não suportado.');

  // Cota diária persistente (todas as instâncias da Vercel compartilham)
  if (!(await consumeDailyQuota(res, token, 'analyze-image', DAILY_LIMIT))) return;

  try {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: image } }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    let response;
    for (const model of MODELS) {
      response = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Chave no header (não na URL) para não aparecer em logs de proxies
          'x-goog-api-key': apiKey,
        },
        body,
      });
      if (response.ok || !RETRYABLE.has(response.status)) break;
      console.warn(`Gemini ${model} indisponível (${response.status}), tentando o próximo modelo`);
    }

    if (!response.ok) {
      return fail(res, 502, 'Falha ao analisar a imagem.', `Gemini ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fail(res, 502, 'Resposta inválida da IA.');

    const parsed = JSON.parse(match[0]);
    return res.status(200).json({
      themeDescription: clean(parsed.themeDescription, 300) || 'delicate floral watercolor elements',
      suggestedColors: clean(parsed.suggestedColors, 120) || 'soft pastel tones',
      portugueseSummary: clean(parsed.portugueseSummary, 80) || 'Inspirado na sua imagem',
    });
  } catch (err) {
    return fail(res, 500, 'Erro ao analisar a imagem.', err.message);
  }
}
