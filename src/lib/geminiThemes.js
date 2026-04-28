/**
 * Gemini AI Theme Generator
 * Generates dynamic visual themes using Google Gemini API
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Pre-defined themes as fallback
export const DEFAULT_THEMES = {
  caderno: {
    name: 'Caderno Clássico',
    emoji: '📓',
    background: 'linear-gradient(to bottom, #fdf6e3, #fef9ef)',
    primaryColor: '#c9a87c',
    secondaryColor: '#e8d5b7',
    accentColor: '#d4956a',
    textColor: '#4a3728',
    textSecondary: '#7a6555',
    surfaceColor: '#fffdf7',
    font: "'Patrick Hand', cursive",
    lineStyle: 'solid',
    lineColor: 'rgba(173, 216, 230, 0.3)',
    cardBg: 'rgba(255, 253, 247, 0.9)',
  },
  rosa: {
    name: 'Rosa Suave',
    emoji: '🌸',
    background: 'linear-gradient(135deg, #fce4ec, #f8bbd9, #f3e5f5)',
    primaryColor: '#e91e63',
    secondaryColor: '#f48fb1',
    accentColor: '#ad1457',
    textColor: '#4a1942',
    textSecondary: '#7b4a6e',
    surfaceColor: 'rgba(255, 241, 245, 0.95)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'dashed',
    lineColor: 'rgba(233, 30, 99, 0.12)',
    cardBg: 'rgba(252, 228, 236, 0.85)',
  },
  oceano: {
    name: 'Oceano Calmo',
    emoji: '🌊',
    background: 'linear-gradient(135deg, #e0f7fa, #b2ebf2, #e8f5e9)',
    primaryColor: '#00838f',
    secondaryColor: '#4dd0e1',
    accentColor: '#006064',
    textColor: '#1a3a4a',
    textSecondary: '#4a6a7a',
    surfaceColor: 'rgba(240, 253, 255, 0.95)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'wavy',
    lineColor: 'rgba(0, 131, 143, 0.1)',
    cardBg: 'rgba(224, 247, 250, 0.85)',
  },
  lavanda: {
    name: 'Lavanda Noturna',
    emoji: '🌙',
    background: 'linear-gradient(135deg, #ede7f6, #e1bee7, #d1c4e9)',
    primaryColor: '#7e57c2',
    secondaryColor: '#b39ddb',
    accentColor: '#4527a0',
    textColor: '#2a1a4a',
    textSecondary: '#5a4a7a',
    surfaceColor: 'rgba(245, 240, 255, 0.95)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'dotted',
    lineColor: 'rgba(126, 87, 194, 0.1)',
    cardBg: 'rgba(237, 231, 246, 0.85)',
  },
  floresta: {
    name: 'Floresta Verde',
    emoji: '🌿',
    background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9, #f1f8e9)',
    primaryColor: '#2e7d32',
    secondaryColor: '#81c784',
    accentColor: '#1b5e20',
    textColor: '#1a3a1a',
    textSecondary: '#4a6a4a',
    surfaceColor: 'rgba(245, 255, 245, 0.95)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'solid',
    lineColor: 'rgba(46, 125, 50, 0.1)',
    cardBg: 'rgba(232, 245, 233, 0.85)',
  },
  noite: {
    name: 'Modo Escuro',
    emoji: '🌑',
    background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
    primaryColor: '#e94560',
    secondaryColor: '#533483',
    accentColor: '#e94560',
    textColor: '#eee',
    textSecondary: '#aaa',
    surfaceColor: 'rgba(30, 30, 50, 0.95)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'solid',
    lineColor: 'rgba(233, 69, 96, 0.1)',
    cardBg: 'rgba(26, 26, 46, 0.85)',
  },
  scrapbook_turquesa: {
    name: 'Scrapbook Turquesa',
    emoji: '🎨',
    background: 'url("/backgrounds/scrapbook_turquoise.png")',
    primaryColor: '#4db6ac',
    secondaryColor: '#b2dfdb',
    accentColor: '#00897b',
    textColor: '#004d40',
    textSecondary: '#00796b',
    surfaceColor: 'rgba(255, 255, 255, 0.85)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'solid',
    lineColor: 'rgba(0, 0, 0, 0.05)',
    cardBg: 'rgba(255, 255, 255, 0.9)',
    isImage: true,
  },
  scrapbook_lavanda: {
    name: 'Scrapbook Lavanda',
    emoji: '🦋',
    background: 'url("/backgrounds/scrapbook_lavender.png")',
    primaryColor: '#9575cd',
    secondaryColor: '#d1c4e9',
    accentColor: '#673ab7',
    textColor: '#311b92',
    textSecondary: '#512da8',
    surfaceColor: 'rgba(255, 255, 255, 0.85)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'solid',
    lineColor: 'rgba(0, 0, 0, 0.05)',
    cardBg: 'rgba(255, 255, 255, 0.9)',
    isImage: true,
  },
  scrapbook_vintage: {
    name: 'Scrapbook Vintage',
    emoji: '📜',
    background: 'url("/backgrounds/scrapbook_vintage.png")',
    primaryColor: '#a1887f',
    secondaryColor: '#d7ccc8',
    accentColor: '#795548',
    textColor: '#3e2723',
    textSecondary: '#5d4037',
    surfaceColor: 'rgba(255, 255, 255, 0.85)',
    font: "'Patrick Hand', cursive",
    lineStyle: 'solid',
    lineColor: 'rgba(0, 0, 0, 0.05)',
    cardBg: 'rgba(255, 255, 255, 0.9)',
    isImage: true,
  },
};

/**
 * Generate a theme using Gemini AI
 * @param {string} prompt - Theme description prompt
 * @returns {Promise<object>} Theme object
 */
export async function generateThemeWithGemini(prompt) {
  // 1. Tenta o proxy server-side (produção no Vercel)
  try {
    const response = await fetch('/api/generate-theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (response.ok) {
      const theme = await response.json();
      if (theme.name && theme.primaryColor) return theme;
    }
    // 503 = chave não configurada no servidor; 404 = dev local
  } catch (_) {}

  // 2. Fallback: chamada direta com chave local (dev)
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not configured. Using default theme.');
    return null;
  }

  try {
    const systemPrompt = `Você é um designer de temas para um app de diário pessoal.
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

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nPedido do usuário: ${prompt}` }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 500 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Gemini theme generation failed:', error);
    return null;
  }
}

/**
 * Apply a theme to the document
 * @param {object} theme - Theme object
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  
  if (theme.isImage) {
    root.style.setProperty('--bg-gradient', theme.background);
    root.style.setProperty('--bg-size', 'cover');
    root.style.setProperty('--bg-position', 'center');
    root.style.setProperty('--notebook-bg', 'transparent');
  } else {
    root.style.setProperty('--bg-gradient', theme.background);
    root.style.setProperty('--bg-size', 'auto');
    root.style.setProperty('--bg-position', '0 0');
    root.style.setProperty('--notebook-bg', 'var(--surface)');
  }

  root.style.setProperty('--primary', theme.primaryColor);
  root.style.setProperty('--secondary', theme.secondaryColor);
  root.style.setProperty('--accent', theme.accentColor);
  root.style.setProperty('--text-primary', theme.textColor);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--surface', theme.surfaceColor);
  root.style.setProperty('--font-main', theme.font);
  root.style.setProperty('--line-style', theme.lineStyle);
  root.style.setProperty('--line-color', theme.lineColor);
  root.style.setProperty('--card-bg', theme.cardBg);
}

/**
 * Get saved theme or default
 */
export function getSavedTheme() {
  try {
    const saved = localStorage.getItem('bia-diary-theme');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load saved theme');
  }
  return DEFAULT_THEMES.caderno;
}

/**
 * Save theme to local storage
 */
export function saveTheme(theme) {
  localStorage.setItem('bia-diary-theme', JSON.stringify(theme));
}
