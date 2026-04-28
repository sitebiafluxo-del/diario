import jsPDF from 'jspdf';

const PAGE_W = 210;
const PAGE_H = 297;

// Área de escrita (linhas do caderno) — abaixo do cabeçalho floral
const MARGIN_LEFT   = 40;
const MARGIN_RIGHT  = 16;
const MARGIN_TOP    = 83;  // onde começam as linhas do caderno (abaixo das flores)
const MARGIN_BOTTOM = 47;

const TEXT_W      = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
const BODY_SIZE   = 12;
const LINE_H      = 7.2;  // mm — equivale a 32px CSS
const PAGE_BOTTOM = PAGE_H - MARGIN_BOTTOM;

// Área do cabeçalho (zona floral no topo)
// As flores ficam nos primeiros ~28% — posicionamos o texto na faixa limpa inferior do cabeçalho
const HEADER_TITLE_Y = 58;  // título centralizado aqui
const HEADER_META_Y  = 68;  // data/humor logo abaixo
const CENTER_X       = PAGE_W / 2;

// ── Emoji helpers ──────────────────────────────────────────────────────────────

function stripEmoji(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const MOOD_LABELS = {
  '😊': 'Feliz',      '😢': 'Triste',     '😡': 'Irritada',
  '😰': 'Ansiosa',   '🥰': 'Apaixonada',  '😴': 'Cansada',
  '🤔': 'Pensativa', '🎉': 'Animada',     '😌': 'Tranquila',
  '💪': 'Motivada',
};

function moodLabel(mood) {
  if (!mood) return '';
  return MOOD_LABELS[mood] || stripEmoji(mood);
}

// ── Image loader ───────────────────────────────────────────────────────────────

function loadImageInfo(url) {
  const fullUrl = url.startsWith('/') ? window.location.origin + url : url;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve({ dataURL: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = fullUrl;
  });
}

// ── Background com proporção correta (cover) ───────────────────────────────────

function drawBackground(doc, imgInfo) {
  const { dataURL, w, h } = imgInfo;
  const imgRatio  = w / h;
  const pageRatio = PAGE_W / PAGE_H;

  let drawW, drawH, drawX, drawY;
  if (imgRatio < pageRatio) {
    drawW = PAGE_W;
    drawH = PAGE_W / imgRatio;
    drawX = 0;
    drawY = (PAGE_H - drawH) / 2;
  } else {
    drawH = PAGE_H;
    drawW = PAGE_H * imgRatio;
    drawX = (PAGE_W - drawW) / 2;
    drawY = 0;
  }

  doc.addImage(dataURL, 'PNG', drawX, drawY, drawW, drawH);

  // Aplica uma película branca para replicar o fade e garantir a leitura no PDF
  doc.setGState(new doc.GState({ opacity: 0.85 }));
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  doc.setGState(new doc.GState({ opacity: 1.0 })); // Restaura a opacidade normal
}

// ── Linhas horizontais do caderno ──────────────────────────────────────────────

function drawRuledLines(doc) {
  doc.setDrawColor(180, 160, 200);
  doc.setLineWidth(0.2);
  let y = MARGIN_TOP;
  while (y <= PAGE_BOTTOM) {
    doc.line(MARGIN_LEFT - 2, y, PAGE_W - MARGIN_RIGHT + 2, y);
    y += LINE_H;
  }
}

// ── Cabeçalho na área floral (título + data centralizado) ─────────────────────

function drawHeader(doc, entry) {
  const title = entry.title ? stripEmoji(entry.title) : '';
  const mood  = moodLabel(entry.mood);
  const date  = formatDatePT(entry.created_at);
  const time  = formatTimePT(entry.created_at);

  // Linha decorativa sutil acima do título
  doc.setDrawColor(180, 140, 160);
  doc.setLineWidth(0.3);
  const lineHalf = 35;
  doc.line(CENTER_X - lineHalf, HEADER_TITLE_Y - 5, CENTER_X + lineHalf, HEADER_TITLE_Y - 5);

  // Título
  if (title) {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(15);
    doc.setTextColor(70, 45, 55);
    doc.text(title, CENTER_X, HEADER_TITLE_Y, { align: 'center' });
  }

  // Linha separadora fina após título
  doc.setLineWidth(0.2);
  doc.line(CENTER_X - lineHalf, HEADER_TITLE_Y + 2, CENTER_X + lineHalf, HEADER_TITLE_Y + 2);

  // Humor + data + hora
  const metaLine = [mood, date, time].filter(Boolean).join('  ·  ');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(110, 85, 95);
  doc.text(metaLine, CENTER_X, HEADER_META_Y, { align: 'center' });
}

// ── Datas ──────────────────────────────────────────────────────────────────────

function formatDatePT(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTimePT(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  });
}

// ── Export principal ───────────────────────────────────────────────────────────

export async function exportEntryToPDF(entry) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let imgInfo = null;
  if (entry.stationery_url) {
    imgInfo = await loadImageInfo(entry.stationery_url);
  }

  // Word-wrap do conteúdo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE);
  const rawContent = entry.content ? stripEmoji(entry.content.trim()) : '';
  const bodyLines  = rawContent ? doc.splitTextToSize(rawContent, TEXT_W) : [];

  // Paginação
  let lineIdx   = 0;
  let firstPage = true;

  // Quantas linhas cabem por página
  const linesPerPage = Math.floor((PAGE_BOTTOM - (MARGIN_TOP + LINE_H)) / LINE_H);

  while (lineIdx < bodyLines.length || firstPage) {
    if (!firstPage) doc.addPage();

    // 1. Fundo
    if (imgInfo) drawBackground(doc, imgInfo);

    // 2. Linhas do caderno
    drawRuledLines(doc);

    // 3. Cabeçalho apenas na primeira página (na área floral)
    if (firstPage) drawHeader(doc, entry);

    // 4. Texto do corpo
    let y = MARGIN_TOP + LINE_H - 1.5; // baseline na segunda linha do caderno
    const pageEnd = lineIdx + linesPerPage;

    while (lineIdx < bodyLines.length && lineIdx < pageEnd) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(BODY_SIZE);
      doc.setTextColor(40, 30, 20);
      doc.text(bodyLines[lineIdx], MARGIN_LEFT, y);
      y += LINE_H;
      lineIdx++;
    }

    firstPage = false;
    if (lineIdx >= bodyLines.length) break;
  }

  const dateStr   = entry.created_at ? entry.created_at.split('T')[0] : 'diario';
  const titleSlug = entry.title
    ? '_' + stripEmoji(entry.title).slice(0, 20).replace(/[^a-zA-Z0-9À-ú]/g, '_')
    : '';
  doc.save(`diario${titleSlug}_${dateStr}.pdf`);
}
