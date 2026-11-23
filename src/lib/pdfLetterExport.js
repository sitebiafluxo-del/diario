import jsPDF from 'jspdf';
import { isCapacitor } from './capacitor';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isSafeImageUrl } from './safeUrl';
import { getWritingLayout } from './writingLines';

// Dimensões A4 Paisagem para impressão em alta definição (300 DPI aprox.)
// Folha A4 Paisagem: 297mm × 210mm
// Cada metade exata A5: 148.5mm × 210mm (proporção 1123 × 1588 = 1 : 1.4141)
const HALF_W = 1123;
const LAND_H = 1588;
const LAND_W = HALF_W * 2; // 2246px

function loadImage(url) {
  if (!isSafeImageUrl(url)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    // Se for data URL, não precisa de crossOrigin
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const lines = text.split('\n');
  const result = [];

  for (const rawLine of lines) {
    if (!rawLine) {
      result.push('');
      continue;
    }
    const words = rawLine.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}

/**
 * Renderiza uma página individual A5 em um canvas preservando
 * a proporção original da imagem (SEM DISTORÇÃO).
 */
async function renderA5LetterCanvas({ paperImg, text, title, position }) {
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = HALF_W;
  canvas.height = LAND_H;
  const ctx = canvas.getContext('2d');

  // 1. Fundo do papel mantendo a proporção original (cover proporcional centrado)
  if (paperImg) {
    const imgW = paperImg.naturalWidth || paperImg.width || HALF_W;
    const imgH = paperImg.naturalHeight || paperImg.height || LAND_H;
    const imgRatio = imgW / imgH;
    const canvasRatio = HALF_W / LAND_H;

    let dw, dh, dx, dy;
    if (imgRatio > canvasRatio) {
      // Imagem é mais larga que o A5: ajusta pela altura e centraliza na horizontal
      dh = LAND_H;
      dw = LAND_H * imgRatio;
      dx = (HALF_W - dw) / 2;
      dy = 0;
    } else {
      // Imagem é mais alta que o A5: ajusta pela largura e centraliza na vertical
      dw = HALF_W;
      dh = HALF_W / imgRatio;
      dx = 0;
      dy = (LAND_H - dh) / 2;
    }

    ctx.drawImage(paperImg, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, HALF_W, LAND_H);
  }

  // 2. Margens e dimensões de escrita
  // Mesmo layout das linhas desenhadas no papel (writingLines.js)
  const WRITING_LAYOUT = getWritingLayout(position);
  const padLeft = Math.round(HALF_W * WRITING_LAYOUT.marginX);
  const padRight = Math.round(HALF_W * WRITING_LAYOUT.marginX);
  const textWidth = HALF_W - padLeft - padRight;
  const startY = Math.round(LAND_H * WRITING_LAYOUT.startY);
  const endY = Math.round(LAND_H * WRITING_LAYOUT.endY);
  const lineSpacing = LAND_H * WRITING_LAYOUT.lineGap;

  // 3. Título opcional
  let currentY = startY;
  if (title && title.trim()) {
    ctx.font = 'bold 36px "Patrick Hand", cursive, sans-serif';
    ctx.fillStyle = '#4a3728';
    ctx.textAlign = 'center';
    ctx.fillText(title, HALF_W / 2, currentY - 20);
  }

  // 4. Texto da carta
  if (text && text.trim()) {
    ctx.font = '28px "Patrick Hand", cursive, sans-serif';
    ctx.fillStyle = '#3a2a1d';
    ctx.textAlign = 'left';

    const wrappedLines = wrapText(ctx, text, textWidth);
    for (const line of wrappedLines) {
      if (currentY > endY) break;
      ctx.fillText(line, padLeft, currentY);
      currentY += lineSpacing;
    }
  }

  return canvas;
}

/**
 * Desenha uma tesourinha discreta na linha de corte
 */
function drawScissorsIcon(ctx, x, y, size = 18) {
  ctx.save();
  ctx.translate(x, y);
  ctx.font = `${size}px "Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✂', 0, 0);
  ctx.restore();
}

/**
 * Exporta para PDF folha A4 com 2 cartas A5 lado a lado
 * - Sem nenhuma distorção de imagem (proporção 100% preservada)
 * - Margem de respiro de impressora uniforme (escala 94%)
 * - Linha de corte central pontilhada (picote) com tesourinha (20% opacidade)
 */
export async function exportLetterToA4PDF({ paper, customText }) {
  const paperImg = paper?.imageUrl ? await loadImage(paper.imageUrl) : null;
  const title = paper?.title || '';
  const textToPrint = (customText !== undefined ? customText : paper?.content) || '';

  // Cria canvas A4 Paisagem
  const landCanvas = document.createElement('canvas');
  landCanvas.width = LAND_W;
  landCanvas.height = LAND_H;
  const ctx = landCanvas.getContext('2d');

  // Fundo branco da folha A4
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LAND_W, LAND_H);

  // Renderiza a carta A5 individual com proporção 100% perfeita
  const letterCanvas = await renderA5LetterCanvas({ paperImg, text: textToPrint, title, position: paper?.options?.position });

  // ── Margens de segurança da impressora com ESCALA UNIFORME ────────────────
  // Aplicamos exatamente a mesma escala na largura e na altura (0.94 = ~6.5mm de margem)
  // garantindo ZERO distorção geométrica!
  const SCALE = 0.94;
  const targetW = Math.round(HALF_W * SCALE);
  const targetH = Math.round(LAND_H * SCALE);

  // Centraliza perfeitamente cada carta A5 dentro de sua metade da folha
  const leftX = Math.round((HALF_W - targetW) / 2);
  const rightX = HALF_W + leftX;
  const posY = Math.round((LAND_H - targetH) / 2);

  // Desenha Carta 1 (esquerda) e Carta 2 (direita)
  ctx.drawImage(letterCanvas, leftX, posY, targetW, targetH);
  ctx.drawImage(letterCanvas, rightX, posY, targetW, targetH);

  // ── Linha de corte com picote discreto (20% de opacidade) ──────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.20)';
  ctx.fillStyle = 'rgba(60, 60, 60, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 8]); // Picote pontilhado

  // Linha de corte central de ponta a ponta
  ctx.beginPath();
  ctx.moveTo(HALF_W, 0);
  ctx.lineTo(HALF_W, LAND_H);
  ctx.stroke();

  // ── Símbolos discretos de tesoura indicando a linha de corte ──────────────
  ctx.setLineDash([]); // Reseta linha para desenhar a tesoura

  // Tesoura no topo
  drawScissorsIcon(ctx, HALF_W, 26, 20);

  // Tesoura no meio da folha
  drawScissorsIcon(ctx, HALF_W, Math.round(LAND_H / 2), 20);

  // Tesoura na base
  drawScissorsIcon(ctx, HALF_W, LAND_H - 26, 20);

  ctx.restore();

  // Gera o PDF final
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let dataUrl;
  try {
    dataUrl = landCanvas.toDataURL('image/jpeg', 0.95);
  } catch (err) {
    // Canvas "contaminado": a imagem veio de outro domínio sem cabeçalho CORS
    throw new Error('A imagem deste papel está em um servidor que bloqueia a exportação (CORS). Baixe a imagem e use "Usar Minha Imagem".', { cause: err });
  }
  doc.addImage(dataUrl, 'JPEG', 0, 0, 297, 210);

  const cleanTitle = title.slice(0, 15).replace(/[^a-zA-Z0-9À-ú]/g, '_') || 'papel_carta';
  const filename = `${cleanTitle}_2x_A5.pdf`;

  if (isCapacitor) {
    const base64 = doc.output('datauristring').split(',')[1];
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true
    });
    await Share.share({
      title: 'Papel de Carta para Impressão',
      url: saved.uri,
      dialogTitle: 'Imprimir ou Salvar PDF'
    });
  } else {
    doc.save(filename);
  }
}
