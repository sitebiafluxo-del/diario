// Regras gramaticais pt-BR para texto transcrito por voz

// Palavras/expressões que indicam pergunta no início da frase
const QUESTION_STARTERS = [
  'como', 'quando', 'onde', 'qual', 'quais', 'quem',
  'quanto', 'quanta', 'quantos', 'quantas',
  'por que', 'porque', 'o que', 'o quê',
  'de onde', 'para onde', 'pra onde', 'até quando',
  'será que', 'será', 'você sabe', 'vocês sabem',
  'tem como', 'dá pra', 'dá para', 'é possível',
  'você foi', 'você viu', 'você gosta', 'você acha',
  'você quer', 'você precisa', 'você pode', 'você está',
  'você sabe', 'você conhece', 'você fez', 'você tem',
  'vocês foram', 'vocês viram', 'alguém sabe', 'alguém foi',
];

// Palavras/expressões que indicam exclamação
const EXCLAMATION_STARTERS = [
  'nossa', 'nossa senhora', 'caramba', 'meu deus', 'ai meu deus',
  'uau', 'wow', 'xi', 'eita', 'puxa', 'poxa',
  'que lindo', 'que bonito', 'que coisa', 'que saudade',
  'que legal', 'que ótimo', 'que maravilha', 'que absurdo',
  'que horror', 'que delícia', 'que medo', 'que vergonha',
  'que raiva', 'que emoção', 'que alegria', 'que tristeza',
  'que pena', 'que incrível', 'que fantástico', 'que bom',
  'que ruim', 'que besteira', 'que droga', 'que susto',
  'que notícia', 'que sorte', 'que azar',
  'parabéns', 'adorei', 'amei', 'impossível', 'inacreditável',
  'incrível', 'fantástico', 'maravilhoso', 'absurdo',
];

// Sufixos/palavras no final que indicam pergunta
const QUESTION_ENDERS = [
  'né', 'né não', 'certo', 'não é', 'não é mesmo',
  'verdade', 'tá bom', 'pode ser', 'concordam', 'concorda',
];

function normalize(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function removeFinalPunct(str) {
  return str.replace(/[.!?,;:]+$/, '').trimEnd();
}

function detectPunctuation(sentence) {
  const s = sentence.toLowerCase().trim();

  // Já tem pontuação final definida → respeita
  if (/[!?]$/.test(sentence)) return sentence;

  // Verifica exclamação
  for (const starter of EXCLAMATION_STARTERS) {
    if (s.startsWith(starter)) {
      return removeFinalPunct(sentence) + '!';
    }
  }

  // Verifica pergunta pelo início
  for (const starter of QUESTION_STARTERS) {
    if (s.startsWith(starter + ' ') || s === starter) {
      return removeFinalPunct(sentence) + '?';
    }
  }

  // Verifica pergunta pelo final
  for (const ender of QUESTION_ENDERS) {
    if (s.endsWith(' ' + ender) || s === ender) {
      return removeFinalPunct(sentence) + '?';
    }
  }

  // Frase sem pontuação final → adiciona ponto
  if (!/[.!?]$/.test(sentence)) {
    return sentence.trimEnd() + '.';
  }

  return sentence;
}

// Divide o texto em sentenças usando pontuação existente do Whisper
function splitIntoSentences(text) {
  // Divide em: . ! ? seguidos de espaço + letra maiúscula, ou final de string
  const raw = text
    .replace(/([.!?])\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ])/g, '$1\n$2')
    .replace(/([.!?])$/g, '$1')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  return raw;
}

// Agrupa sentenças em parágrafos (2–3 sentenças por parágrafo para diário)
function groupIntoParagraphs(sentences, sentencesPerParagraph = 3) {
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(' '));
  }
  return paragraphs;
}

/**
 * Formata texto transcrito aplicando regras gramaticais do pt-BR:
 * - Capitaliza início de cada frase
 * - Adiciona ? em perguntas
 * - Adiciona ! em exclamações
 * - Quebra em parágrafos
 */
export function formatTranscription(rawText) {
  if (!rawText || !rawText.trim()) return rawText;

  const normalized = normalize(rawText);
  const sentences = splitIntoSentences(normalized);

  const formatted = sentences.map(s => {
    const capped = capitalize(s.trim());
    return detectPunctuation(capped);
  });

  // Parágrafos separados por \n (cada parágrafo = 3 frases)
  const paragraphs = groupIntoParagraphs(formatted, 3);
  return paragraphs.join('\n');
}
