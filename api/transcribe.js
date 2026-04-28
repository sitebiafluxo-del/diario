/**
 * Proxy de transcrição — suporta OpenAI Whisper e Groq (gratuito).
 * Recebe: POST { audio: base64, model, filename, mimeType }
 * Retorna: { text, language }
 *
 * Modelos Groq (gratuito): groq-whisper-large-v3-turbo, groq-distil-whisper
 * Modelos OpenAI (pago):   whisper-1, gpt-4o-transcribe
 */

const GROQ_MODELS = {
  'groq-whisper-large-v3-turbo': 'whisper-large-v3-turbo',
  'groq-distil-whisper': 'distil-whisper-large-v3-en',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { audio, model, filename, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: 'Missing audio' });

    const buffer = Buffer.from(audio, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, filename || 'recording.webm');
    formData.append('response_format', 'verbose_json');

    let apiUrl, apiKey, groqModel;

    if (GROQ_MODELS[model]) {
      // Rota Groq (gratuito)
      apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'GROQ_API_KEY not configured' });
      groqModel = GROQ_MODELS[model];
      apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
      formData.append('model', groqModel);
    } else {
      // Rota OpenAI (pago)
      apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
      apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
      formData.append('model', model || 'whisper-1');
    }

    const response = await fetch(apiUrl, {
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
