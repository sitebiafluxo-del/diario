/**
 * Gemini Imagen & Vision Integration for Stationery Generation
 * Suporte a Imagen 3 (Google GenAI) + Gemini 2.5/1.5 Flash (Visão Multimodal)
 * com fallback inteligente para garantir que a geração nunca falhe.
 */
import { authFetch } from './apiClient';

export const POSITION_OPTIONS = [
  { id: 'frame', label: 'Moldura', desc: 'Cantos diagonais (estilo clássico)', icon: 'frame' },
  { id: 'top', label: 'Topo', desc: 'Apenas no cabeçalho', icon: 'top' },
  { id: 'bottom', label: 'Baixo', desc: 'Apenas no rodapé', icon: 'bottom' },
  { id: 'sides', label: 'Laterais', desc: 'Nas bordas esquerda e direita', icon: 'sides' },
  { id: 'all', label: 'Todos os lados', desc: 'Borda decorativa completa', icon: 'all' },
];

export const COLOR_MODES = [
  { id: 'color', label: 'Colorido', emoji: '🌈', desc: 'Aquarela em tons pastel harmoniosos' },
  { id: 'mono', label: 'Uma cor só', emoji: '🎨', desc: 'Monocromático no tom escolhido' },
];

export const MONO_PALETTES = [
  { id: 'rosa', label: 'Rosa', hex: '#e8789e', desc: 'Tons suaves de rosa e blush' },
  { id: 'azul', label: 'Azul', hex: '#64b5f6', desc: 'Tons de azul celeste e mar' },
  { id: 'lilas', label: 'Lavanda', hex: '#ba68c8', desc: 'Tons de lilás e lavanda suave' },
  { id: 'verde', label: 'Sálvia', hex: '#81c784', desc: 'Tons de verde botânico e oliva' },
  { id: 'dourado', label: 'Dourado/Terra', hex: '#d4a373', desc: 'Tons de bege, sépia e terra cota' },
  { id: 'cinza', label: 'Grafite', hex: '#757575', desc: 'Tons neutros de grafite e cinza suave' },
];

export const LINE_OPTIONS = [
  { id: 'dotted', label: 'Pontilhadas', desc: 'Linhas pontilhadas delicadas (recomendado)', icon: 'dotted' },
  { id: 'solid', label: 'Contínuas', desc: 'Linhas finas contínuas tradicionais', icon: 'solid' },
  { id: 'none', label: 'Sem linhas', desc: 'Papel limpo sem pautas', icon: 'none' },
];

// Remove chave do Gemini que versões antigas permitiam salvar no navegador
try { localStorage.removeItem('user_gemini_api_key'); } catch { /* ignore */ }

/**
 * Reduz a foto para no máx. 1024px e reencoda em JPEG.
 * Além de economizar banda, REMOVE metadados EXIF (GPS, modelo do celular, data)
 * antes de a foto sair do aparelho.
 */
async function downscaleToJpegBase64(file, maxSide = 1024) {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Imagem inválida'));
      i.src = bitmapUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

/**
 * Traduz termos comuns de português para inglês para máxima qualidade nos modelos de IA
 */
function translateThemeTerms(text) {
  if (!text) return 'vintage roses and delicate wildflowers';
  const t = text.toLowerCase().trim();

  const dict = {
    'rosas vintage': 'vintage soft roses, antique garden flowers',
    'rosa vintage': 'vintage soft roses, antique garden flowers',
    'rosas': 'delicate watercolor roses, botanical floral leaves',
    'rosa': 'delicate pink watercolor roses',
    'borboletas delicadas': 'delicate flying butterflies, floral watercolor accents',
    'borboletas': 'delicate butterflies with pastel watercolor wings',
    'borboleta': 'delicate watercolor butterfly',
    'jardim botânico': 'botanical garden, lush wild leaves and blooming flowers',
    'jardim botanico': 'botanical garden, lush wild leaves and blooming flowers',
    'flores silvestres': 'wildflowers, lavender and meadow botanical blooms',
    'flores': 'delicate pastel flowers, floral blossoms',
    'flor': 'delicate pastel flowers',
    'gatinhos fofos': 'adorable sweet kitten, cute cat illustration',
    'gatinhos': 'cute little kittens with floral wreaths',
    'gato': 'cute watercolor kitten',
    'céu estrelado': 'gentle starry night sky, crescent moon and soft stars',
    'ceu estrelado': 'gentle starry night sky, crescent moon and soft stars',
    'café e livros': 'vintage cozy coffee cup, books and flowers',
    'cafe e livros': 'vintage cozy coffee cup, books and flowers',
    'conchas do mar': 'delicate sea shells, starfish, ocean pearls, coastal watercolor',
    'moranguinhos': 'cute sweet red strawberries and little blossoms',
    'morango': 'sweet strawberries and blossoms',
    'passarinhos': 'little singing birds, botanical twigs',
    'passarinho': 'little cute bird on floral branch',
    'lavanda': 'purple lavender blossoms and herbal greenery',
    'girassol': 'bright watercolor sunflowers and greenery',
    'girassois': 'bright watercolor sunflowers and greenery',
    'corações': 'delicate romantic little hearts, pastel ribbons',
    'coracoes': 'delicate romantic little hearts, pastel ribbons'
  };

  // Passada ÚNICA sobre o texto original, termos mais longos primeiro e com
  // limites de palavra Unicode. Antes, cada substituição rodava sobre o texto já
  // traduzido e 'flor' casava dentro de 'floral' ("flowersal").
  const terms = Object.keys(dict).sort((a, b) => b.length - a.length);
  const escaped = terms.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<!\\p{L})(${escaped.join('|')})(?!\\p{L})`, 'gu');
  return t.replace(re, (m) => dict[m]);
}

/**
 * Analisa uma imagem enviada pelo usuário usando Gemini Multimodal Vision
 */
export async function analyzeImageForStationery(file) {
  try {
    const { base64, mimeType } = await downscaleToJpegBase64(file);
    // Chamada via servidor: a chave do Gemini nunca chega ao navegador
    const info = await authFetch('/api/analyze-image', { body: { image: base64, mimeType } });
    if (info?.portugueseSummary) return info;
  } catch (err) {
    console.warn('Análise de imagem indisponível:', err.message);
  }

  return {
    themeDescription: 'delicate watercolor illustration inspired by the uploaded visual elements',
    suggestedColors: 'soft pastel watercolor',
    portugueseSummary: 'Tema inspirado na foto'
  };
}

/**
 * Constrói o prompt detalhado para gerar o papel de carta
 */
export function buildStationeryPrompt({ theme, position = 'frame', colorMode = 'color', monoColor = 'rosa', lineStyle = 'dotted', analyzedInfo = null }) {
  const rawTheme = (theme && theme.trim()) || analyzedInfo?.themeDescription || 'vintage roses and delicate wildflowers';
  const translatedTheme = translateThemeTerms(rawTheme);

  // Regra de posição dos elementos decorativos
  let layoutRule;
  if (position === 'top') {
    layoutRule = 'delicate decorative watercolor border along top edge only, large completely empty pure white center and bottom for handwriting';
  } else if (position === 'bottom') {
    layoutRule = 'delicate decorative watercolor border along bottom edge only, large completely empty pure white center and top for handwriting';
  } else if (position === 'sides') {
    layoutRule = 'delicate floral watercolor borders along left and right margins, large clean empty pure white center for writing';
  } else if (position === 'all') {
    layoutRule = 'delicate botanical watercolor frame border along all outer edges, wide clean empty pure white center for writing';
  } else {
    // 'frame' / diagonal clássica
    layoutRule = 'delicate watercolor botanical accents strictly in opposing top-left and bottom-right corners, leaving all other space completely blank and pure white for writing';
  }

  // Regra de cor
  let colorRule;
  if (colorMode === 'mono') {
    const palObj = MONO_PALETTES.find(p => p.id === monoColor) || MONO_PALETTES[0];
    colorRule = `monochromatic single-color shades of ${palObj.label} (${palObj.desc})`;
  } else {
    colorRule = 'soft pastel watercolor tones, delicate watercolor painting';
  }

  // Regra de linhas
  let lineRule;
  if (lineStyle === 'dotted') {
    lineRule = 'with faint subtle dotted horizontal writing lines across the center';
  } else if (lineStyle === 'solid') {
    lineRule = 'with very faint delicate thin horizontal lines for writing';
  } else {
    lineRule = 'clean unruled white page, no lines';
  }

  // Design 100% plano (2D flat graphic design), sem mockups, sem sombras e sem mesas
  return `Flat 2D printable stationery page background design, top-down flat lay view, edge-to-edge border illustration of ${translatedTheme}, ${layoutRule}, ${colorRule}, ${lineRule}, hand-painted watercolor art style, solid pure white canvas background (#ffffff), perfectly centered, no photo of paper, no mockup, no drop shadow, no tabletop, no frame border, clean empty center for handwriting`;
}

/**
 * Carrega imagem a partir de uma URL e transforma em Blob de forma segura e resiliente.
 * Faz a requisição diretamente do navegador do usuário com suporte nativo a CORS.
 */
async function fetchImageAsBlob(url, timeoutMs = 25000) {
  // 1. Tentar via fetch() direto (mais limpo e preserva integridade do arquivo)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        // Só aceita imagem de verdade (páginas de erro/JSON também podem ter >5KB)
        if (blob && blob.size > 5000 && blob.type.startsWith('image/')) {
          return blob;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (fetchErr) {
    console.warn('Fetch direto falhou ou demorou, tentando fallback via elemento Image:', fetchErr.message);
  }

  // 2. Fallback via elemento HTMLImageElement + Canvas
  return new Promise((resolve, reject) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        reject(new Error('Tempo esgotado ao carregar imagem'));
      }
    }, timeoutMs);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 768;
        canvas.height = img.naturalHeight || img.height || 1088;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao processar canvas'));
        }, 'image/jpeg', 0.94);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      reject(new Error('Falha ao carregar imagem pelo navegador'));
    };

    img.src = url;
  });
}

/**
 * Gera o papel de carta usando proporção A5 exata (768 x 1088 = 1 : 1.416)
 * e filtros rigorosos para impedir mockups 3D, mesas e distorção.
 */
export async function generateStationeryPaper(options) {
  const { theme, position, colorMode, monoColor, lineStyle, analyzedInfo } = options;
  const prompt = buildStationeryPrompt({ theme, position, colorMode, monoColor, lineStyle, analyzedInfo });
  const encodedPrompt = encodeURIComponent(prompt);
  
  // Prompt negativo estrito: impede mockups de papel, sombras de mesa e fundo cinza
  const negPrompt = encodeURIComponent(
    'mockup, 3d render, photo of paper, paper sheet on desk, tabletop, wooden table, gray background, shadows, drop shadow, perspective angle, torn paper, deckle edge, frame mockup, border mockup, dark, ugly, text, watermark, logo, human faces, portraits'
  );

  // Proporção A5 real: 768px de largura por 1088px de altura (múltiplos de 64 para redes neurais)
  const A5_W = 768;
  const A5_H = 1088;

  // Chamada direta à API do Pollinations a partir do navegador do cliente (CORS nativo habilitado)
  const baseUrl = 'https://image.pollinations.ai';

  // 1. Tentar primeiro com o motor Turbo (rápido, gera em 3 a 6 segundos)
  try {
    const turboUrl = `${baseUrl}/prompt/${encodedPrompt}?width=${A5_W}&height=${A5_H}&model=turbo&nologo=true&seed=${Date.now()}&negative_prompt=${negPrompt}`;
    const blob = await fetchImageAsBlob(turboUrl, 25000);
    return { blob, prompt, engine: 'turbo' };
  } catch (err1) {
    console.warn('Motor Turbo demorou ou falhou, tentando motor padrão:', err1.message);
  }

  // 2. Se o Turbo falhar, tenta com motor padrão sem restrição de modelo
  try {
    const defaultUrl = `${baseUrl}/prompt/${encodedPrompt}?width=${A5_W}&height=${A5_H}&nologo=true&seed=${Date.now()}&negative_prompt=${negPrompt}`;
    const blob = await fetchImageAsBlob(defaultUrl, 25000);
    return { blob, prompt, engine: 'default' };
  } catch (err2) {
    console.warn('Motor padrão falhou, tentando motor Flux:', err2.message);
  }

  // 3. Fallback com motor Flux
  const fluxUrl = `${baseUrl}/prompt/${encodedPrompt}?width=${A5_W}&height=${A5_H}&model=flux&nologo=true&seed=${Date.now()}&negative_prompt=${negPrompt}`;
  const blob = await fetchImageAsBlob(fluxUrl, 30000);
  return { blob, prompt, engine: 'flux' };
}
