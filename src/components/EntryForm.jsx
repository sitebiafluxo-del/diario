import { useState, useEffect, useRef } from 'react';
import { useDiary } from '../contexts/DiaryContext';
import { nowInBrazil, getDateString, getTimeString, toUTC } from '../lib/dateUtils';
import { transcribeAudio } from '../lib/whisper';
import MoodSelector from './MoodSelector';
import AudioRecorderComponent from './AudioRecorderComponent';
import AudioPlayer from './AudioPlayer';
import { X, Save, Trash2, Languages, Loader2, Sparkles, Image as ImageIcon, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
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
  const [generatingAI, setGeneratingAI] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [uploadingStationery, setUploadingStationery] = useState(false);

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
      const result = await transcribeAudio(recording.blob);
      if (result.text) {
        setContent((prev) => (prev ? prev + '\n\n' : '') + result.text);
      }
      if (result.note) {
        console.info(result.note);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
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
              onClick={() => {
                const prompt = `Watercolor stationery paper background, 9:16 aspect ratio.

DO NOT DRAW ANY HORIZONTAL LINES — the app draws its own lines via CSS.

LEFT EDGE: Draw 2-3 delicate decorative VERTICAL lines (like a classic notebook margin). Can be watercolor style, with tiny floral details or vines along them.

LAYOUT:
- Top area (first 20%): Watercolor floral decorations allowed.
- Right edge: Light watercolor floral decorations allowed.  
- Bottom area (last 15%): Watercolor floral decorations allowed.
- Center area: Must be COMPLETELY CLEAN cream/white paper texture.

STYLE: Delicate watercolor, pastel colors, scrapbook/stationery aesthetic.
Theme: Choose from Floral, Butterflies, Garden, Stars, Vintage.
High quality, soft and dreamy. No text, no horizontal lines.`;
                console.log("Prompt para IA:", prompt);
                setGeneratingAI(true);
                setTimeout(() => setGeneratingAI(false), 2000);
              }}
              title="Gerar Papel Técnico com IA"
            >
              {generatingAI ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
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

        {/* Content */}
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
  );
}
