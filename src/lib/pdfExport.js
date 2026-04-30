import jsPDF from 'jspdf';
import { isCapacitor } from './capacitor';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
// O canvas é sempre 2× o tamanho CSS do A4 (794px → 1588px).
// Escala fixa = PX_W / 794 = 2, independente da largura da tela.

const CSS_A4_W = 794; // largura A4 em CSS pixels (96dpi)
const SCALE    = PX_W / CSS_A4_W; // sempre 2

function getLayout(isStationery = false) {
  if (isStationery) {
    // CSS .entry-textarea.stationery: padding 153px 60px 180px 90px
    return {
      fontPx:   Math.round(16   * SCALE),
      lineH:    Math.round(32   * SCALE),
      padLeft:  Math.round(90   * SCALE * 2),
      padRight: Math.round(60   * SCALE * 2),
    };
  }

  const ta = document.querySelector('.entry-textarea');
  if (ta) {
    const cs = getComputedStyle(ta);
    const fs       = parseFloat(cs.fontSize)     || 17.6;
    const lh       = parseFloat(cs.lineHeight)   || 28;
    const padLeft  = parseFloat(cs.paddingLeft)  || 16;
    const padRight = parseFloat(cs.paddingRight) || padLeft;
    return {
      fontPx:   Math.round(fs       * SCALE),
      lineH:    Math.round(lh       * SCALE),
      padLeft:  Math.round(padLeft  * SCALE),
      padRight: Math.round(padRight * SCALE),
    };
  }

  return {
    fontPx:   Math.round(16   * SCALE),
    lineH:    Math.round(28   * SCALE),
    padLeft:  Math.round(16   * SCALE),
    padRight: Math.round(16   * SCALE),
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
  // Cache-bust forces a fresh CORS request, avoiding tainted-canvas from a
  // prior non-CORS cache entry (e.g. CSS backgroundImage loaded the same URL).
  const sep = fullUrl.includes('?') ? '&' : '?';
  const corsUrl = fullUrl + sep + '_cb=' + Date.now();
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = corsUrl;
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

  const { fontPx, lineH, padLeft, padRight } = layout;
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
  // Stationery tem borda floral grande no topo (~35%), então empurra mais pra baixo
  const hasStationery = !!stationeryImg;
  const TEXT_TOP = isFirstPage
    ? Math.round(PX_H * (hasStationery ? 0.24 : 0.27))
    : Math.round(PX_H * 0.06);
  const TEXT_BTM = Math.round(PX_H * 0.91);
  const TEXT_W   = PX_W - padLeft - padRight;

  // 3. Linhas do caderno
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth   = 1.5;
  setLineDash(ctx, theme.lineStyle);
  for (let y = TEXT_TOP; y <= TEXT_BTM; y += lineH) {
    ctx.beginPath();
    ctx.moveTo(padLeft - 8, y);
    ctx.lineTo(PX_W - padRight + 8, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 4. Cabeçalho (apenas primeira página)
  if (isFirstPage) {
    // Com stationery: posiciona no espaço branco abaixo das flores (~30%)
    // Sem stationery: posiciona no topo (~7%)
    let hy = Math.round(PX_H * (hasStationery ? 0.16 : 0.07));

    if (mood) {
      ctx.font      = `${Math.round(fontPx * 2.2)}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.textPrimary;
      ctx.fillText(mood, PX_W / 2, hy + Math.round(fontPx * 2));
      hy += Math.round(fontPx * 2.8);
    }

    if (title) {
      const titleFontPx = Math.round(fontPx * 1.35);
      ctx.font      = `bold ${titleFontPx}px Patrick Hand,cursive,${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.textPrimary;
      const titleLines = wrapLine(ctx, title, TEXT_W);
      for (const tl of titleLines) {
        ctx.fillText(tl, PX_W / 2, hy);
        hy += Math.round(titleFontPx * 1.3);
      }
      hy += Math.round(fontPx * 0.3);
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
      ctx.fillText(wline, padLeft, y);
      y += lineH;
    }
  }

  // 6. Número de página
  if (totalPages > 1) {
    ctx.font        = `${Math.round(fontPx * 0.62)}px Patrick Hand,cursive`;
    ctx.fillStyle   = theme.textSecondary;
    ctx.textAlign   = 'right';
    ctx.globalAlpha = 0.55;
    ctx.fillText(`${pageNum} / ${totalPages}`, PX_W - padRight, PX_H - 28);
    ctx.globalAlpha = 1;
  }

  return canvas;
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function exportEntryToPDF(entry) {
  const theme  = getTheme();
  const layout = getLayout(!!entry.stationery_url);

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

    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/jpeg', 0.93);
    } catch {
      // Canvas tainted (stationery CORS issue) — re-render without background
      const fallback = await renderPage({
        stationeryImg: null,
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
      dataUrl = fallback.toDataURL('image/jpeg', 0.93);
    }
    doc.addImage(dataUrl, 'JPEG', 0, 0, A4_W, A4_H);
  }

  const dateStr   = entry.created_at ? entry.created_at.split('T')[0] : 'diario';
  const titleSlug = entry.title
    ? '_' + entry.title.slice(0, 20).replace(/[^a-zA-Z0-9À-ú]/g, '_')
    : '';
  const filename = `diario${titleSlug}_${dateStr}.pdf`;

  if (isCapacitor) {
    const base64 = doc.output('datauristring').split(',')[1];
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: filename,
      url: saved.uri,
      dialogTitle: 'Salvar ou compartilhar PDF',
    });
  } else {
    doc.save(filename);
  }
}
