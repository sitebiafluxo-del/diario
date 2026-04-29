import jsPDF from 'jspdf';

// Tamanho canvas A4 (2× DPI para qualidade de impressão)
const PX_W = 794 * 2;
const PX_H = 1123 * 2;
const A4_W = 210;
const A4_H = 297;

// ── Tema atual via CSS variables ──────────────────────────────────────────────

function getTheme() {
  const s = getComputedStyle(document.documentElement);
  return {
    textPrimary:   s.getPropertyValue('--text-primary').trim()   || '#4a3728',
    textSecondary: s.getPropertyValue('--text-secondary').trim() || '#7a6555',
    primary:       s.getPropertyValue('--primary').trim()        || '#c9a87c',
    lineColor:     s.getPropertyValue('--line-color').trim()     || 'rgba(173,216,230,0.35)',
    lineStyle:     s.getPropertyValue('--line-style').trim()     || 'solid',
  };
}

// ── Layout baseado no CSS real do textarea ────────────────────────────────────
// Lê font-size, line-height e padding do elemento .entry-textarea na tela e
// escala para o canvas 2×, garantindo que o PDF bata com o que o usuário vê.

function getLayout() {
  const ta = document.querySelector('.entry-textarea.stationery') ||
             document.querySelector('.entry-textarea');

  if (ta) {
    const cs  = getComputedStyle(ta);
    const rect = ta.getBoundingClientRect();
    if (rect.width > 0) {
      const scaleX = PX_W / rect.width;
      const fs     = parseFloat(cs.fontSize)    || 16;
      const lh     = parseFloat(cs.lineHeight)  || fs * 1.5;
      const padX   = parseFloat(cs.paddingLeft) || 12;

      return {
        fontPx:  Math.round(fs  * scaleX),
        lineH:   Math.round(lh  * scaleX),
        padX:    Math.round(padX * scaleX),
      };
    }
  }

  // Fallback quando o textarea não está visível (ex.: exportação programática)
  const lineH = Math.round(PX_H / 22);
  return {
    fontPx: Math.round(lineH * 0.72),
    lineH,
    padX:   Math.round(PX_W * 0.06),
  };
}

// ── Datas formatadas ──────────────────────────────────────────────────────────

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

// ── Divide o conteúdo em páginas de N linhas (mesma lógica do EntryForm) ─────

function splitPages(content, linesPerPage) {
  if (!content?.trim()) return [''];
  const lines = content.split('\n');
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join('\n'));
  }
  return pages.length > 0 ? pages : [''];
}

// ── Carrega imagem com CORS ───────────────────────────────────────────────────

function loadImage(url) {
  const fullUrl = url.startsWith('/') ? window.location.origin + url : url;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = fullUrl;
  });
}

// ── Estilo das linhas (traço/pontilhado/sólido) ───────────────────────────────

function setLineDash(ctx, style) {
  if (style === 'dashed')       ctx.setLineDash([12, 6]);
  else if (style === 'dotted')  ctx.setLineDash([3, 6]);
  else                          ctx.setLineDash([]);
}

// ── Quebra linha longa para caber na largura ──────────────────────────────────

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

// ── Renderiza uma página como canvas ─────────────────────────────────────────

async function renderPage({
  stationeryImg, isFirstPage, title, mood, createdAt, content, theme, layout,
  pageNum, totalPages,
}) {
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width  = PX_W;
  canvas.height = PX_H;
  const ctx = canvas.getContext('2d');

  const { fontPx, lineH, padX } = layout;
  const EMOJI_FONT = `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;

  // 1. Fundo
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

  // 2. Zona de texto
  const TEXT_TOP = isFirstPage ? Math.round(PX_H * 0.27) : Math.round(PX_H * 0.06);
  const TEXT_BTM = Math.round(PX_H * 0.91);
  const TEXT_W   = PX_W - padX * 2;

  // 3. Linhas do caderno
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth   = 1.5;
  setLineDash(ctx, theme.lineStyle);
  for (let y = TEXT_TOP; y <= TEXT_BTM; y += lineH) {
    ctx.beginPath();
    ctx.moveTo(padX - 8, y);
    ctx.lineTo(PX_W - padX + 8, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 4. Cabeçalho (apenas primeira página)
  if (isFirstPage) {
    let hy = Math.round(PX_H * 0.07);

    if (mood) {
      ctx.font      = `${Math.round(fontPx * 2.2)}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.textPrimary;
      ctx.fillText(mood, PX_W / 2, hy + Math.round(fontPx * 2));
      hy += Math.round(fontPx * 2.8);
    }

    if (title) {
      ctx.font      = `bold ${Math.round(fontPx * 1.35)}px Patrick Hand,cursive,${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.textPrimary;
      ctx.fillText(title, PX_W / 2, hy, TEXT_W);
      hy += Math.round(fontPx * 1.6);
    }

    ctx.strokeStyle = theme.primary;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PX_W / 2 - 100, hy - 8);
    ctx.lineTo(PX_W / 2 + 100, hy - 8);
    ctx.stroke();

    const meta = [formatDate(createdAt), formatTime(createdAt)].filter(Boolean).join('  ·  ');
    ctx.font      = `${Math.round(fontPx * 0.78)}px Patrick Hand,cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(meta, PX_W / 2, hy + 4, TEXT_W);
  }

  // 5. Corpo do texto
  ctx.font      = `${fontPx}px Patrick Hand,cursive,${EMOJI_FONT}`;
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = 'left';

  const rawLines = (content || '').split('\n');
  let y = TEXT_TOP + Math.round(lineH * 0.72);

  for (const rawLine of rawLines) {
    if (y > TEXT_BTM) break;
    const wrapped = wrapLine(ctx, rawLine, TEXT_W);
    for (const wline of wrapped) {
      if (y > TEXT_BTM) break;
      ctx.fillText(wline, padX, y);
      y += lineH;
    }
  }

  // 6. Número de página
  if (totalPages > 1) {
    ctx.font        = `${Math.round(fontPx * 0.62)}px Patrick Hand,cursive`;
    ctx.fillStyle   = theme.textSecondary;
    ctx.textAlign   = 'right';
    ctx.globalAlpha = 0.55;
    ctx.fillText(`${pageNum} / ${totalPages}`, PX_W - padX, PX_H - 28);
    ctx.globalAlpha = 1;
  }

  return canvas;
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function exportEntryToPDF(entry) {
  const theme  = getTheme();
  const layout = getLayout();

  // Calcula linhas por página a partir do layout real:
  // área útil (sem cabeçalho) ÷ altura de linha
  const usableH    = Math.round(PX_H * 0.91) - Math.round(PX_H * 0.06);
  const linesPerPage = Math.max(6, Math.floor(usableH / layout.lineH));

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pages = splitPages(entry.content, linesPerPage);

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
      layout,
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
