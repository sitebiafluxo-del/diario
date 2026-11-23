/**
 * Validação de URLs de imagem vindas do banco/localStorage antes de usá-las
 * em CSS (`background-image`) ou em <img>/canvas.
 *
 * Política: só aceita
 *  - assets do próprio app em /backgrounds/ ou /assets/ (sem "..", sem "\" e sem "//")
 *  - blob: criados por esta mesma origem
 *  - data:image raster em base64 (SVG é recusado: pode conter script)
 *  - https:// do projeto Supabase (URLs assinadas do storage)
 */
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const LOCAL_ASSET_RE = /^\/(backgrounds|assets)\/[A-Za-z0-9_\-./]+$/;

function allowedHosts() {
  const hosts = new Set();
  try {
    const sb = import.meta.env.VITE_SUPABASE_URL;
    if (sb) hosts.add(new URL(sb).hostname);
  } catch { /* ignore */ }
  return hosts;
}
const ALLOWED_HOSTS = allowedHosts();

export function isSafeImageUrl(url) {
  if (typeof url !== 'string' || !url || url.length > 20_000_000) return false;

  if (url.startsWith('/')) {
    return LOCAL_ASSET_RE.test(url) && !url.includes('..') && !url.includes('//');
  }
  if (url.startsWith('blob:')) {
    return typeof location !== 'undefined' && url.startsWith(`blob:${location.origin}/`);
  }
  if (url.startsWith('data:')) {
    return DATA_IMAGE_RE.test(url);
  }
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Retorna o valor pronto para `backgroundImage`, ou 'none' se a URL não for segura. */
export function cssImageUrl(url) {
  if (!isSafeImageUrl(url)) return 'none';
  // Defesa extra: escapa o que poderia encerrar o url("...")
  const ENC = { '"': '%22', "'": '%27', '(': '%28', ')': '%29', '\\': '%5C', '\n': '%0A', '\r': '%0D' };
  const escaped = url.replace(/["'()\\\n\r]/g, (c) => ENC[c]);
  return `url("${escaped}")`;
}
