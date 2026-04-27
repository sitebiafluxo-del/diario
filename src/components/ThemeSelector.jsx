import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_THEMES } from '../lib/geminiThemes';
import { Palette, Sparkles, Loader2, X, Wand2 } from 'lucide-react';

export default function ThemeSelector({ onClose }) {
  const { currentTheme, themes, selectTheme, generateAITheme, generating } = useTheme();
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAI, setShowAI] = useState(false);

  async function handleGenerateTheme() {
    if (!aiPrompt.trim()) return;
    const theme = await generateAITheme(aiPrompt);
    if (theme) {
      setAiPrompt('');
      setShowAI(false);
    }
  }

  return (
    <div className="theme-selector-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="theme-selector animate-slide-up">
        <div className="theme-selector-header">
          <h2>
            <Palette size={20} />
            Temas
          </h2>
          <button className="icon-button" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        {/* Theme Grid */}
        <div className="theme-grid">
          {Object.entries(DEFAULT_THEMES).map(([key, theme]) => (
            <button
              key={key}
              className={`theme-card ${currentTheme.name === theme.name ? 'active' : ''}`}
              onClick={() => selectTheme(key)}
              style={{
                background: theme.background,
                backgroundSize: theme.isImage ? 'cover' : 'auto',
                backgroundPosition: 'center',
              }}
            >
              <div className="theme-card-overlay" style={{
                backgroundColor: theme.isImage ? 'rgba(255,255,255,0.4)' : 'transparent',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 8px',
                borderRadius: 'inherit'
              }}>
                <span className="theme-card-emoji">{theme.emoji}</span>
                <span className="theme-card-name" style={{ 
                  color: theme.textColor,
                  textShadow: theme.isImage ? '0 1px 4px rgba(255,255,255,0.8)' : 'none'
                }}>
                  {theme.name}
                </span>
                <div className="theme-card-colors">
                  <span
                    className="theme-color-dot"
                    style={{ background: theme.primaryColor }}
                  />
                  <span
                    className="theme-color-dot"
                    style={{ background: theme.secondaryColor }}
                  />
                  <span
                    className="theme-color-dot"
                    style={{ background: theme.accentColor }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* AI Theme Generator */}
        <div className="ai-theme-section">
          <button
            className="ai-theme-toggle"
            onClick={() => setShowAI(!showAI)}
          >
            <Sparkles size={16} />
            Gerar tema com IA
            <Wand2 size={14} />
          </button>

          {showAI && (
            <div className="ai-theme-form animate-fade-in">
              <p className="ai-theme-hint">
                Descreva o tema que você quer. Ex: "pôr do sol na praia", "floresta encantada", "céu estrelado"
              </p>
              <div className="ai-theme-input-row">
                <input
                  type="text"
                  placeholder="Descreva seu tema..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="ai-theme-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateTheme()}
                />
                <button
                  className="ai-theme-generate"
                  onClick={handleGenerateTheme}
                  disabled={generating || !aiPrompt.trim()}
                >
                  {generating ? (
                    <Loader2 size={18} className="spin" />
                  ) : (
                    <Wand2 size={18} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
