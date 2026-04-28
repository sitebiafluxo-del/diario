import html2canvas from 'html2canvas';

/**
 * Exporta o registro para uma imagem otimizada para Instagram.
 * Usa camadas separadas para evitar repetição indesejada do fundo.
 */
export async function exportToInstagram(entry, stationeryUrl, fileName = 'bia-diario-post') {
  const container = document.createElement('div');
  container.className = 'insta-export-container';
  
  const SCALE = 2.77;
  const LINE_HEIGHT = 32 * SCALE;
  const MARGIN_TOP = 153 * SCALE;
  const MARGIN_LEFT = 90 * SCALE;
  const MARGIN_RIGHT = 60 * SCALE;
  const LINE_OFFSET = 24 * SCALE;
  
  Object.assign(container.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1080px',
    height: '1350px',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box'
  });

  // Camada 1: Papel de Carta (Fundo Real)
  const bgLayer = document.createElement('div');
  Object.assign(bgLayer.style, {
    position: 'absolute',
    inset: '0',
    backgroundImage: stationeryUrl ? `url(${stationeryUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    zIndex: '1'
  });
  container.appendChild(bgLayer);

  // Camada 2: Linhas do Caderno
  const linesLayer = document.createElement('div');
  Object.assign(linesLayer.style, {
    position: 'absolute',
    inset: '0',
    backgroundImage: `repeating-linear-gradient(
      transparent, 
      transparent ${LINE_HEIGHT - 1}px, 
      rgba(180, 210, 220, 0.4) ${LINE_HEIGHT - 1}px, 
      rgba(180, 210, 220, 0.4) ${LINE_HEIGHT}px
    )`,
    backgroundSize: `100% ${LINE_HEIGHT}px`,
    backgroundPosition: `0 ${LINE_OFFSET + MARGIN_TOP}px`,
    zIndex: '2',
    pointerEvents: 'none'
  });
  container.appendChild(linesLayer);

  // Camada 3: Título (na margem superior)
  const titleLayer = document.createElement('div');
  Object.assign(titleLayer.style, {
    position: 'absolute',
    top: '80px',
    width: '100%',
    textAlign: 'center',
    zIndex: '3'
  });
  
  const title = document.createElement('div');
  title.innerText = entry.title || '';
  Object.assign(title.style, {
    fontSize: '48px',
    fontWeight: '700',
    color: '#462d37',
    fontFamily: '"Outfit", sans-serif'
  });
  titleLayer.appendChild(title);
  container.appendChild(titleLayer);

  // Camada 4: Conteúdo do Texto
  const contentLayer = document.createElement('div');
  contentLayer.innerText = entry.content;
  Object.assign(contentLayer.style, {
    position: 'relative',
    zIndex: '4',
    fontSize: `${0.95 * 28}px`,
    lineHeight: `${LINE_HEIGHT}px`,
    color: '#281e14',
    whiteSpace: 'pre-wrap',
    padding: `${MARGIN_TOP}px ${MARGIN_RIGHT}px 80px ${MARGIN_LEFT}px`,
    fontFamily: '"Outfit", "Inter", sans-serif'
  });
  container.appendChild(contentLayer);

  document.body.appendChild(container);

  try {
    const options = {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    };

    // Delay maior para garantir que o background-size: cover processe
    await new Promise(resolve => setTimeout(resolve, 1000));

    const canvas = await html2canvas(container, options);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = `${fileName}.jpg`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Erro na exportação:', error);
  } finally {
    document.body.removeChild(container);
  }
}
