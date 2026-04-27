/**
 * Whisper API integration for audio transcription
 * Uses OpenAI-compatible Whisper API or free alternatives
 */

const WHISPER_API_URL = import.meta.env.VITE_WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
const WHISPER_API_KEY = import.meta.env.VITE_WHISPER_API_KEY || '';

/**
 * Transcribe audio using Whisper API
 * @param {Blob} audioBlob - Audio blob to transcribe
 * @returns {Promise<{text: string, language: string}>}
 */
export async function transcribeAudio(audioBlob) {
  // If no API key, use browser Speech Recognition as fallback
  if (!WHISPER_API_KEY) {
    return transcribeWithBrowserAPI(audioBlob);
  }

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const response = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHISPER_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      language: data.language || 'unknown',
    };
  } catch (error) {
    console.error('Transcription failed:', error);
    // Fallback to browser API
    return transcribeWithBrowserAPI(audioBlob);
  }
}

/**
 * Fallback: Use browser's SpeechRecognition for live transcription
 */
function transcribeWithBrowserAPI() {
  return new Promise((resolve) => {
    // This is a placeholder - browser SpeechRecognition works with live audio
    // For recorded audio, we need an API
    resolve({
      text: '',
      language: 'pt-BR',
      note: 'Configure VITE_WHISPER_API_KEY para transcrição automática de áudio gravado.',
    });
  });
}

/**
 * Create a live speech recognition instance
 * @returns {SpeechRecognition|null}
 */
export function createSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'pt-BR';

  return recognition;
}

/**
 * Translate text using a free translation API
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>}
 */
export async function translateText(text, sourceLang = 'auto', targetLang = 'pt') {
  if (!text || sourceLang === targetLang) return text;

  try {
    // Using LibreTranslate (free, self-hostable)
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
      }),
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
