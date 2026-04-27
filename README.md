# 📓 Bia Diário — Diário Inteligente

App de diário pessoal mobile-first com suporte a áudio, transcrição, tradução automática e temas visuais com IA.

## ✨ Funcionalidades

- 📱 **Mobile-first** — Interface otimizada para celular com FAB button
- 📅 **Navegação por tempo** — Dia, mês e ano com swipe e calendário
- 🎤 **Gravação de áudio** — Grave diretamente no navegador
- 🧠 **Transcrição IA** — Whisper API para voz → texto
- 🌍 **Tradução automática** — Detecta idioma e traduz
- 😊 **Humor/emoção** — Emojis associados a cada registro
- 🎨 **Temas dinâmicos** — 6 temas + geração com Google Gemini
- 🔐 **Autenticação** — Supabase Auth com modo demo
- 📝 **Design caderno** — Fonte manuscrita + linhas de caderno

## 🚀 Setup Rápido

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env

# Rodar em dev
npm run dev
```

## ⚙️ Configuração

### Supabase (Banco + Auth + Storage)

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o SQL em `supabase-schema.sql` no SQL Editor
3. Copie a URL e Anon Key para `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

### Whisper (Transcrição de Áudio)

Para transcrição automática de áudio gravado:

```env
VITE_WHISPER_API_KEY=sk-xxx
VITE_WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions
```

### Gemini (Temas com IA)

Para geração de temas dinâmicos:

```env
VITE_GEMINI_API_KEY=AIza...
```

### Modo Demo

Sem configurar nenhuma API, o app funciona em **modo demo** com localStorage.

## 🗄️ Banco de Dados

Tabela `entries`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | TEXT | ID único |
| user_id | UUID | Referência ao usuário |
| title | TEXT | Título (opcional) |
| content | TEXT | Conteúdo do registro |
| translated_content | TEXT | Tradução automática |
| original_language | TEXT | Idioma detectado |
| mood | TEXT | Emoji de humor |
| audio_url | TEXT | URL do áudio |
| created_at | TIMESTAMPTZ | Data/hora (UTC) |

## 🎨 Temas Disponíveis

| Tema | Emoji | Descrição |
|------|-------|-----------|
| Caderno Clássico | 📓 | Estilo diário tradicional |
| Rosa Suave | 🌸 | Tons pastel rosa |
| Oceano Calmo | 🌊 | Azul água e verde |
| Lavanda Noturna | 🌙 | Tons roxo e lilás |
| Floresta Verde | 🌿 | Verde natureza |
| Modo Escuro | 🌑 | Dark mode elegante |

## 📁 Estrutura

```
src/
├── components/
│   ├── AuthScreen.jsx        # Login/cadastro
│   ├── DiaryHome.jsx         # Tela principal
│   ├── DateNavigator.jsx     # Navegação de data
│   ├── EntryList.jsx         # Lista de registros
│   ├── EntryForm.jsx         # Criar/editar registro
│   ├── MoodSelector.jsx      # Seletor de humor
│   ├── AudioRecorderComponent.jsx  # Gravação
│   ├── AudioPlayer.jsx       # Reprodutor de áudio
│   └── ThemeSelector.jsx     # Seletor de temas
├── contexts/
│   ├── AuthContext.jsx        # Estado de autenticação
│   ├── DiaryContext.jsx       # Estado do diário
│   └── ThemeContext.jsx       # Estado de tema
├── lib/
│   ├── supabase.js           # Cliente Supabase
│   ├── store.js              # CRUD de dados
│   ├── dateUtils.js          # Utilitários pt-BR
│   ├── audioRecorder.js      # MediaRecorder API
│   ├── whisper.js            # Transcrição IA
│   └── geminiThemes.js       # Temas com Gemini
├── App.jsx
├── main.jsx
└── index.css
```

## 🚢 Deploy (Vercel)

```bash
npm run build
# Faça deploy da pasta dist/
```

Ou conecte o repositório ao [Vercel](https://vercel.com) para deploy automático.

## 🇧🇷 Localização

- Fuso: `America/Sao_Paulo`
- Formato: `pt-BR`
- Banco salva em UTC, frontend converte
- Hora em formato 24h (HH:mm)

## 📄 Licença

MIT
