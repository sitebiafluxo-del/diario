/**
 * Proxy para OpenAI Whisper — mantém a chave server-side.
 * Recebe: POST { audio: base64, model, filename, mimeType }
 * Retorna: { text, language }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const { audio, model, filename, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: 'Missing audio' });

    const buffer = Buffer.from(audio, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });

    const formData = new FormData();
    formData.append('file', blob, filename || 'recording.webm');
    formData.append('model', model || 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.text, language: data.language || 'unknown' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
