/**
 * Gerenciador de armazenamento híbrido (Supabase Cloud + LocalStorage Fallback)
 * para papéis de carta salvos.
 * Permite múltiplos usuários isolados por RLS e funciona offline.
 */

import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'bia_magic_stationery_papers';
const BUCKET = 'stationery-images';
const STORAGE_REF_PREFIX = `storage://${BUCKET}/`;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6; // 6h
// <uid>/<uuid>.<ext> — rejeita "..", barras extras e qualquer outro formato
const SAFE_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;  // arquivo original aceito do usuário
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;  // após reencodar (igual ao limite do bucket)
const MAX_SIDE_PX = 2000;
const ALLOWED_UPLOAD_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Modelos iniciais prontos de exemplo
const INITIAL_PAPERS = [
  {
    id: 'paper_default_roses',
    title: 'Rosas Românticas',
    imageUrl: '/backgrounds/stationery_roses.svg',
    createdAt: new Date().toISOString(),
    content: '',
    options: { position: 'frame', colorMode: 'color', lineStyle: 'dotted' }
  },
  {
    id: 'paper_default_floral',
    title: 'Jardim de Tulipas',
    imageUrl: '/backgrounds/stationery_floral.png',
    createdAt: new Date().toISOString(),
    content: '',
    options: { position: 'frame', colorMode: 'color', lineStyle: 'dotted' }
  },
  {
    id: 'paper_default_garden',
    title: 'Hortênsias e Flores',
    imageUrl: '/backgrounds/stationery_garden.png',
    createdAt: new Date().toISOString(),
    content: '',
    options: { position: 'top', colorMode: 'color', lineStyle: 'solid' }
  },
  {
    id: 'paper_default_vintage',
    title: 'Scrapbook Vintage',
    imageUrl: '/backgrounds/scrapbook_vintage.png',
    createdAt: new Date().toISOString(),
    content: '',
    options: { position: 'all', colorMode: 'color', lineStyle: 'solid' }
  }
];

function isCloudUser(userId) {
  return isSupabaseConfigured() && !!userId && userId !== 'local';
}

// Cache separado por usuário: evita que papéis de uma conta apareçam
// para outra pessoa (ou para o modo offline) no mesmo aparelho.
function storageKeyFor(userId) {
  return isCloudUser(userId) ? `${STORAGE_KEY}__${userId}` : STORAGE_KEY;
}

export function getLocalPapers(userId) {
  const key = storageKeyFor(userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      // Primeira execução: semeia os modelos de exemplo apenas no modo offline
      return isCloudUser(userId) ? [] : [...INITIAL_PAPERS];
    }
    const parsed = JSON.parse(raw);
    // Lista vazia é válida (usuário apagou tudo) — não ressuscita os exemplos
    return Array.isArray(parsed) ? parsed : [...INITIAL_PAPERS];
  } catch (err) {
    console.error('Erro ao ler papéis locais:', err);
    return isCloudUser(userId) ? [] : [...INITIAL_PAPERS];
  }
}

/**
 * Salva no localStorage. Lança erro amigável se a cota estourar
 * (imagens em base64 ocupam centenas de KB cada; o limite é ~5MB).
 */
export function saveLocalPapers(papers, userId) {
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(papers));
  } catch (err) {
    const isQuota = err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014;
    if (isQuota) {
      throw new Error(
        'Espaço de armazenamento do navegador cheio. Exclua alguns papéis ou entre com Google para salvar na nuvem.',
        { cause: err }
      );
    }
    throw err;
  }
}

/**
 * Apaga do aparelho o cache de TODAS as contas na nuvem (chamado no logout),
 * para que o conteúdo das cartas não fique legível por quem usar o aparelho depois.
 */
export function clearCloudCaches() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${STORAGE_KEY}__`))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * Extrai o caminho no bucket a partir do valor salvo no banco.
 * Aceita a referência nova (storage://bucket/path) e URLs públicas antigas.
 */
function storagePathFromRef(ref) {
  if (typeof ref !== 'string') return null;
  if (ref.startsWith(STORAGE_REF_PREFIX)) {
    const path = ref.slice(STORAGE_REF_PREFIX.length);
    return SAFE_PATH_RE.test(path) ? path : null;
  }
  const legacy = `/storage/v1/object/public/${BUCKET}/`;
  const i = ref.indexOf(legacy);
  if (i !== -1) {
    try {
      return decodeURIComponent(ref.slice(i + legacy.length).split('?')[0]);
    } catch {
      return null; // %-encoding inválido não pode derrubar a galeria inteira
    }
  }
  return null;
}

/**
 * O bucket é PRIVADO: as imagens só são acessíveis por URLs assinadas e temporárias,
 * geradas para o dono (RLS do storage). Converte imageRef → imageUrl exibível.
 */
async function resolvePaperImages(papers) {
  const paths = [...new Set(papers.map((p) => storagePathFromRef(p.imageRef)).filter(Boolean))];
  if (paths.length === 0 || !supabase) return papers;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn('Não foi possível assinar URLs das imagens:', error.message);
    return papers;
  }
  const byPath = new Map((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  return papers.map((p) => {
    const path = storagePathFromRef(p.imageRef);
    return path && byPath.has(path) ? { ...p, imageUrl: byPath.get(path) } : p;
  });
}

/**
 * Busca os papéis salvos. Se o Supabase estiver logado, busca da nuvem.
 */
export async function getSavedPapersAsync(userId) {
  if (isCloudUser(userId)) {
    try {
      const { data, error } = await supabase
        .from('papers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mapped = (data || []).map(row => ({
        id: row.id,
        title: row.title,
        imageRef: row.image_url,
        imageUrl: storagePathFromRef(row.image_url) ? null : row.image_url,
        content: row.content || '',
        options: row.options,
        createdAt: row.created_at
      }));
      try {
        // Cache sem as URLs assinadas (expiram); elas são geradas de novo a cada carga
        saveLocalPapers(mapped, userId);
      } catch (cacheErr) {
        console.warn('Não foi possível atualizar o cache local:', cacheErr.message);
      }
      return resolvePaperImages(mapped);
    } catch (err) {
      console.warn('Erro ao carregar papéis do Supabase, usando cache local:', err.message);
    }
  }
  const cached = getLocalPapers(userId);
  return isCloudUser(userId) ? resolvePaperImages(cached).catch(() => cached) : cached;
}

export function getSavedPapers(userId) {
  return getLocalPapers(userId);
}

/**
 * Adiciona um novo papel
 */
export async function addPaperAsync(paperData, userId) {
  const localPaper = {
    id: `paper_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: String(paperData.title || 'Papel de Carta').slice(0, 120),
    imageRef: paperData.imageUrl,
    imageUrl: storagePathFromRef(paperData.imageUrl) ? null : paperData.imageUrl,
    createdAt: new Date().toISOString(),
    content: paperData.content || '',
    options: paperData.options || { position: 'frame', colorMode: 'color', lineStyle: 'dotted' }
  };

  // Salva no banco de dados na nuvem se autenticado
  if (isCloudUser(userId)) {
    try {
      const { data, error } = await supabase
        .from('papers')
        .insert([{
          user_id: userId,
          title: localPaper.title,
          image_url: localPaper.imageRef,
          content: localPaper.content,
          options: localPaper.options
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) localPaper.id = data.id;
    } catch (err) {
      // Não deixa imagem órfã ocupando a cota de storage do usuário
      const orphan = storagePathFromRef(localPaper.imageRef);
      if (orphan) await supabase.storage.from(BUCKET).remove([orphan]).catch(() => {});
      // Sem isso o papel "sumiria" na próxima carga (a nuvem é a fonte da verdade)
      throw new Error('Não foi possível salvar o papel na nuvem: ' + err.message, { cause: err });
    }
  }

  const current = getLocalPapers(userId);
  saveLocalPapers([localPaper, ...current], userId);
  if (isCloudUser(userId)) {
    const [resolved] = await resolvePaperImages([localPaper]);
    return resolved;
  }
  return localPaper;
}


/**
 * Atualiza um papel existente
 */
export async function updatePaperAsync(id, updates, userId) {
  if (isCloudUser(userId)) {
    try {
      const dbUpdates = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.options !== undefined) dbUpdates.options = updates.options;
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('papers')
        .update(dbUpdates)
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.warn('Erro ao atualizar na nuvem:', err.message);
    }
  }

  const current = getLocalPapers(userId);
  const updated = current.map(p => p.id === id ? { ...p, ...updates } : p);
  saveLocalPapers(updated, userId);
  return updated.find(p => p.id === id);
}


/**
 * Exclui um papel
 */
export async function deletePaperAsync(id, userId) {
  if (isCloudUser(userId)) {
    try {
      const { data: deleted, error } = await supabase
        .from('papers')
        .delete()
        .eq('id', id)
        .select('image_url');
      if (error) throw error;

      // Remove também a imagem do Storage (a pessoa excluiu: não deve sobrar cópia)
      const paths = (deleted || []).map((r) => storagePathFromRef(r.image_url)).filter(Boolean);
      if (paths.length) {
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (rmErr) console.warn('Imagem não removida do storage:', rmErr.message);
      }
    } catch (err) {
      console.warn('Erro ao excluir na nuvem:', err.message);
    }
  }

  const current = getLocalPapers(userId);
  const updated = current.filter(p => p.id !== id);
  saveLocalPapers(updated, userId);
  return updated;
}


/**
 * Upload de imagem para o Supabase Storage
 */
/**
 * Reencoda qualquer imagem para JPEG (máx. 2000px):
 *  - remove metadados EXIF (GPS, modelo do celular, data) — privacidade
 *  - garante que o arquivo enviado é realmente uma imagem raster válida
 *  - mantém o tamanho dentro do limite do bucket (3MB)
 */
async function normalizeImageFile(file) {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Arquivo de imagem inválido ou não suportado.'));
      i.src = srcUrl;
    });
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // PNG/GIF transparentes ficam com fundo branco
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], 'imagem.jpg', { type: 'image/jpeg' });
      }
    }
    throw new Error('Imagem muito grande mesmo após compressão.');
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

export async function uploadPaperImage(originalFile, userId) {
  if (!ALLOWED_UPLOAD_TYPES[originalFile?.type]) {
    throw new Error('Formato não suportado. Use JPG, PNG, WEBP ou GIF.');
  }
  if (originalFile.size > MAX_INPUT_BYTES) {
    throw new Error('Imagem muito grande (máximo 25MB).');
  }
  const file = await normalizeImageFile(originalFile);
  const ext = 'jpg';

  if (isCloudUser(userId)) {
    try {
      // Nome aleatório: não expõe o nome original do arquivo da pessoa
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      // upsert:false — caminho é único e upsert exigiria policy de UPDATE no bucket
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) throw error;
      // Guarda só a referência; a URL de acesso é assinada e temporária
      if (data?.path) return `${STORAGE_REF_PREFIX}${data.path}`;
      throw new Error('Resposta inválida do storage');
    } catch (err) {
      // Logado: NÃO cai para data URL (iria gravar MBs no banco). Mostra o erro.
      throw new Error('Não foi possível enviar a imagem para a nuvem: ' + err.message, { cause: err });
    }
  }

  return convertFileToDataUrl(file);
}

export function convertFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
