/**
 * Proxy de transcrição — suporta OpenAI Whisper e Groq (gratuito).
 */

const GROQ_MODELS = {
  'groq-whisper-large-v3-turbo': 'whisper-large-v3-turbo',
  'groq-distil-whisper': 'distil-whisper-large-v3-en',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { audio, model, filename, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: 'Missing audio data' });

    console.log('Transcribe request received for model:', model);

    const buffer = Buffer.from(audio, 'base64');
    
    // No Node.js (Vercel), usamos File ou Blob do pacote built-in
    // No Node 20+, Blob e File são globais.
    const file = new File([buffer], filename || 'recording.webm', { type: mimeType || 'audio/webm' });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('response_format', 'verbose_json');

    let apiUrl, apiKey;

    if (GROQ_MODELS[model]) {
      apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        console.error('GROQ_API_KEY not found');
        return res.status(503).json({ error: 'GROQ_API_KEY not configured' });
      }
      apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
      formData.append('model', GROQ_MODELS[model]);
    } else {
      // Rota OpenAI (pago) - Tenta primeiro OPENAI_API_KEY, depois VITE_WHISPER_API_KEY
      apiKey = process.env.OPENAI_API_KEY || process.env.VITE_WHISPER_API_KEY;
      
      if (!apiKey) {
        console.error('OpenAI API Key not found in environment variables (OPENAI_API_KEY or VITE_WHISPER_API_KEY)');
        return res.status(503).json({ error: 'OpenAI API Key not configured on server' });
      }
      
      apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
      formData.append('model', model || 'whisper-1');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', response.status, errorData);
      return res.status(response.status).json({ error: errorData });
    }

    const data = await response.json();
    console.log('Transcription successful');
    return res.status(200).json({ text: data.text, language: data.language || 'unknown' });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
