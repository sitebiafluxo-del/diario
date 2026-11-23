/**
 * Geração de papéis de carta (Pollinations, no aparelho do usuário — gratuito)
 * + análise da foto de inspiração:
 *   1. SEMPRE no próprio aparelho (cores dominantes): grátis, instantâneo, sem limite
 *   2. Gemini (servidor, plano gratuito) como extra opcional para nomear o tema;
 *      se a cota grátis acabar ou demorar, o app segue só com o resultado local.
 */
import { authFetch } from './apiClient';
import { MONO_PALETTES, buildStationeryPrompt } from './stationeryPrompt';

export { MONO_PALETTES, buildStationeryPrompt };

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



export const LINE_OPTIONS = [
  { id: 'dotted', label: 'Pontilhadas', desc: 'Linhas pontilhadas delicadas (recomendado)', icon: 'dotted' },
  { id: 'solid', label: 'Contínuas', desc: 'Linhas finas contínuas tradicionais', icon: 'solid' },
  { id: 'none', label: 'Sem linhas', desc: 'Papel limpo sem pautas', icon: 'none' },
];

// Remove chave do Gemini que versões antigas permitiam salvar no navegador
try { localStorage.removeItem('user_gemini_api_key'); } catch { /* ignore */ }

function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
    img.src = url;
  });
}

/**
 * Reduz a foto para no máx. 1024px e reencoda em JPEG.
 * Além de economizar banda, REMOVE metadados EXIF (GPS, modelo do celular, data)
 * antes de a foto sair do aparelho.
 */
function toJpegBase64(img, maxSide = 1024) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}

// Famílias de cor: faixa de matiz (graus) → nome em português e inglês
const HUE_FAMILIES = [
  { max: 15, pt: 'vermelho', en: 'soft red' },
  { max: 40, pt: 'laranja', en: 'peach and soft orange' },
  { max: 65, pt: 'amarelo', en: 'buttery yellow' },
  { max: 160, pt: 'verde', en: 'sage and leafy green' },
  { max: 200, pt: 'turquesa', en: 'aqua and turquoise' },
  { max: 255, pt: 'azul', en: 'soft sky blue' },
  { max: 290, pt: 'lilás', en: 'lavender and lilac' },
  { max: 352, pt: 'rosa', en: 'blush pink and rose' },
  { max: 360, pt: 'vermelho', en: 'soft red' },
];

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/**
 * Análise LOCAL da foto (roda no aparelho, sem rede, sem custo, sem limite):
 * identifica as 2–3 famílias de cor dominantes.
 */
export function analyzePaletteLocally(img) {
  const SIZE = 48;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const weights = new Map();
  let neutral = 0, colored = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [h, sat, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l > 0.92 || l < 0.08 || sat < 0.18) { neutral++; continue; } // fundo branco/preto/cinza
    colored++;
    let fam = HUE_FAMILIES.find((f) => h <= f.max);
    // Laranja/amarelo claros e pouco saturados são bege/areia, não laranja
    if (h > 15 && h <= 65 && l > 0.7 && sat < 0.7) fam = { pt: 'bege', en: 'warm beige and sand' };
    const key = fam.pt;
    const prev = weights.get(key) || { ...fam, w: 0 };
    prev.w += sat; // cores mais vivas pesam mais
    weights.set(key, prev);
  }

  const top = [...weights.values()].sort((a, b) => b.w - a.w)
    .filter((f, idx, arr) => idx === 0 || f.w >= arr[0].w * 0.12)
    .slice(0, 3);

  if (top.length === 0 || colored < neutral * 0.05) {
    return {
      themeDescription: 'elegant neutral watercolor botanical elements in soft beige and warm gray',
      suggestedColors: 'soft beige, warm gray and cream',
      portugueseSummary: 'Tons neutros da sua foto',
    };
  }

  const ptNames = top.map((f) => f.pt);
  const ptList = ptNames.length > 1 ? `${ptNames.slice(0, -1).join(', ')} e ${ptNames.at(-1)}` : ptNames[0];
  const enList = top.map((f) => f.en).join(', ');
  return {
    themeDescription: `delicate watercolor flowers and leaves in ${enList} tones`,
    suggestedColors: enList,
    portugueseSummary: `Tons de ${ptList} da sua foto`,
  };
}

const ONLINE_ANALYSIS_TIMEOUT_MS = 8000;


/**
 * Analisa uma imagem enviada pelo usuário usando Gemini Multimodal Vision
 */
export async function analyzeImageForStationery(file) {
  const { img, release } = await loadImageFromFile(file);
  try {
    // 1. Sempre funciona: análise local de cores (grátis e sem limite)
    const local = analyzePaletteLocally(img);

    // 2. Extra opcional: Gemini (plano gratuito) para dar nome ao tema.
    //    Se não estiver logado, a cota grátis acabar ou demorar, segue com o local.
    try {
      const { base64, mimeType } = toJpegBase64(img);
      const online = await Promise.race([
        authFetch('/api/analyze-image', { body: { image: base64, mimeType } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ONLINE_ANALYSIS_TIMEOUT_MS)),
      ]);
      if (online?.portugueseSummary) {
        return {
          themeDescription: online.themeDescription,
          // as cores medidas no aparelho são exatas; usa as duas fontes
          suggestedColors: `${local.suggestedColors}, ${online.suggestedColors}`,
          portugueseSummary: online.portugueseSummary,
        };
      }
    } catch (err) {
      console.info('Análise online indisponível, usando análise local:', err.message);
    }
    return local;
  } finally {
    release();
  }
}

/**
 * Constrói o prompt detalhado para gerar o papel de carta
 */

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
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
      // Limite gratuito do Pollinations: 1 imagem a cada ~45s por IP
      if (res.status === 402 || res.status === 429) {
        const wait = parseInt(res.headers.get('retry-after') || '45', 10);
        const err = new Error(`Aguarde ${wait} segundos para criar outro papel.`);
        err.code = 'RATE_LIMIT';
        err.retryAfter = wait;
        throw err;
      }
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
    if (fetchErr.code === 'RATE_LIMIT') throw fetchErr; // não adianta insistir agora
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
  const { theme, position, colorMode, monoColor, analyzedInfo, fresh = false } = options;
  const prompt = buildStationeryPrompt({ theme, position, colorMode, monoColor, analyzedInfo });

  // 1. Principal: Cloudflare (FLUX.2) pelo servidor — sem marca d'água, formato A5.
  //    Só para quem entrou com Google. Se a cota do dia acabar, cai no Pollinations.
  try {
    const data = await authFetch('/api/generate-paper', {
      body: {
        theme: theme || analyzedInfo?.portugueseSummary || '',
        position,
        colorMode,
        monoColor,
        suggestedColors: analyzedInfo?.suggestedColors || '',
        fresh,
      },
    });
    if (data?.image) {
      return { blob: base64ToBlob(data.image, 'image/jpeg'), prompt, engine: data.source || 'cloudflare' };
    }
  } catch (err) {
    if (err.status === 422) throw err; // tema recusado pelo filtro: mostrar a mensagem
    console.info('Gerador principal indisponível, usando reserva:', err.message);
  }

  const encodedPrompt = encodeURIComponent(prompt);
  
  // Prompt negativo estrito: impede mockups de papel, sombras de mesa e fundo cinza
  const negPrompt = encodeURIComponent(
    'mockup, 3d render, photo of paper, paper sheet on desk, tabletop, wooden table, gray background, shadows, drop shadow, perspective angle, torn paper, deckle edge, frame mockup, border mockup, dark, ugly, text, watermark, logo, human faces, portraits'
  );

  // Proporção A5 real: 768px de largura por 1088px de altura (múltiplos de 64 para redes neurais)
  const A5_W = 768;
  const A5_H = 1088;

  // Pollinations direto do navegador (grátis; 1 imagem/45s por pessoa)
  const baseUrl = 'https://image.pollinations.ai';

  // 1. Tentar primeiro com o motor Turbo (rápido, gera em 3 a 6 segundos)
  try {
    const turboUrl = `${baseUrl}/prompt/${encodedPrompt}?width=${A5_W}&height=${A5_H}&model=turbo&nologo=true&seed=${Date.now()}&negative_prompt=${negPrompt}`;
    const blob = await fetchImageAsBlob(turboUrl, 25000);
    return { blob, prompt, engine: 'turbo' };
  } catch (err1) {
    if (err1.code === 'RATE_LIMIT') throw err1; // os motores dividem o mesmo limite
    console.warn('Motor Turbo demorou ou falhou, tentando motor padrão:', err1.message);
  }

  // 2. Se o Turbo falhar, tenta com motor padrão sem restrição de modelo
  try {
    const defaultUrl = `${baseUrl}/prompt/${encodedPrompt}?width=${A5_W}&height=${A5_H}&nologo=true&seed=${Date.now()}&negative_prompt=${negPrompt}`;
    const blob = await fetchImageAsBlob(defaultUrl, 25000);
    return { blob, prompt, engine: 'default' };
  } catch (err2) {
    if (err2.code === 'RATE_LIMIT') throw err2; // os motores dividem o mesmo limite
    console.warn('Motor padrão falhou, tentando motor Flux:', err2.message);
  }

  // 3. Fallback com motor Flux
  const fluxUrl = `${baseUrl}/prompt/${encodedPrompt}?width=${A5_W}&height=${A5_H}&model=flux&nologo=true&seed=${Date.now()}&negative_prompt=${negPrompt}`;
  const blob = await fetchImageAsBlob(fluxUrl, 30000);
  return { blob, prompt, engine: 'flux' };
}
