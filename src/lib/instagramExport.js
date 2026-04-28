import html2canvas from 'html2canvas';

/**
 * Exporta o registro para uma imagem otimizada para Instagram.
 * Cria uma representação visual limpa antes da captura.
 */
export async function exportToInstagram(entry, stationeryUrl, fileName = 'bia-diario-post') {
  // Criamos um container temporário para a "arte" do post
  const container = document.createElement('div');
  container.className = 'insta-export-container';
  
  // Estilo do container (proporção 4:5 ou 9:16)
  Object.assign(container.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1080px',
    minHeight: '1350px', // Formato 4:5 (Post do Insta)
    backgroundColor: '#fdf8f4',
    padding: '80px 60px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    fontFamily: '"Outfit", "Inter", sans-serif',
    backgroundImage: stationeryUrl ? `url(${stationeryUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  });

  // Cabeçalho (Título e Data)
  const header = document.createElement('div');
  Object.assign(header.style, {
    textAlign: 'center',
    marginBottom: '40px',
    borderBottom: '2px solid rgba(0,0,0,0.05)',
    paddingBottom: '20px'
  });

  const title = document.createElement('h1');
  title.innerText = entry.title || 'Meu Diário';
  Object.assign(title.style, {
    fontSize: '48px',
    margin: '0 0 10px 0',
    color: '#462d37',
  });

  const meta = document.createElement('div');
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  meta.innerText = `${entry.mood || '😊'}  •  ${date}`;
  Object.assign(meta.style, {
    fontSize: '28px',
    color: '#6e555f',
    opacity: '0.8'
  });

  header.appendChild(title);
  header.appendChild(meta);
  container.appendChild(header);

  // Conteúdo (Texto)
  const content = document.createElement('div');
  content.innerText = entry.content;
  Object.assign(content.style, {
    fontSize: '34px',
    lineHeight: '1.6',
    color: '#281e14',
    whiteSpace: 'pre-wrap',
    flex: '1',
    marginTop: '20px'
  });

  container.appendChild(content);

  // Rodapé decorativo
  const footer = document.createElement('div');
  footer.innerText = 'Gerado por Bia Diário ✨';
  Object.assign(footer.style, {
    textAlign: 'center',
    marginTop: '40px',
    fontSize: '20px',
    color: '#bc1888',
    opacity: '0.6',
    fontWeight: 'bold'
  });
  container.appendChild(footer);

  document.body.appendChild(container);

  try {
    const options = {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    };

    // Pequeno delay para garantir carregamento da imagem de fundo
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(container, options);
    
    // Converte e baixa
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
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
