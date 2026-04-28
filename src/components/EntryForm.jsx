import { useState, useEffect, useRef, Fragment } from 'react';
import { useDiary } from '../contexts/DiaryContext';
import { nowInBrazil, getDateString, getTimeString, toUTC } from '../lib/dateUtils';
import { transcribeAudio, TRANSCRIPTION_MODELS, getSavedTranscriptionModel, saveTranscriptionModel } from '../lib/whisper';
import MoodSelector from './MoodSelector';
import AudioRecorderComponent from './AudioRecorderComponent';
import AudioPlayer from './AudioPlayer';
import { X, Save, Trash2, Languages, Loader2, Sparkles, Zap, Image as ImageIcon, ChevronLeft, ChevronRight, Download, Upload, CheckCircle, RefreshCw } from 'lucide-react';
import { exportEntryToPDF } from '../lib/pdfExport';

export default function EntryForm({ entry, onClose }) {
  const { addEntry, editEntry, removeEntry, saveAudio, saveStationery } = useDiary();
  const stationeryInputRef = useRef(null);
  const isEditing = !!entry;

  const now = nowInBrazil();
  const [date, setDate] = useState(
    isEditing ? getDateString(new Date(entry.created_at)) : getDateString(now)
  );
  const [time, setTime] = useState(
    isEditing ? getTimeString(new Date(entry.created_at)) : getTimeString(now)
  );
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [translatedContent, setTranslatedContent] = useState(entry?.translated_content || '');
  const [mood, setMood] = useState(entry?.mood || '😊');
  const [audioUrl, setAudioUrl] = useState(entry?.audio_url || null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stationery, setStationery] = useState(entry?.stationery_url || null);
  const [currentPage, setCurrentPage] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [uploadingStationery, setUploadingStationery] = useState(false);
  const [transcriptionModel, setTranscriptionModel] = useState(getSavedTranscriptionModel);

  // Stationery generator modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [genModalType, setGenModalType] = useState('free'); // 'free' | 'ai'
  const [genTheme, setGenTheme] = useState('');
  const [genGenerating, setGenGenerating] = useState(false);
  const [genPreviewUrl, setGenPreviewUrl] = useState(null); // temp URL before saving
  const [genSaving, setGenSaving] = useState(false);
  const [genEngine, setGenEngine] = useState('flux'); // 'flux' | 'sdxl'

  const PAGES_SIZE = 12; // deve bater com rows={12} do textarea

  // Deriva páginas a partir do conteúdo completo
  const getPages = (text) => {
    if (!stationery) return [text];
    const lines = text.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i += PAGES_SIZE) {
      result.push(lines.slice(i, i + PAGES_SIZE).join('\n'));
    }
    return result.length > 0 ? result : [''];
  };

  const pages = getPages(content);
  const currentContent = pages[currentPage] || '';

  const handleContentChange = (newText) => {
    const lines = newText.split('\n');

    if (lines.length > PAGES_SIZE) {
      // Overflow: mantém as primeiras PAGES_SIZE linhas nesta página
      // e move o restante para o início da próxima
      const thisPage = lines.slice(0, PAGES_SIZE).join('\n');
      const overflow = lines.slice(PAGES_SIZE).join('\n');

      const newPages = [...pages];
      newPages[currentPage] = thisPage;

      if (currentPage + 1 < newPages.length) {
        // Prepend overflow na página seguinte existente
        newPages[currentPage + 1] = overflow
          + (newPages[currentPage + 1] ? '\n' + newPages[currentPage + 1] : '');
      } else {
        newPages.push(overflow);
      }

      setContent(newPages.join('\n'));
      setCurrentPage((p) => p + 1);
    } else {
      const newPages = [...pages];
      newPages[currentPage] = newText;
      setContent(newPages.join('\n'));
    }
  };

  // Foca o textarea e posiciona o cursor no início quando muda de página
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textareaRef.current && stationery) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(0, 0);
    }
  }, [currentPage, stationery]);

  const stationeryOptions = [
    { id: 'none', url: null, label: 'Nenhum' },
    { id: 'roses', url: '/backgrounds/stationery_roses.svg', label: 'Rosas' },
    { id: 'floral', url: '/backgrounds/stationery_floral.png', label: 'Floral' },
    { id: 'garden', url: '/backgrounds/stationery_garden.png', label: 'Jardim' },
  ];

  async function handleStationeryUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStationery(true);
    try {
      const url = await saveStationery(file);
      if (url) setStationery(url);
    } finally {
      setUploadingStationery(false);
      e.target.value = '';
    }
  }

  async function handleRecordingComplete(recording) {
    setAudioBlob(recording.blob);
    setAudioUrl(recording.url);

    // Try to transcribe
    setTranscribing(true);
    try {
      console.log('Iniciando transcrição do áudio gravado...');
      const result = await transcribeAudio(recording.blob, transcriptionModel);
      
      if (result && result.text) {
        console.log('Texto transcrito com sucesso:', result.text);
        
        // Atualiza o conteúdo
        setContent((prev) => {
          const separator = prev.trim() ? '\n\n' : '';
          const newContent = prev + separator + result.text;
          
          // Se houver papelaria, vamos calcular a página e mudar para a última
          if (stationery) {
            const lines = newContent.split('\n');
            const totalPages = Math.ceil(lines.length / PAGES_SIZE) || 1;
            setCurrentPage(totalPages - 1);
          }
          
          return newContent;
        });

        // Foca no campo de texto após um pequeno delay para o React renderizar
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
          }
        }, 100);

      } else if (result && result.noApiKey) {
        alert('Áudio salvo! Para transcrição automática, configure a chave OPENAI_API_KEY no Vercel.');
      } else {
        console.warn('Transcrição retornou texto vazio ou nulo.');
      }

      if (result && result.note) {
        console.info(result.note);
      }
    } catch (error) {
      console.error('Erro no fluxo de transcrição:', error);
      alert('Erro ao transcrever o áudio. Verifique sua conexão e tente novamente.');
    } finally {
      setTranscribing(false);
    }
  }

  async function handleSave() {
    if (!content.trim() && !audioUrl) return;

    setSaving(true);
    try {
      let finalAudioUrl = audioUrl;

      // Upload audio if new recording
      if (audioBlob) {
        finalAudioUrl = await saveAudio(audioBlob);
      }

      const dateTime = new Date(`${date}T${time}:00`);

      const entryData = {
        title: title.trim(),
        content: content.trim(),
        translated_content: translatedContent.trim(),
        original_language: 'pt-BR',
        mood,
        audio_url: finalAudioUrl,
        stationery_url: stationery,
        created_at: toUTC(dateTime),
      };

      if (isEditing) {
        await editEntry(entry.id, entryData);
      } else {
        await addEntry(entryData);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save entry:', error);
    } finally {
      setSaving(false);
    }
  }

  function openGenModal(type) {
    setGenModalType(type);
    setGenTheme('');
    setGenPreviewUrl(null);
    setShowGenModal(true);
  }

  async function handleGenerate() {
    setGenGenerating(true);
    setGenPreviewUrl(null);
    try {
      const theme = genTheme.trim() || ['Floral', 'Borboletas', 'Jardim', 'Vintage'][Math.floor(Math.random() * 4)];

      // Tradução dinâmica com mais termos
      const themeTranslations = {
        'cachorro': 'cute puppies',
        'gatinho': 'little kittens, cats',
        'gato': 'kittens',
        'criança': 'happy children playing',
        'menino': 'little boy',
        'menina': 'little girl',
        'fundo do mar': 'ocean, sea life, corals, fish',
        'ceu azul': 'blue sky and clouds',
        'borboleta': 'butterflies',
        'espaco': 'planets and stars'
      };

      let translatedTheme = theme.toLowerCase();
      Object.keys(themeTranslations).forEach(key => {
        if (translatedTheme.includes(key)) {
          translatedTheme = translatedTheme.replace(key, themeTranslations[key]);
        }
      });

      if (genModalType === 'free') {
        // Estratégia de "Moldura Temática"
        const prompt = `A clean white paper with a themed frame made of ${translatedTheme}. The ${translatedTheme} elements are ONLY at the corners and edges. THE CENTER MUST BE EMPTY WHITE WITH GREY HORIZONTAL LINES. STRICTLY NO FLOWERS. NO FLORAL. NO PLANTS. ONLY ${translatedTheme} SUBJECTS. 2D vector art style.`;
        
        // Escolha da IA
        const modelParam = genEngine === 'sdxl' ? 'sdxl' : 'flux';
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=576&height=1024&nologo=true&model=${modelParam}&seed=${Date.now()}`;
        
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error('Pollinations error');
        const blob = await imgRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        setGenPreviewUrl(objectUrl);
      } else {
        // DALL-E 3
        const prompt = `A thematic frame for a diary page. Subject: ${translatedTheme}. The ${translatedTheme} elements are placed in the corners and side margins. The central writing area is white with thin horizontal lines. ABSOLUTELY NO FLOWERS OR VEGETATION. Digital illustration, clean and professional.`;
        let imageUrl = null;

        try {
          const proxyRes = await fetch('/api/generate-stationery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          if (proxyRes.ok) {
            const data = await proxyRes.json();
            imageUrl = data.url;
          }
        } catch (_) {}

        if (!imageUrl) {
          const apiKey = import.meta.env.VITE_WHISPER_API_KEY;
          if (!apiKey) {
            alert('Não foi possível gerar o papel. Verifique os créditos da conta OpenAI em platform.openai.com/billing');
            return;
          }
          const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1792' }),
          });
          if (!res.ok) throw new Error(`DALL-E error: ${res.status}`);
          const data = await res.json();
          imageUrl = data.data?.[0]?.url;
        }

        if (!imageUrl) throw new Error('Sem URL na resposta');
        setGenPreviewUrl(imageUrl);
      }
    } catch (error) {
      console.error('Falha ao gerar papel:', error);
      alert('Erro ao gerar papel. Tente novamente.');
    } finally {
      setGenGenerating(false);
    }
  }

  async function handleSaveStationery() {
    if (!genPreviewUrl) return;
    setGenSaving(true);
    try {
      const imgRes = await fetch(genPreviewUrl);
      const blob = await imgRes.blob();
      const ext = genModalType === 'free' ? 'jpg' : 'png';
      const file = new File([blob], `stationery-${Date.now()}.${ext}`, { type: blob.type });
      const savedUrl = await saveStationery(file);
      if (savedUrl) {
        setStationery(savedUrl);
        setShowGenModal(false);
      }
    } catch (error) {
      console.error('Erro ao salvar papel:', error);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setGenSaving(false);
    }
  }

  async function handleExportPDF() {
    setExportingPDF(true);
    try {
      await exportEntryToPDF({
        title,
        content,
        mood,
        stationery_url: stationery,
        created_at: new Date(`${date}T${time}:00`).toISOString(),
      });
    } finally {
      setExportingPDF(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setSaving(true);
    try {
      await removeEntry(entry.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Fragment>
      <div className="entry-form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="entry-form animate-slide-up">
        {/* Header */}
        <div className="entry-form-header">
          <h2>{isEditing ? 'Editar registro' : 'Novo registro'}</h2>
          <button id="close-form" className="icon-button" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        {/* Mood */}
        <MoodSelector value={mood} onChange={setMood} />

        {/* Date & Time */}
        <div className="entry-form-datetime">
          <input
            id="entry-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="entry-input-date"
          />
          <input
            id="entry-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="entry-input-time"
          />
        </div>

        {/* Title */}
        <input
          id="entry-title"
          type="text"
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="entry-input-title"
        />

        {/* Stationery Selector */}
        <div className="stationery-container">
          <p className="ai-theme-hint" style={{ marginBottom: '4px' }}>Papel de carta:</p>
          <div className="stationery-selector">
            {stationeryOptions.map((opt) => (
              <div
                key={opt.id}
                className={`stationery-option ${stationery === opt.url ? 'active' : ''} ${opt.id === 'none' ? 'none' : ''}`}
                style={opt.url ? { backgroundImage: `url(${opt.url})` } : {}}
                onClick={() => setStationery(opt.url)}
                title={opt.label}
              >
                {opt.id === 'none' && <ImageIcon size={18} />}
              </div>
            ))}
            <div
              className="stationery-option ai"
              onClick={() => openGenModal('free')}
              title="Gerar Papel Grátis (Pollinations)"
            >
              <Zap size={18} />
            </div>
            <div
              className="stationery-option ai sparkles"
              onClick={() => openGenModal('ai')}
              title="Gerar Papel com DALL-E 3 (OpenAI)"
            >
              <Sparkles size={18} />
            </div>

            {/* Upload imagem customizada */}
            <label
              className="stationery-option upload"
              title="Enviar imagem própria"
              style={{ cursor: 'pointer' }}
            >
              <input
                ref={stationeryInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleStationeryUpload}
              />
              {uploadingStationery ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
            </label>
          </div>

          {/* Preview da stationery customizada (URL externa/upload) */}
          {stationery && !stationeryOptions.some(o => o.url === stationery) && (
            <div
              className="stationery-option active"
              style={{ backgroundImage: `url(${stationery})`, width: 80, height: 107, marginTop: 4 }}
              title="Imagem personalizada"
            />
          )}
        </div>


        <div className="entry-content-area">
          <textarea
            ref={textareaRef}
            id="entry-content"
            placeholder="O que está sentindo hoje? ✍️"
            value={stationery ? currentContent : content}
            onChange={(e) => stationery ? handleContentChange(e.target.value) : setContent(e.target.value)}
            className={`entry-textarea ${stationery ? 'stationery' : ''}`}
            style={stationery ? { '--stationery-img': `url(${stationery})` } : {}}
            rows={stationery ? 12 : 8}
          />
          
          {stationery && (
            <div className="page-navigator">
              <button 
                className="nav-arrow" 
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="page-indicator">Página {currentPage + 1}</span>
              <button 
                className="nav-arrow"
                onClick={() => {
                  if (currentPage === pages.length - 1) {
                    // Create new page
                    const newPages = [...pages, ''];
                    setContent(newPages.join('\n'));
                    setCurrentPage(pages.length);
                  } else {
                    setCurrentPage(p => p + 1);
                  }
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {transcribing && (
            <div className="transcribing-indicator">
              <Loader2 size={16} className="spin" />
              Transcrevendo áudio...
            </div>
          )}
        </div>

        {/* Audio Section */}
        <div className="entry-audio-section">
          <div className="transcription-model-selector">
            {TRANSCRIPTION_MODELS.map((m) => (
              <button
                key={m.id}
                className={`transcription-model-btn ${transcriptionModel === m.id ? 'active' : ''}`}
                onClick={() => { setTranscriptionModel(m.id); saveTranscriptionModel(m.id); }}
                title={m.description}
                type="button"
              >
                {m.label}
              </button>
            ))}
          </div>
          <AudioRecorderComponent onRecordingComplete={handleRecordingComplete} />
          {audioUrl && (
            <div className="entry-audio-preview">
              <AudioPlayer src={audioUrl} />
            </div>
          )}
        </div>

        {/* Translation */}
        {translatedContent && (
          <div className="entry-translation">
            <button
              className="translation-toggle"
              onClick={() => setShowTranslation(!showTranslation)}
              type="button"
            >
              <Languages size={16} />
              {showTranslation ? 'Ocultar tradução' : 'Ver tradução'}
            </button>
            {showTranslation && (
              <textarea
                value={translatedContent}
                onChange={(e) => setTranslatedContent(e.target.value)}
                className="entry-textarea translation-text"
                rows={3}
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="entry-form-actions">
          <button
            id="export-pdf"
            className="action-button pdf"
            onClick={handleExportPDF}
            disabled={exportingPDF || (!content.trim() && !title.trim())}
            title="Salvar como PDF"
          >
            {exportingPDF ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            Salvar PDF
          </button>

          {isEditing && (
            <button
              id="delete-entry"
              className={`action-button delete ${confirmDelete ? 'confirm' : ''}`}
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 size={16} />
              {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
            </button>
          )}

          <button
            id="save-entry"
            className="action-button save"
            onClick={handleSave}
            disabled={saving || (!content.trim() && !audioUrl)}
          >
            {saving ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Save size={16} />
            )}
            Salvar
          </button>
        </div>
      </div>
      </div>

      {/* Stationery Generator Modal — rendered outside the form for correct z-index */}
      {showGenModal && (
        <div className="gen-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowGenModal(false)}>
          <div className="gen-modal animate-slide-up">
            <div className="gen-modal-header">
              <h3>
                {genModalType === 'free' ? <Zap size={18} /> : <Sparkles size={18} />}
                {genModalType === 'free' ? 'Gerar papel grátis' : 'Gerar papel com IA'}
              </h3>
              <button className="icon-button" onClick={() => setShowGenModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="gen-modal-body">
              <p className="gen-modal-hint">
                Descreva o tema do papel. Ex: <em>"borboletas douradas"</em>, <em>"jardim japonês"</em>, <em>"galáxia pastel"</em>
              </p>

              {genModalType === 'free' && (
                <div className="gen-engine-selector">
                  <button 
                    className={`engine-btn ${genEngine === 'flux' ? 'active' : ''}`}
                    onClick={() => setGenEngine('flux')}
                  >
                    Flux (Qualidade)
                  </button>
                  <button 
                    className={`engine-btn ${genEngine === 'sdxl' ? 'active' : ''}`}
                    onClick={() => setGenEngine('sdxl')}
                  >
                    SDXL (Mais fiel)
                  </button>
                </div>
              )}

              <div className="gen-modal-input-row">
                <input
                  id="gen-theme-input"
                  type="text"
                  placeholder="Descreva o tema do papel..."
                  value={genTheme}
                  onChange={(e) => setGenTheme(e.target.value)}
                  className="gen-modal-input"
                  onKeyDown={(e) => e.key === 'Enter' && !genGenerating && handleGenerate()}
                  autoFocus
                />
                <button
                  className="gen-modal-btn generate"
                  onClick={handleGenerate}
                  disabled={genGenerating}
                  title="Gerar"
                >
                  {genGenerating ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
                </button>
              </div>

              {/* Preview area */}
              <div className="gen-modal-preview">
                {genGenerating && (
                  <div className="gen-modal-loading">
                    <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
                    <p>Gerando papel{genModalType === 'ai' ? ' com IA' : ''}…</p>
                  </div>
                )}
                {!genGenerating && !genPreviewUrl && (
                  <div className="gen-modal-placeholder">
                    <ImageIcon size={40} style={{ opacity: 0.25 }} />
                    <p>O papel gerado aparecerá aqui</p>
                  </div>
                )}
                {!genGenerating && genPreviewUrl && (
                  <img
                    src={genPreviewUrl}
                    alt="Preview do papel"
                    className="gen-modal-img"
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="gen-modal-footer">
              <button
                className="gen-modal-btn discard"
                onClick={() => setShowGenModal(false)}
              >
                Cancelar
              </button>
              {genPreviewUrl && (
                <button
                  className="gen-modal-btn regenerate"
                  onClick={handleGenerate}
                  disabled={genGenerating}
                >
                  <RefreshCw size={15} />
                  Gerar outro
                </button>
              )}
              <button
                className="gen-modal-btn save-paper"
                onClick={handleSaveStationery}
                disabled={!genPreviewUrl || genSaving}
              >
                {genSaving ? <Loader2 size={15} className="spin" /> : <CheckCircle size={15} />}
                Usar este papel
              </button>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
}
