import jsPDF from 'jspdf';

// Dimensões do canvas (2x para qualidade de impressão)
const PX_W  = 794 * 2;
const PX_H  = 1123 * 2;
const A4_W  = 210;
const A4_H  = 297;
const LINES_PER_PAGE = 12; // deve bater com EntryForm

// ── Tema atual via CSS variables ───────────────────────────────────────────────

function getTheme() {
  const s = getComputedStyle(document.documentElement);
  return {
    textPrimary:   s.getPropertyValue('--text-primary').trim()   || '#4a3728',
    textSecondary: s.getPropertyValue('--text-secondary').trim() || '#7a6555',
    primary:       s.getPropertyValue('--primary').trim()        || '#c9a87c',
    lineColor:     s.getPropertyValue('--line-color').trim()     || 'rgba(173,216,230,0.35)',
    lineStyle:     s.getPropertyValue('--line-style').trim()     || 'solid',
    font:          s.getPropertyValue('--font-main').trim()      || "'Patrick Hand', cursive",
  };
}

// ── Datas formatadas ───────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  });
}

// ── Quebra o conteúdo nas mesmas páginas que o EntryForm ──────────────────────

function splitPages(content) {
  if (!content?.trim()) return [''];
  const lines = content.split('\n');
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE).join('\n'));
  }
  return pages.length > 0 ? pages : [''];
}

// ── Carrega imagem com CORS ────────────────────────────────────────────────────

function loadImage(url) {
  const fullUrl = url.startsWith('/') ? window.location.origin + url : url;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = fullUrl;
  });
}

// ── Linhas tracejadas/pontilhadas/sólidas no canvas ───────────────────────────

function setLineDash(ctx, style) {
  if (style === 'dashed')  ctx.setLineDash([12, 6]);
  else if (style === 'dotted') ctx.setLineDash([3, 6]);
  else                     ctx.setLineDash([]);
}

// ── Quebra linha longa para caber na largura ───────────────────────────────────

function wrapLine(ctx, text, maxWidth) {
  if (!text) return [''];
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(' ');
  const result = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      result.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) result.push(current);
  return result;
}

// ── Renderiza uma página como canvas ──────────────────────────────────────────

async function renderPage({ stationeryImg, isFirstPage, title, mood, createdAt, content, theme, pageNum, totalPages }) {
  // Aguarda fontes carregadas (Patrick Hand, emoji)
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width  = PX_W;
  canvas.height = PX_H;
  const ctx = canvas.getContext('2d');

  // ── 1. Fundo ────────────────────────────────────────────────────────────────
  if (stationeryImg) {
    const ir = stationeryImg.naturalWidth / stationeryImg.naturalHeight;
    const pr = PX_W / PX_H;
    let dw, dh, dx, dy;
    if (ir > pr) { dh = PX_H; dw = PX_H * ir; dx = (PX_W - dw) / 2; dy = 0; }
    else          { dw = PX_W; dh = PX_W / ir; dx = 0; dy = (PX_H - dh) / 2; }
    ctx.drawImage(stationeryImg, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, PX_W, PX_H);
  }

  // ── 2. Layout ────────────────────────────────────────────────────────────────
  const PAD_X    = Math.round(PX_W * 0.075);
  const LINE_H   = Math.round(PX_H / 17);           // altura de linha
  const TEXT_TOP = isFirstPage
    ? Math.round(PX_H * 0.27)
    : Math.round(PX_H * 0.06);
  const TEXT_BTM = Math.round(PX_H * 0.91);
  const FONT_PX  = Math.round(LINE_H * 0.68);
  const TEXT_W   = PX_W - PAD_X * 2;

  // ── 3. Linhas do caderno ─────────────────────────────────────────────────────
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth   = 1.5;
  setLineDash(ctx, theme.lineStyle);
  for (let y = TEXT_TOP; y <= TEXT_BTM; y += LINE_H) {
    ctx.beginPath();
    ctx.moveTo(PAD_X - 8, y);
    ctx.lineTo(PX_W - PAD_X + 8, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── 4. Cabeçalho (apenas primeira página) ────────────────────────────────────
  if (isFirstPage) {
    const EMOJI_FONT = `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    let hy = Math.round(PX_H * 0.07);

    // Humor (emoji grande)
    if (mood) {
      ctx.font      = `${Math.round(FONT_PX * 2.2)}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.textPrimary;
      ctx.fillText(mood, PX_W / 2, hy + Math.round(FONT_PX * 2));
      hy += Math.round(FONT_PX * 2.8);
    }

    // Título
    if (title) {
      ctx.font      = `bold ${Math.round(FONT_PX * 1.35)}px Patrick Hand,cursive,${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.textPrimary;
      ctx.fillText(title, PX_W / 2, hy, TEXT_W);
      hy += Math.round(FONT_PX * 1.6);
    }

    // Separador
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PX_W / 2 - 100, hy - 8);
    ctx.lineTo(PX_W / 2 + 100, hy - 8);
    ctx.stroke();

    // Data + hora
    const meta = [formatDate(createdAt), formatTime(createdAt)].filter(Boolean).join('  ·  ');
    ctx.font      = `${Math.round(FONT_PX * 0.78)}px Patrick Hand,cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(meta, PX_W / 2, hy + 4, TEXT_W);
  }

  // ── 5. Texto do corpo (com emojis e quebra de linha) ─────────────────────────
  const EMOJI_FONT = `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.font      = `${FONT_PX}px Patrick Hand,cursive,${EMOJI_FONT}`;
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = 'left';

  const rawLines = (content || '').split('\n');
  let y = TEXT_TOP + Math.round(LINE_H * 0.72);

  for (const rawLine of rawLines) {
    if (y > TEXT_BTM) break;
    const wrapped = wrapLine(ctx, rawLine, TEXT_W);
    for (const wline of wrapped) {
      if (y > TEXT_BTM) break;
      ctx.fillText(wline, PAD_X, y);
      y += LINE_H;
    }
  }

  // ── 6. Número de página ───────────────────────────────────────────────────────
  if (totalPages > 1) {
    ctx.font         = `${Math.round(FONT_PX * 0.62)}px Patrick Hand,cursive`;
    ctx.fillStyle    = theme.textSecondary;
    ctx.textAlign    = 'right';
    ctx.globalAlpha  = 0.55;
    ctx.fillText(`${pageNum} / ${totalPages}`, PX_W - PAD_X, PX_H - 28);
    ctx.globalAlpha  = 1;
  }

  return canvas;
}

// ── Export principal ───────────────────────────────────────────────────────────

export async function exportEntryToPDF(entry) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const theme = getTheme();
  const pages = splitPages(entry.content);

  // Carrega stationery uma vez (já tem o fade aplicado pela nossa função applyWhiteFade)
  const stationeryImg = entry.stationery_url
    ? await loadImage(entry.stationery_url)
    : null;

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage();

    const canvas = await renderPage({
      stationeryImg,
      isFirstPage:  i === 0,
      title:        entry.title      || '',
      mood:         entry.mood       || '',
      createdAt:    entry.created_at || '',
      content:      pages[i],
      theme,
      pageNum:      i + 1,
      totalPages:   pages.length,
    });

    doc.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, A4_W, A4_H);
  }

  const dateStr   = entry.created_at ? entry.created_at.split('T')[0] : 'diario';
  const titleSlug = entry.title
    ? '_' + entry.title.slice(0, 20).replace(/[^a-zA-Z0-9À-ú]/g, '_')
    : '';
  doc.save(`diario${titleSlug}_${dateStr}.pdf`);
}
