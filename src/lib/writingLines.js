/**
 * Layout da área de escrita, em proporções da altura/largura da folha A5.
 * Usado para DESENHAR as linhas no papel e para POSICIONAR o texto no PDF,
 * garantindo que a escrita caia exatamente sobre as linhas.
 *
 * (A IA não é boa em desenhar pautas retas — por isso o app desenha.)
 */
export const WRITING_LAYOUT = {
  marginX: 0.12,          // margem esquerda/direita (fração da largura)
  startY: 0.22,           // primeira linha de texto (fração da altura)
  endY: 0.88,             // última linha possível
  lineGap: 42 / 1588,     // distância entre linhas (fração da altura)
  baselineDrop: 8 / 1588, // a linha fica um pouco abaixo da base das letras
};

/**
 * Área de escrita conforme ONDE estão os desenhos, para linhas e texto
 * nunca passarem por cima das ilustrações.
 */
export function getWritingLayout(position) {
  const L = { ...WRITING_LAYOUT };
  if (position === 'all') { L.marginX = 0.2; L.startY = 0.2; L.endY = 0.8; }
  else if (position === 'sides') { L.marginX = 0.22; }
  else if (position === 'top') { L.startY = 0.3; }
  else if (position === 'bottom') { L.startY = 0.14; L.endY = 0.72; }
  else if (position === 'frame') { L.startY = 0.32; L.endY = 0.72; }
  return L;
}

/**
 * Desenha as linhas de escrita num canvas já com a imagem do papel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w largura do canvas
 * @param {number} h altura do canvas
 * @param {'dotted'|'solid'|'none'} style
 * @param {string} [position] onde estão os desenhos ('frame','top','bottom','sides','all')
 */
export function drawWritingLines(ctx, w, h, style, position) {
  if (style !== 'dotted' && style !== 'solid') return;
  const { marginX, startY, endY, lineGap, baselineDrop } = getWritingLayout(position);
  const x0 = Math.round(w * marginX);
  const x1 = Math.round(w * (1 - marginX));
  const gap = h * lineGap;
  const scale = h / 1588; // espessuras proporcionais ao tamanho da imagem

  ctx.save();
  ctx.strokeStyle = 'rgba(120, 110, 100, 0.38)';
  ctx.lineWidth = Math.max(1, 1.6 * scale);
  ctx.lineCap = 'round';
  if (style === 'dotted') {
    ctx.setLineDash([Math.max(1, 1.5 * scale), Math.max(3, 7 * scale)]);
  } else {
    ctx.setLineDash([]);
  }
  for (let y = h * startY + h * baselineDrop; y <= h * endY; y += gap) {
    const yy = Math.round(y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy);
    ctx.stroke();
  }
  ctx.restore();
}
