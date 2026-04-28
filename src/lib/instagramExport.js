import html2canvas from 'html2canvas';

/**
 * Exporta o registro para uma imagem otimizada para Instagram.
 * Simula o visual do caderno com linhas pautadas e margens precisas.
 */
export async function exportToInstagram(entry, stationeryUrl, fileName = 'bia-diario-post') {
  const container = document.createElement('div');
  container.className = 'insta-export-container';
  
  // Configurações de estilo para bater com o visual do caderno
  const LINE_HEIGHT = 44; // Altura da linha no post (ajustada para 1080px)
  const MARGIN_TOP = 280; // Espaço para o cabeçalho floral do papel
  
  Object.assign(container.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1080px',
    height: '1350px', // Formato 4:5 clássico do Instagram
    backgroundColor: '#fdf8f4',
    boxSizing: 'border-box',
    fontFamily: '"Outfit", "Inter", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    // Fundo: Linhas pautadas + Imagem de Papel de Carta
    backgroundImage: `
      linear-gradient(to bottom, transparent ${MARGIN_TOP}px, #e5d5e0 ${MARGIN_TOP}px, #e5d5e0 ${MARGIN_TOP + 1}px, transparent ${MARGIN_TOP + 1}px),
      linear-gradient(rgba(180, 160, 200, 0.15) 1px, transparent 1px),
      ${stationeryUrl ? `url(${stationeryUrl})` : 'none'}
    `,
    backgroundSize: `100% 100%, 100% ${LINE_HEIGHT}px, cover`,
    backgroundPosition: `0 0, 0 ${MARGIN_TOP}px, center`,
    backgroundRepeat: 'no-repeat, repeat, no-repeat',
  });

  // Área do Cabeçalho (Título e Info) - Posicionado na zona limpa do papel
  const header = document.createElement('div');
  Object.assign(header.style, {
    height: `${MARGIN_TOP}px`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '0 80px',
    textAlign: 'center'
  });

  const title = document.createElement('div');
  title.innerText = entry.title || 'Meu Diário';
  Object.assign(title.style, {
    fontSize: '44px',
    fontWeight: '700',
    color: '#462d37',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '2px'
  });

  const meta = document.createElement('div');
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  meta.innerText = `${entry.mood || '😊'}  •  ${date}`;
  Object.assign(meta.style, {
    fontSize: '24px',
    color: '#8d757f',
    fontStyle: 'italic'
  });

  header.appendChild(title);
  header.appendChild(meta);
  container.appendChild(header);

  // Área do Conteúdo (Texto Pautado)
  const content = document.createElement('div');
  content.innerText = entry.content;
  Object.assign(content.style, {
    fontSize: '32px',
    lineHeight: `${LINE_HEIGHT}px`,
    color: '#281e14',
    whiteSpace: 'pre-wrap',
    padding: `0 100px 40px 140px`, // Margem esquerda maior como em cadernos
    flex: '1',
    marginTop: '10px' // Pequeno ajuste para alinhar o texto com a primeira linha
  });

  container.appendChild(content);

  // Marca d'água sutil no canto
  const watermark = document.createElement('div');
  watermark.innerText = 'Bia Diário';
  Object.assign(watermark.style, {
    position: 'absolute',
    bottom: '30px',
    right: '40px',
    fontSize: '18px',
    color: '#bc1888',
    opacity: '0.4',
    fontWeight: 'bold'
  });
  container.appendChild(watermark);

  document.body.appendChild(container);

  try {
    const options = {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#fdf8f4',
    };

    // Delay para renderização de fontes e imagens
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
