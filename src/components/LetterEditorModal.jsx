import { useState, useRef, useEffect } from 'react';
import { X, Printer, Trash2, Edit3, Loader2 } from 'lucide-react';
import { exportLetterToA4PDF } from '../lib/pdfLetterExport';
import { cssImageUrl } from '../lib/safeUrl';

const AUTOSAVE_DELAY_MS = 800;

export default function LetterEditorModal({ paper, onClose, onUpdatePaper, onDeletePaper }) {
  const [content, setContent] = useState(paper?.content || '');
  const [title, setTitle] = useState(paper?.title || 'Meu Papel de Carta');
  const [exporting, setExporting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Autosave com debounce: evita 1 requisição ao Supabase por tecla digitada
  const saveTimerRef = useRef(null);
  const pendingRef = useRef(null);
  const onUpdateRef = useRef(onUpdatePaper);
  useEffect(() => { onUpdateRef.current = onUpdatePaper; }, [onUpdatePaper]);

  function flushSave() {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (pendingRef.current) {
      const updates = pendingRef.current;
      pendingRef.current = null;
      onUpdateRef.current(paper.id, updates);
    }
  }

  function scheduleSave(updates) {
    pendingRef.current = updates;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, AUTOSAVE_DELAY_MS);
  }

  // Garante que nada digitado se perca ao desmontar o modal
  useEffect(() => () => flushSave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    flushSave();
    onClose();
  }

  async function handlePrintPDF() {
    setExporting(true);
    try {
      await exportLetterToA4PDF({
        paper: { ...paper, title },
        customText: content
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  function handleSaveTitle() {
    setIsEditingTitle(false);
    const cleanTitle = title.trim() || 'Meu Papel de Carta';
    if (cleanTitle !== title) setTitle(cleanTitle);
    pendingRef.current = { content, title: cleanTitle };
    flushSave();
  }

  async function handleDelete() {
    if (confirm('Tem certeza que deseja apagar este papel de carta?')) {
      // Descarta gravação pendente para não "ressuscitar" o papel excluído
      clearTimeout(saveTimerRef.current);
      pendingRef.current = null;
      await onDeletePaper(paper.id);
      onClose();
    }
  }

  return (
    <div className="letter-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="letter-modal animate-slide-up">
        {/* Topo do Modal */}
        <div className="letter-modal-header">
          <div className="header-title-area">
            {isEditingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                autoFocus
                className="edit-title-input"
              />
            ) : (
              <div className="title-display" onClick={() => setIsEditingTitle(true)} title="Clique para renomear">
                <h2>{title}</h2>
                <Edit3 size={15} className="title-edit-icon" />
              </div>
            )}
            <span className="subtitle-hint">Escreva no papel ou imprima em branco para escrever à mão</span>
          </div>

          <button type="button" className="icon-button close-btn" onClick={handleClose}>
            <X size={22} />
          </button>
        </div>

        {/* Área do Papel com Textarea sobreposto */}
        <div className="letter-modal-body">
          <div
            className="letter-paper-canvas"
            style={{ backgroundImage: cssImageUrl(paper.imageUrl) }}
          >
            <textarea
              className="letter-textarea"
              placeholder="Digite sua mensagem aqui se quiser imprimir a carta já escrita... ou deixe em branco para escrever à caneta! ✍️"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                scheduleSave({ content: e.target.value, title });
              }}
            />
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="letter-modal-footer">
          <button
            type="button"
            className="action-btn delete-btn"
            onClick={handleDelete}
            title="Excluir este papel"
          >
            <Trash2 size={18} />
            <span>Excluir</span>
          </button>

          <div className="footer-right-actions">
            <button
              type="button"
              className="action-btn print-pdf-btn"
              onClick={handlePrintPDF}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Preparando folha A4...</span>
                </>
              ) : (
                <>
                  <Printer size={18} />
                  <span>Imprimir PDF (2 por folha A4)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
