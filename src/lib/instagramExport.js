import html2canvas from 'html2canvas';

/**
 * Exporta o registro para uma imagem otimizada para Instagram.
 * Respeita rigorosamente as margens e espaçamentos definidos no CSS.
 */
export async function exportToInstagram(entry, stationeryUrl, fileName = 'bia-diario-post') {
  const container = document.createElement('div');
  container.className = 'insta-export-container';
  
  // Proporção de escala (1080px largura vs ~390px tela mobile)
  const SCALE = 2.77;
  
  // Medidas oficiais do CSS escaladas para 1080px
  const LINE_HEIGHT = 32 * SCALE;
  const MARGIN_TOP = 153 * SCALE;
  const MARGIN_LEFT = 90 * SCALE;
  const MARGIN_RIGHT = 60 * SCALE;
  const LINE_OFFSET = 24 * SCALE; // offset do CSS para o texto sentar na linha
  
  Object.assign(container.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1080px',
    height: '1350px', // Formato 4:5
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    fontFamily: '"Outfit", "Inter", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    // Fundo: Linhas e Papel de Carta respeitando o CSS
    backgroundImage: `
      repeating-linear-gradient(
        transparent, 
        transparent ${LINE_HEIGHT - 1}px, 
        rgba(180, 210, 220, 0.4) ${LINE_HEIGHT - 1}px, 
        rgba(180, 210, 220, 0.4) ${LINE_HEIGHT}px
      ),
      ${stationeryUrl ? `url(${stationeryUrl})` : 'none'}
    `,
    backgroundSize: `100% ${LINE_HEIGHT}px, cover`,
    backgroundPosition: `0 ${LINE_OFFSET}px, center top`,
    backgroundRepeat: 'repeat-y, no-repeat',
    backgroundAttachment: 'local, local'
  });

  // Área do Conteúdo (Texto) - Respeitando os paddings do CSS
  const content = document.createElement('div');
  content.innerText = entry.content;
  Object.assign(content.style, {
    fontSize: `${0.95 * 28}px`, // 0.95rem convertido para pixels proporcionais
    lineHeight: `${LINE_HEIGHT}px`,
    color: '#281e14',
    whiteSpace: 'pre-wrap',
    padding: `${MARGIN_TOP}px ${MARGIN_RIGHT}px 80px ${MARGIN_LEFT}px`,
    flex: '1',
    marginTop: '0'
  });

  // Título e Meta (Opcional no topo do papel, como no CSS as margens são grandes, o texto começa abaixo)
  // Se quiser que o título apareça nas margens, podemos adicionar aqui:
  const headerOverlay = document.createElement('div');
  Object.assign(headerOverlay.style, {
    position: 'absolute',
    top: '100px',
    left: '0',
    width: '100%',
    textAlign: 'center',
    pointerEvents: 'none'
  });
  
  const title = document.createElement('div');
  title.innerText = entry.title || '';
  Object.assign(title.style, {
    fontSize: '48px',
    fontWeight: '700',
    color: '#462d37',
    marginBottom: '8px',
    fontFamily: '"Outfit", sans-serif'
  });
  
  headerOverlay.appendChild(title);
  container.appendChild(headerOverlay);
  container.appendChild(content);

  document.body.appendChild(container);

  try {
    const options = {
      scale: 1, // Já estamos trabalhando em 1080px
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    };

    await new Promise(resolve => setTimeout(resolve, 800));

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
