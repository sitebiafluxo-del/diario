import html2canvas from 'html2canvas';

/**
 * Captura um elemento do diário e gera uma imagem para o Instagram.
 * @param {HTMLElement} element - O elemento HTML a ser capturado (normalmente o entry-form)
 * @param {string} fileName - Nome base para o arquivo
 */
export async function exportToInstagram(element, fileName = 'bia-diario-post') {
  if (!element) return;

  try {
    // Escondemos botões e elementos que não devem sair na foto
    const elementsToHide = element.querySelectorAll('.entry-form-actions, .icon-button, .page-navigator, .transcription-model-selector, .record-button, .audio-player, .translation-toggle');
    elementsToHide.forEach(el => el.style.visibility = 'hidden');

    // Opções para alta qualidade
    const options = {
      scale: 3, // Aumenta a resolução
      useCORS: true, // Permite imagens externas (stationery do Supabase)
      backgroundColor: '#fdf8f4', // Fundo padrão caso não haja stationery
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    };

    const canvas = await html2canvas(element, options);
    
    // Restauramos a visibilidade
    elementsToHide.forEach(el => el.style.visibility = 'visible');

    // Converte para blob para download
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    
    // Cria o link de download
    const link = document.createElement('a');
    link.download = `${fileName}.jpg`;
    link.href = dataUrl;
    link.click();

    return true;
  } catch (error) {
    console.error('Falha ao exportar para Instagram:', error);
    throw error;
  }
}
