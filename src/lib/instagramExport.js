import html2canvas from 'html2canvas';

export async function exportToInstagram(element, fileName = 'bia-diario-post') {
  if (!element) return;

  const elementsToHide = element.querySelectorAll(
    '.entry-form-actions, .icon-button, .page-navigator, .transcription-model-selector, .record-button, .audio-player, .translation-toggle'
  );
  elementsToHide.forEach(el => (el.style.visibility = 'hidden'));

  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#fdf8f4',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const link = document.createElement('a');
    link.download = `${fileName}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    return true;
  } catch (error) {
    console.error('Falha ao exportar para Instagram:', error);
    throw error;
  } finally {
    elementsToHide.forEach(el => (el.style.visibility = 'visible'));
  }
}
