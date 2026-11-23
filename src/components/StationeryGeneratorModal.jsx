import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Upload, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import {
  POSITION_OPTIONS,
  COLOR_MODES,
  MONO_PALETTES,
  LINE_OPTIONS,
  analyzeImageForStationery,
  generateStationeryPaper
} from '../lib/geminiImagen';
import { drawWritingLines } from '../lib/writingLines';

const QUICK_THEMES = [
  '🌸 Rosas vintage',
  '🦋 Borboletas delicadas',
  '🌿 Jardim botânico',
  '🐱 Gatinhos fofos',
  '✨ Céu estrelado',
  '☕ Café e livros',
  '🌊 Conchas do mar',
  '🍓 Moranguinhos'
];

export default function StationeryGeneratorModal({ onClose, onSelectStationery }) {
  const [theme, setTheme] = useState('');
  const [position, setPosition] = useState('frame'); // 'frame' | 'top' | 'bottom' | 'sides' | 'all'
  const [colorMode, setColorMode] = useState('color'); // 'color' | 'mono'
  const [monoColor, setMonoColor] = useState('rosa');
  const [lineStyle, setLineStyle] = useState('dotted'); // 'dotted' | 'solid' | 'none'

  // Imagem de referência enviada pelo usuário
  const [refImagePreview, setRefImagePreview] = useState(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analyzedInfo, setAnalyzedInfo] = useState(null);

  // Geração e Preview
  const [generating, setGenerating] = useState(false);
  const [rawBlob, setRawBlob] = useState(null);        // imagem original da IA (sem fade)
  const [previewBlob, setPreviewBlob] = useState(null); // imagem com fade aplicado (é a que será salva)
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fadeScale, setFadeScale] = useState(0.55);
  const FADE_OPACITY = 0.92;

  const fileInputRef = useRef(null);
  const fadeJobRef = useRef(0);

  // Trocar o tipo de linha atualiza o papel na hora, sem gerar de novo
  useEffect(() => {
    if (rawBlob) showFaded(rawBlob, fadeScale, lineStyle).catch(() => {});
  }, [lineStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Libera a object URL anterior sempre que o preview muda / ao desmontar
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!refImagePreview) return;
    return () => URL.revokeObjectURL(refImagePreview);
  }, [refImagePreview]);

  // Manipular upload de foto de referência
  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reenviar a mesma foto
    if (!file) return;

    setRefImagePreview(URL.createObjectURL(file));

    setAnalyzingImage(true);
    try {
      const info = await analyzeImageForStationery(file);
      setAnalyzedInfo(info);
      if (info?.portugueseSummary && !theme) {
        setTheme(info.portugueseSummary);
      }
    } catch (err) {
      console.warn('Erro ao analisar foto:', err);
    } finally {
      setAnalyzingImage(false);
    }
  }

  function removeRefImage() {
    setRefImagePreview(null);
    setAnalyzedInfo(null);
  }

  // Aplica o fade central suave para escrita
  function applyFadeToBlob(blob, scale, opacity, lines, pos) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const srcUrl = URL.createObjectURL(blob);
      img.onerror = () => {
        URL.revokeObjectURL(srcUrl);
        reject(new Error('A IA retornou um arquivo que não é uma imagem válida'));
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const r = Math.max(canvas.width, canvas.height) * scale;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(255,255,255,${opacity})`);
        grad.addColorStop(0.35, `rgba(255,255,255,${(opacity * 0.88).toFixed(2)})`);
        grad.addColorStop(0.65, `rgba(255,255,255,${(opacity * 0.5).toFixed(2)})`);
        grad.addColorStop(0.85, `rgba(255,255,255,${(opacity * 0.15).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Linhas de escrita desenhadas pelo app (retas e alinhadas com o PDF)
        drawWritingLines(ctx, canvas.width, canvas.height, lines, pos);

        URL.revokeObjectURL(srcUrl);
        canvas.toBlob(
          (out) => (out ? resolve(out) : reject(new Error('Falha ao processar a imagem'))),
          'image/jpeg',
          0.93
        );
      };
      img.src = srcUrl;
    });
  }

  async function showFaded(sourceBlob, scale, lines = lineStyle) {
    const job = ++fadeJobRef.current;
    const faded = await applyFadeToBlob(sourceBlob, scale, FADE_OPACITY, lines, position);
    if (job !== fadeJobRef.current) return; // ignora resultados de movimentos antigos do slider
    setPreviewBlob(faded);
    setPreviewUrl(URL.createObjectURL(faded));
  }

  async function handleGenerate(fresh = false) {
    setGenerating(true);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setRawBlob(null);

    try {
      const result = await generateStationeryPaper({
        theme,
        position,
        colorMode,
        monoColor,
        lineStyle,
        analyzedInfo,
        fresh
      });

      setRawBlob(result.blob);
      await showFaded(result.blob, fadeScale);
    } catch (err) {
      console.error('Erro ao gerar papel:', err);
      if (err.status === 422) {
        alert(err.message);
      } else if (err.code === 'RATE_LIMIT') {
        alert(`⏳ O criador gratuito precisa de uma pausa entre um papel e outro.\n\n${err.message}`);
      } else {
        alert('Não foi possível gerar o papel no momento. Verifique sua internet e tente novamente!');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavePaper() {
    if (!previewBlob) return;
    setSaving(true);
    try {
      const file = new File([previewBlob], `papel-carta-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const paperTitle = theme.trim() || analyzedInfo?.portugueseSummary || 'Novo Papel de Carta';
      await onSelectStationery({
        file,
        title: paperTitle,
        options: { position, colorMode, monoColor, lineStyle }
      });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar papel:', err);
      alert('Erro ao salvar papel: ' + (err.message || 'tente novamente.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gen-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gen-modal stationery-easy-modal animate-slide-up">
        {/* Header */}
        <div className="gen-modal-header">
          <div className="gen-title-box">
            <span className="gen-icon-badge">✨</span>
            <div>
              <h3>Criador de Papel de Carta</h3>
              <p className="gen-subtitle">
                <span className="ai-connected-dot">🟢</span> IA pronta para criar
              </p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="gen-modal-body">
          {/* PASSO 1: TEMA (Texto ou Foto) */}
          <section className="gen-section">
            <label className="gen-section-label">
              <span className="step-num">1</span> Qual o tema do papel?
            </label>

            <div className="gen-theme-input-wrap">
              <input
                type="text"
                placeholder="Ex: Flores cor-de-rosa, borboletas, gatinho..."
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="gen-modal-input"
                onKeyDown={(e) => e.key === 'Enter' && !generating && handleGenerate(false)}
              />
              <button
                type="button"
                className="upload-ref-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Enviar foto de inspiração"
              >
                <Upload size={16} />
                <span>Foto</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </div>

            {/* Chips de temas rápidos */}
            <div className="quick-theme-chips">
              {QUICK_THEMES.map((qt) => (
                <button
                  key={qt}
                  type="button"
                  className="theme-chip"
                  onClick={() => setTheme(qt.replace(/^[^\w\s]+/, '').trim())}
                >
                  {qt}
                </button>
              ))}
            </div>

            {/* Preview da foto de referência enviada */}
            {refImagePreview && (
              <div className="ref-image-card animate-fade-in">
                <img src={refImagePreview} alt="Inspiração" className="ref-thumb" />
                <div className="ref-info">
                  <p className="ref-title">Foto de inspiração</p>
                  {analyzingImage ? (
                    <span className="ref-analyzing">
                      <Loader2 size={12} className="spin" /> Analisando com IA...
                    </span>
                  ) : analyzedInfo ? (
                    <span className="ref-detected">✨ {analyzedInfo.portugueseSummary}</span>
                  ) : (
                    <span className="ref-ready">Pronta para uso</span>
                  )}
                </div>
                <button type="button" className="ref-remove-btn" onClick={removeRefImage}>
                  <X size={14} />
                </button>
              </div>
            )}
          </section>

          {/* PASSO 2: ONDE VÃO OS DESENHOS? */}
          <section className="gen-section">
            <label className="gen-section-label">
              <span className="step-num">2</span> Onde colocar os desenhos?
            </label>
            <div className="position-grid">
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`choice-card ${position === opt.id ? 'active' : ''}`}
                  onClick={() => setPosition(opt.id)}
                >
                  <div className={`layout-mini-preview pos-${opt.id}`}>
                    <div className="mini-paper">
                      <div className="mini-decor-zone"></div>
                    </div>
                  </div>
                  <span className="choice-name">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* PASSO 3: CORES (Colorido vs Uma Cor) */}
          <section className="gen-section">
            <label className="gen-section-label">
              <span className="step-num">3</span> Cores dos desenhos
            </label>
            <div className="color-mode-row">
              {COLOR_MODES.map((cm) => (
                <button
                  key={cm.id}
                  type="button"
                  className={`color-mode-btn ${colorMode === cm.id ? 'active' : ''}`}
                  onClick={() => setColorMode(cm.id)}
                >
                  <span className="cm-emoji">{cm.emoji}</span>
                  <div>
                    <strong>{cm.label}</strong>
                    <small>{cm.desc}</small>
                  </div>
                </button>
              ))}
            </div>

            {colorMode === 'mono' && (
              <div className="mono-palette-selector animate-fade-in">
                <span className="sublabel">Escolha a cor:</span>
                <div className="palette-dots">
                  {MONO_PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`palette-dot-btn ${monoColor === p.id ? 'active' : ''}`}
                      onClick={() => setMonoColor(p.id)}
                      title={p.label}
                    >
                      <span className="color-swatch" style={{ backgroundColor: p.hex }}></span>
                      <span className="dot-name">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* PASSO 4: LINHAS DE ESCRITA */}
          <section className="gen-section">
            <label className="gen-section-label">
              <span className="step-num">4</span> Linhas para escrever
            </label>
            <div className="lines-row">
              {LINE_OPTIONS.map((lo) => (
                <button
                  key={lo.id}
                  type="button"
                  className={`line-card ${lineStyle === lo.id ? 'active' : ''}`}
                  onClick={() => setLineStyle(lo.id)}
                >
                  <div className={`line-sample-box sample-${lo.id}`}>
                    <div className="sample-line"></div>
                    <div className="sample-line"></div>
                    <div className="sample-line"></div>
                  </div>
                  <span className="choice-name">{lo.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* BOTÃO GERAR */}
          {!previewUrl && (
            <button
              type="button"
              className="gen-main-btn"
              onClick={() => handleGenerate(false)}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 size={20} className="spin" />
                  <span>Criando seu papel com IA...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>Criar Papel de Carta</span>
                </>
              )}
            </button>
          )}


          {/* PREVIEW DO PAPEL GERADO */}
          {generating && (
            <div className="gen-loading-box animate-fade-in">
              <Loader2 size={36} className="spin" style={{ color: 'var(--primary)' }} />
              <p>Pintando as aquarelas e organizando o papel A5...</p>
              <small>Pronto para imprimir 2 cartas por folha A4</small>
            </div>
          )}

          {previewUrl && !generating && (
            <div className="preview-container animate-fade-in">
              <div className="preview-badge">✨ Papel Gerado</div>
              <div className="preview-paper-frame">
                <img src={previewUrl} alt="Papel gerado" className="paper-img" />
              </div>

              {/* Controles de clareamento do centro para escrita */}
              <div className="fade-adjuster">
                <label>
                  <span>Clarear centro para escrever:</span>
                  <input
                    type="range"
                    min="0.3"
                    max="0.8"
                    step="0.05"
                    value={fadeScale}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setFadeScale(v);
                      // Sempre parte da imagem ORIGINAL — senão o fade acumula a cada movimento
                      if (rawBlob) {
                        showFaded(rawBlob, v).catch((err) => console.warn('Erro ao clarear:', err));
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {previewUrl && !generating && (
          <div className="gen-modal-footer">
            <button type="button" className="gen-modal-btn discard" onClick={() => { setPreviewUrl(null); setPreviewBlob(null); setRawBlob(null); }}>
              Voltar
            </button>
            <button type="button" className="gen-modal-btn regenerate" onClick={() => handleGenerate(true)}>
              <RefreshCw size={15} />
              Tentar Outro
            </button>
            <button
              type="button"
              className="gen-modal-btn save-paper"
              onClick={handleSavePaper}
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
              Salvar Papel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
