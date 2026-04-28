/**
 * Proxy para Google Gemini — mantém a chave server-side.
 * Recebe: POST { prompt }
 * Retorna: JSON do tema visual
 */
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `Você é um designer de temas para um app de diário pessoal.
Gere um tema visual baseado no pedido do usuário.

REGRAS OBRIGATÓRIAS:
- Cores pastel e suaves
- Alta legibilidade (contraste adequado)
- Área limpa para texto
- Fontes legíveis

Responda APENAS com JSON válido no formato:
{
  "name": "Nome do Tema",
  "emoji": "emoji representativo",
  "background": "CSS gradient",
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "accentColor": "#hex",
  "textColor": "#hex",
  "textSecondary": "#hex",
  "surfaceColor": "rgba(...)",
  "font": "'Patrick Hand', cursive",
  "lineStyle": "solid|dashed|dotted|wavy",
  "lineColor": "rgba(...)",
  "cardBg": "rgba(...)"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nPedido do usuário: ${prompt}` }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 500 },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Invalid Gemini response' });

    const theme = JSON.parse(jsonMatch[0]);
    return res.status(200).json(theme);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
