import { apiUrl } from './capacitor';

const WHISPER_API_URL = import.meta.env.VITE_WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
const WHISPER_API_KEY = import.meta.env.VITE_WHISPER_API_KEY || '';

export const TRANSCRIPTION_MODELS = [
  { id: 'groq-whisper-large-v3-turbo', label: 'Groq ✦', description: 'Gratuito e rápido (Groq)' },
  { id: 'groq-distil-whisper', label: 'Groq Lite ✦', description: 'Gratuito, inglês (Groq)' },
  { id: 'whisper-1', label: 'Whisper', description: 'OpenAI Whisper (pago)' },
  { id: 'gpt-4o-transcribe', label: 'GPT-4o', description: 'OpenAI mais avançado (pago)' },
];

export function getSavedTranscriptionModel() {
  return localStorage.getItem('bia-transcription-model') || 'groq-whisper-large-v3-turbo';
}

export function saveTranscriptionModel(model) {
  localStorage.setItem('bia-transcription-model', model);
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(audioBlob, model) {
  const selectedModel = model || getSavedTranscriptionModel();
  console.log('Iniciando transcrição com modelo:', selectedModel);

  // 1. Tenta o proxy server-side (produção no Vercel — chave fica segura)
  try {
    console.log('Tentando transcrição via proxy...');
    const base64 = await blobToBase64(audioBlob);
    const response = await fetch(apiUrl('/api/transcribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: base64,
        model: selectedModel,
        filename: 'recording.webm',
        mimeType: audioBlob.type || 'audio/webm',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Transcrição via proxy concluída com sucesso.');
      return { text: data.text, language: data.language || 'unknown', model: selectedModel };
    }
    
    console.warn('Proxy de transcrição retornou erro:', response.status);
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 503) {
       console.info('Chave de API não configurada no servidor. Tentando fallback local...');
    } else {
       console.error('Erro na API de transcrição:', errorData);
    }
  } catch (err) {
    console.warn('Proxy de transcrição não disponível ou falhou:', err);
  }

  // 2. Fallback: chamada direta com chave local (dev)
  if (!WHISPER_API_KEY) {
    console.log('Sem VITE_WHISPER_API_KEY. Tentando transcrição via API do navegador...');
    return transcribeWithBrowserAPI(audioBlob);
  }

  try {
    console.log('Tentando transcrição direta via OpenAI API (fallback local)...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', selectedModel);
    formData.append('response_format', 'verbose_json');

    const response = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHISPER_API_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Transcrição direta concluída com sucesso.');
    return { text: data.text, language: data.language || 'unknown', model: selectedModel };
  } catch (error) {
    console.error('Falha na transcrição direta:', error);
    return transcribeWithBrowserAPI(audioBlob);
  }
}

function transcribeWithBrowserAPI(audioBlob) {
  return new Promise((resolve) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      resolve({
        text: '',
        language: 'pt-BR',
        note: 'Transcrição não disponível: configure OPENAI_API_KEY no Vercel.',
        noApiKey: true,
      });
      return;
    }

    // Play the audio blob through an audio element while capturing with SpeechRecognition
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;

    let transcript = '';

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onend = () => {
      URL.revokeObjectURL(audioUrl);
      resolve({ text: transcript.trim(), language: 'pt-BR', model: 'browser-speech-api' });
    };

    recognition.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      resolve({
        text: '',
        language: 'pt-BR',
        note: 'Transcrição não disponível: configure OPENAI_API_KEY no Vercel.',
        noApiKey: true,
      });
    };

    recognition.start();
    audio.play().catch(() => {
      recognition.stop();
    });

    audio.onended = () => recognition.stop();
  });
}

export function createSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'pt-BR';
  return recognition;
}

export async function translateText(text, sourceLang = 'auto', targetLang = 'pt') {
  if (!text || sourceLang === targetLang) return text;

  try {
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: sourceLang, target: targetLang }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.translatedText;
    }
  } catch (error) {
    console.warn('Translation API unavailable:', error);
  }

  return text;
}
