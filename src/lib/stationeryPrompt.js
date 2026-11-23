/**
 * Montagem do prompt do papel de carta — módulo PURO (sem APIs do navegador),
 * usado pelo app e pelo servidor (/api/generate-paper), para que os dois
 * gerem exatamente o mesmo pedido.
 */

export const MONO_PALETTES = [
  { id: 'rosa', label: 'Rosa', hex: '#e8789e', desc: 'Tons suaves de rosa e blush' },
  { id: 'azul', label: 'Azul', hex: '#64b5f6', desc: 'Tons de azul celeste e mar' },
  { id: 'lilas', label: 'Lavanda', hex: '#ba68c8', desc: 'Tons de lilás e lavanda suave' },
  { id: 'verde', label: 'Sálvia', hex: '#81c784', desc: 'Tons de verde botânico e oliva' },
  { id: 'dourado', label: 'Dourado/Terra', hex: '#d4a373', desc: 'Tons de bege, sépia e terra cota' },
  { id: 'cinza', label: 'Grafite', hex: '#757575', desc: 'Tons neutros de grafite e cinza suave' },
];

/**
 * Traduz termos comuns de português para inglês para máxima qualidade nos modelos de IA
 */
function translateThemeTerms(text) {
  if (!text) return 'vintage roses and delicate wildflowers';
  const t = text.toLowerCase().trim();

  // Termos SEM acréscimos que roubem a cena (ex.: nada de "floral" em animais).
  // Inclui ações e lugares comuns para frases como "gatinhos tomando banho".
  const dict = {
    // temas
    'rosas vintage': 'vintage soft roses',
    'rosa vintage': 'vintage soft roses',
    'rosas': 'watercolor roses',
    'borboletas delicadas': 'delicate butterflies',
    'borboletas': 'butterflies',
    'borboleta': 'a butterfly',
    'jardim botânico': 'botanical garden plants',
    'jardim botanico': 'botanical garden plants',
    'flores silvestres': 'wildflowers',
    'flores': 'flowers',
    'flor': 'a flower',
    'gatinhos fofos': 'cute kittens',
    'gatinhos': 'cute kittens',
    'gatinho': 'a cute kitten',
    'gatos': 'cats',
    'gato': 'a cat',
    'cachorrinhos': 'cute puppies',
    'cachorrinho': 'a cute puppy',
    'cachorros': 'dogs',
    'cachorro': 'a dog',
    'coelhinhos': 'cute bunnies',
    'coelhinho': 'a cute bunny',
    'ursinhos': 'teddy bears',
    'ursinho': 'a teddy bear',
    'passarinhos': 'little birds',
    'passarinho': 'a little bird',
    'patinhos': 'little ducklings',
    'céu estrelado': 'starry night sky with crescent moon',
    'ceu estrelado': 'starry night sky with crescent moon',
    'café e livros': 'coffee cup and books',
    'cafe e livros': 'coffee cup and books',
    'conchas do mar': 'sea shells and starfish',
    'moranguinhos': 'cute strawberries',
    'morangos': 'strawberries',
    'morango': 'a strawberry',
    'lavanda': 'lavender',
    'girassóis': 'sunflowers',
    'girassois': 'sunflowers',
    'girassol': 'a sunflower',
    'corações': 'little hearts',
    'coracoes': 'little hearts',
    'balões': 'balloons',
    'baloes': 'balloons',
    'bolo de aniversário': 'birthday cake',
    'natal': 'christmas decorations',
    // ações
    'tomando banho de banheira': 'taking a bubble bath in a bathtub',
    'tomando banho': 'taking a bubble bath in a little bathtub with soap bubbles',
    'tomando café': 'drinking coffee',
    'tomando sol': 'sunbathing',
    'dormindo': 'sleeping',
    'brincando': 'playing',
    'comendo': 'eating',
    'lendo': 'reading a book',
    'voando': 'flying',
    'nadando': 'swimming',
    'dançando': 'dancing',
    'dancando': 'dancing',
    'pescando': 'fishing',
    'cozinhando': 'cooking',
    'abraçados': 'hugging',
    'abracados': 'hugging',
    // lugares / complementos
    'na praia': 'at the beach',
    'no jardim': 'in the garden',
    'na chuva': 'in the rain',
    'na neve': 'in the snow',
    'no campo': 'in a meadow',
    'na cozinha': 'in the kitchen',
    'com bolhas de sabão': 'with soap bubbles',
    'com flores': 'with flowers',
    'de chapéu': 'wearing hats',
    'de chapeu': 'wearing hats',
    // conectivos
    ' e ': ' and ',
    ' com ': ' with ',
  };


  // Passada ÚNICA sobre o texto original, termos mais longos primeiro e com
  // limites de palavra Unicode. Antes, cada substituição rodava sobre o texto já
  // traduzido e 'flor' casava dentro de 'floral' ("flowersal").
  const terms = Object.keys(dict).sort((a, b) => b.length - a.length);
  const escaped = terms.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<!\\p{L})(${escaped.join('|')})(?!\\p{L})`, 'gu');
  return t.replace(re, (m) => dict[m]);
}

export function buildStationeryPrompt({ theme, position = 'frame', colorMode = 'color', monoColor = 'rosa', analyzedInfo = null }) {
  const userIdea = (theme && theme.trim()) || '';
  const rawTheme = userIdea || analyzedInfo?.themeDescription || 'vintage roses and delicate wildflowers';
  const translatedTheme = translateThemeTerms(rawTheme);
  // Não repetir a frase em português: modelos bons em texto (FLUX.2) a "escrevem" na imagem
  const subject = translatedTheme;

  // Onde ficam as ilustrações DO TEMA (sem impor flores/folhas)
  const layoutRule = {
    top: 'the illustrations are placed only along the top edge of the page',
    bottom: 'the illustrations are placed only along the bottom edge of the page',
    sides: 'the illustrations are placed only along the left and right margins',
    all: 'the illustrations form a decorative border around all four edges',
    frame: 'one illustration in the top-left corner and one in the bottom-right corner',
  }[position] || 'illustrations only in the corners';

  let colorRule;
  if (colorMode === 'mono') {
    const palObj = MONO_PALETTES.find(p => p.id === monoColor) || MONO_PALETTES[0];
    colorRule = `monochromatic, only shades of ${palObj.label.toLowerCase()} (${palObj.desc})`;
  } else {
    colorRule = 'soft pastel watercolor colors';
    if (analyzedInfo?.suggestedColors) colorRule += `, palette inspired by ${analyzedInfo.suggestedColors}`;
  }

  // Linhas NÃO são pedidas à IA (ela desenha mal): o app desenha depois, perfeitas.
  return [
    `Printable stationery letter paper. Main subject, clearly visible and charming: ${subject}`,
    `cute hand-painted watercolor illustration style, ${layoutRule}`,
    colorRule,
    'large completely blank pure white center area for handwriting, no lines',
    'absolutely no text, no words, no lettering, no captions, no title anywhere on the page',
    'flat 2D design seen from the top, filling the whole page, pure white background (#ffffff)',
    'no photo of paper, no mockup, no table, no shadows, no frame, no logo',
  ].join(', ');
}
