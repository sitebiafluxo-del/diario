# Bia Diário — Especificação SDD

App de diário pessoal mobile-first com stationery, exportação PDF, transcrição de áudio por IA e geração de papéis carta com IA.

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
| Geração stationery | Pollinations.ai (Flux + SDXL) |
| Deploy Web | Vercel |

---

## Funcionalidades

- Diário com data/hora no fuso `America/Sao_Paulo`
- Gravação e transcrição de áudio (Whisper, Groq, GPT-4o)
- Formatação automática do texto transcrito com regras gramaticais pt-BR (`textFormatter.js`)
- Tradução automática de texto
- Seletor de humor (emoji)
- 6 temas visuais + geração com IA (Pollinations — Flux e SDXL)
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
| `padding` | `185px 60px 180px 90px` |
| `height` | `calc(185px + 6 * 32px + 180px)` = 557px |
| `background-position` | `0 56px` (linhas alinhadas ao padding-top) |
| `overflow` | `hidden` + `resize: none` |

### Quebra de página — digitação

1. `handleContentChange` verifica `lines.length > PAGES_SIZE` (quebras explícitas com `\n`)
2. Se não estourar explicitamente, `flushSync` força atualização do DOM e depois `checkVisualOverflow` mede `scrollHeight > clientHeight`
3. `measureHeight(ta, text)` — helper que temporariamente seta `overflow: scroll` antes de medir `scrollHeight`, corrigindo bug do Android WebView onde `overflow: hidden` retorna `scrollHeight === clientHeight`
4. `checkVisualOverflow` usa `measuringRef` para bloquear `handleContentChange` recursivo durante a busca binária, faz busca binária no texto para achar o ponto de overflow, recua até limite de palavra, e aplica hifenização pt-BR (`findPtBrBreak`) na última palavra se necessário
5. `findPtBrBreak(word, maxPos)` — hifenização silábica pt-BR: respeita vogais, ditongos e dígrafos/clusters que não se separam
6. Página vazia em posição não-inicial → remove a página e volta para anterior

### Quebra de página — transcrição de áudio

1. Texto transcrito passa por `formatTranscription(rawText)` antes de ser inserido:
   - Divide em sentenças (`.`, `!`, `?` + letra maiúscula)
   - Capitaliza cada sentença
   - Detecta perguntas (por início ou fim da frase) → adiciona `?`
   - Detecta exclamações → adiciona `!`
   - Agrupa 3 sentenças por parágrafo separado por `\n`
2. Usa o mesmo algoritmo de busca binária com `measureHeight` + `measuringRef`, iterando sobre o texto formatado até distribuir tudo em páginas

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

| Elemento | Posição / Valor |
|----------|----------------|
| Header (emoji + título + data) | `hy = PX_H * 0.16` (stationery) / `PX_H * 0.07` (sem stationery) |
| `TEXT_TOP` (início das linhas) | `PX_H * 0.24` (stationery) / `PX_H * 0.27` (sem stationery) |
| `TEXT_BTM` (fim das linhas) | `PX_H * 0.91` |
| `padLeft` | `90 * SCALE * 2` = 360px canvas |
| `padRight` | `60 * SCALE * 2` = 240px canvas |
| Fonte | 16px CSS × SCALE = 32px canvas ≈ 12pt PDF |

> `padLeft` e `padRight` são assimétricos — não usar `padX` para ambos os lados.

---

## Geração de Stationery com IA

### Engines disponíveis

| Engine | Modelo | Dimensões | Prompt |
|--------|--------|-----------|--------|
| Flux | `flux` (Pollinations) | 768×1024 (3:4) | Border frame, watercolor nas bordas, área central vazia |
| SDXL | `sdxl` (Pollinations) | 576×1024 (9:16) | Full-page portrait, design cobre toda a largura |

### Prompts (ambos em inglês)

**Flux:**
```
Decorative stationery paper border frame, {theme} watercolor illustrations only on the outer edges,
ornate top/bottom border decoration, thin left/right margin decoration, large completely empty pure
white center writing area occupying 70% of the page, pastel soft colors, portrait 9:16,
no text, no watermark, no people, no faces, no human features
```

**SDXL:**
```
Portrait stationery paper (3:4 ratio), full background design covering entire width and height,
no empty side borders. Theme: {theme}, visual elements spanning full horizontal width.
Soft 2D digital illustration, minimalist and elegant. Decorative elements extend edge to edge.
Soft light central area for writing. STRICTLY FORBIDDEN: human faces, eyes, mouth, nose, head,
people, body parts, characters, portraits.
```

### Negative prompt (Flux e SDXL)

Usa sintaxe de peso para reforçar exclusão de rostos:
```
(human face:2), (face:2), (eyes:2), (mouth:2), (nose:2), (head:2), (portrait:2), (person:2),
(people:2), (human:2), narrow design, compressed, squished, text, watermark, facial features,
eyebrows, lips, skin, realistic face
```

### Pós-processamento

- `applyWhiteFade(blob, fadeScale, fadeOpacity)` — aplica fade branco radial sobre a imagem gerada para clarear o centro antes de salvar como stationery

---

## Formatação de Texto Transcrito (`src/lib/textFormatter.js`)

`formatTranscription(rawText)` aplica regras gramaticais pt-BR ao texto bruto do Whisper:

| Passo | Descrição |
|-------|-----------|
| Normalização | Remove espaços duplos |
| Split em sentenças | Divide em `.` `!` `?` seguidos de letra maiúscula |
| Capitalização | Início de cada sentença em maiúscula |
| Pontuação interrogativa | Detecta início de pergunta (`como`, `quando`, `você acha`, etc.) ou final (`né`, `certo`, `verdade`) |
| Pontuação exclamativa | Detecta início de exclamação (`nossa`, `caramba`, `que lindo`, etc.) |
| Parágrafos | Agrupa 3 sentenças por parágrafo separado por `\n` |

---

## Estrutura de Arquivos

```
src/
├── components/
│   ├── EntryForm.jsx         # Editor principal, paginação, stationery, PDF, geração IA
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
│   ├── textFormatter.js      # Formatação pt-BR para texto transcrito por voz
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

# 2. Copiar assets manualmente (alternativa ao cap sync)
cp -r dist/. android/app/src/main/assets/public/

# 3. APK release
cd android && KEYSTORE_PASSWORD=biaDiario2024 ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

**Keystore release:**
- Arquivo: `android/bia-diario-release.jks`
- Alias: `bia-diario`
- Senha: variável de ambiente `KEYSTORE_PASSWORD` (nunca commitar a senha)
- **Não commitar** — obrigatório para atualizações na Play Store

**Atenção:** Arquivos de recurso Android não podem ter espaços no nome. Se aparecer erro `' ' is not a valid file-based resource name`, remover arquivos `config N.xml` de `android/app/src/main/res/xml/`.

---

## Web — Deploy

```bash
git push origin main   # Vercel deploy automático
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
3. **`measureHeight(ta, text)`** deve ser usado em vez de `ta.scrollHeight` direto — o WebView Android retorna `scrollHeight === clientHeight` quando `overflow: hidden`.
4. **`measuringRef`** deve estar `true` durante qualquer busca binária que altere `ta.value`, para evitar `handleContentChange` recursivo.
5. **`checkVisualOverflow` usa hifenização pt-BR** (`findPtBrBreak`) na última palavra ao mover overflow para próxima página.
6. **PDF stationery é sempre landscape 2-up** — nunca portrait para entradas com stationery.
7. **`padLeft` e `padRight` são assimétricos no PDF** — não unificar em `padX`.
8. **Prompts de geração de stationery devem ser em inglês** para melhor entendimento pelos modelos de difusão.
9. **O keystore `bia-diario-release.jks` nunca vai para o git.**
10. **Arquivos XML Android não podem ter espaços no nome.**
