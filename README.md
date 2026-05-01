# Bia Diário — Especificação SDD

App de diário pessoal mobile-first com stationery, exportação PDF e transcrição de áudio por IA.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite 5 |
| Mobile | Capacitor 8 (Android) |
| Banco/Auth | Supabase |
| Estilo | CSS puro (index.css) |
| PDF | jsPDF + Canvas API |
| Transcrição | Whisper / Groq / GPT-4o |
| Deploy Web | Vercel |

---

## Funcionalidades

- Diário com data/hora no fuso `America/Sao_Paulo`
- Gravação e transcrição de áudio (Whisper, Groq, GPT-4o)
- Tradução automática de texto
- Seletor de humor (emoji)
- 6 temas visuais + geração com IA (Pollinations/SDXL)
- **Stationery** — papel decorado com paginação e exportação PDF
- Autenticação Supabase + modo demo (localStorage)

---

## Stationery — Regras de Paginação

### App (editor)

| Parâmetro | Valor |
|-----------|-------|
| `PAGES_SIZE` | 6 linhas por página |
| `rows` textarea | 6 |
| `line-height` | 32px |
| `padding` | `217px 60px 180px 90px` |
| `height` | `calc(217px + 6 * 32px + 180px)` = 589px |
| `background-position` | `0 88px` (linhas alinhadas ao padding-top) |
| `overflow` | `hidden` + `resize: none` |

### Quebra de página — digitação

1. `handleContentChange` verifica `lines.length > PAGES_SIZE` (quebras explícitas com `\n`)
2. Se não estourar explicitamente, `requestAnimationFrame(() => checkVisualOverflow(...))` mede `scrollHeight > clientHeight` para detectar overflow de word-wrap
3. `checkVisualOverflow` faz busca binária no textarea para achar o ponto exato de overflow, recua até limite de palavra (espaço/`\n`), move excedente para próxima página
4. Página vazia em posição não-inicial → remove a página e volta para anterior

### Quebra de página — transcrição de áudio

Usa o mesmo algoritmo de busca binária **sincronamente**, iterando sobre o texto transcrito até distribuir tudo em páginas que caibam no textarea sem overflow. Não usa `setContent` direto.

---

## PDF Export (`src/lib/pdfExport.js`)

### Modo stationery — landscape 2-up

- Orientação: **landscape A4** (297mm × 210mm)
- 2 páginas do app ficam lado a lado em cada folha PDF
- Canvas por página: `PX_H × PX_W` = 2246px × 1588px, desenhado em metade do canvas landscape
- `linesPerPage = 6` (igual ao `PAGES_SIZE` do app)
- **Ambas as páginas** de cada spread mostram o cabeçalho (emoji + data)
- `wrapLine` quebra palavras longas sem espaço caractere a caractere

### Modo sem stationery — portrait

- Orientação: portrait A4 (210mm × 297mm)
- `linesPerPage` calculado dinamicamente: `floor(usableH / lineH)`

### Layout de cada página stationery no canvas

| Elemento | Posição |
|----------|---------|
| Header (emoji + título + data) | `hy = PX_H * 0.16` |
| `TEXT_TOP` (início das linhas) | `PX_H * 0.24` |
| `TEXT_BTM` (fim das linhas) | `PX_H * 0.91` |
| `padLeft` | `90px * SCALE * 2` = 360px canvas |
| `padRight` | `60px * SCALE * 2` = 240px canvas |
| Fonte | 16px CSS × SCALE = 32px canvas ≈ 12pt PDF |

---

## Estrutura de Arquivos

```
src/
├── components/
│   ├── EntryForm.jsx         # Editor principal, paginação, stationery, PDF
│   ├── DiaryHome.jsx         # Tela principal
│   ├── AuthScreen.jsx        # Login/cadastro
│   ├── MoodSelector.jsx      # Seletor de humor
│   ├── AudioRecorderComponent.jsx
│   ├── AudioPlayer.jsx
│   └── ThemeSelector.jsx
├── contexts/
│   ├── AuthContext.jsx
│   ├── DiaryContext.jsx
│   └── ThemeContext.jsx
├── lib/
│   ├── pdfExport.js          # Exportação PDF (portrait + landscape 2-up)
│   ├── supabase.js
│   ├── store.js
│   ├── dateUtils.js          # Fuso America/Sao_Paulo, pt-BR
│   ├── audioRecorder.js
│   ├── whisper.js
│   ├── capacitor.js
│   └── geminiThemes.js
├── App.jsx
├── main.jsx
└── index.css                 # Todos os estilos, temas via CSS vars
android/
├── app/build.gradle          # Signing config (bia-diario-release.jks)
├── bia-diario-release.jks    # Keystore release (NÃO commitar)
└── ...
```

---

## Banco de Dados (Supabase)

Tabela `entries`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | TEXT | UUID |
| user_id | UUID | Auth user |
| title | TEXT | Título |
| content | TEXT | Conteúdo (todas as páginas concatenadas com `\n`) |
| translated_content | TEXT | Tradução |
| mood | TEXT | Emoji |
| audio_url | TEXT | URL do áudio |
| stationery_url | TEXT | URL da stationery |
| created_at | TIMESTAMPTZ | UTC |

---

## Android — Build e Deploy

```bash
# 1. Build web
npm run build

# 2. Sync Capacitor
npx cap sync android

# 3. APK release
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

**Keystore release:**
- Arquivo: `android/bia-diario-release.jks`
- Alias: `bia-diario`
- Senha: variável de ambiente `KEYSTORE_PASSWORD` (nunca commitar a senha)
- **Não commitar** — obrigatório para atualizações na Play Store

**Antes de buildar**, exportar localmente:
```bash
export KEYSTORE_PASSWORD="sua_senha_aqui"
```

**Atenção:** Arquivos de recurso Android não podem ter espaços no nome. Se aparecer erro `' ' is not a valid file-based resource name`, remover arquivos `config N.xml` de `android/app/src/main/res/xml/`.

---

## Web — Deploy

```bash
npx vercel --prod
# URL: https://diario-ashen.vercel.app
```

---

## Variáveis de Ambiente

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_WHISPER_API_KEY=
VITE_WHISPER_API_URL=
VITE_GEMINI_API_KEY=
```

---

## Regras para Agentes IA

1. **Paginação é a fonte de verdade do app** — qualquer mudança em `PAGES_SIZE`, `padding`, `line-height` ou `height` do textarea stationery deve ser refletida no `pdfExport.js` e vice-versa.
2. **Não usar `setContent` direto** em stationery — sempre passar por `handleContentChange` ou o algoritmo de split por busca binária.
3. **`checkVisualOverflow` não usa hifenização** — apenas quebra em limites de palavra.
4. **PDF stationery é sempre landscape 2-up** — nunca portrait para entradas com stationery.
5. **O keystore `bia-diario-release.jks` nunca vai para o git.**
6. **Arquivos XML Android não podem ter espaços no nome.**
