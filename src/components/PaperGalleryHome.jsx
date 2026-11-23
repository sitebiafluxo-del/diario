import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Printer, Trash2, Edit3, Upload, LogOut, Cloud, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getSavedPapersAsync,
  addPaperAsync,
  updatePaperAsync,
  deletePaperAsync,
  uploadPaperImage
} from '../lib/paperStore';
import { exportLetterToA4PDF } from '../lib/pdfLetterExport';
import { cssImageUrl } from '../lib/safeUrl';
import StationeryGeneratorModal from './StationeryGeneratorModal';
import LetterEditorModal from './LetterEditorModal';

export default function PaperGalleryHome() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [papers, setPapers] = useState([]);
  const [loadedForUser, setLoadedForUser] = useState(undefined);
  const [showCreator, setShowCreator] = useState(false);
  const [editingPaper, setEditingPaper] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const uploadInputRef = useRef(null);
  const userId = user?.id;

  // Depende só do id: o objeto `user` muda a cada renovação de token do Supabase
  const loading = loadedForUser !== (userId ?? null);
  useEffect(() => {
    let cancelled = false;
    getSavedPapersAsync(userId)
      .then((list) => { if (!cancelled) setPapers(list); })
      .finally(() => { if (!cancelled) setLoadedForUser(userId ?? null); });
    return () => { cancelled = true; };
  }, [userId]);

  const handleRefreshPapers = useCallback(async () => {
    const list = await getSavedPapersAsync(userId);
    setPapers(list);
  }, [userId]);

  // Login com Google
  async function handleGoogleLogin() {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      alert('Erro ao conectar com Google: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Cria papel a partir do gerador de IA
  async function handlePaperCreated({ file, title, options }) {
    // Faz upload para o storage na nuvem ou converte para dataUrl local
    const imageUrl = await uploadPaperImage(file, user?.id);
    const newPaper = await addPaperAsync({
      title,
      imageUrl,
      options
    }, user?.id);

    await handleRefreshPapers();
    setEditingPaper(newPaper);
  }

  // Upload direto de imagem do computador/celular
  async function handleDirectUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await uploadPaperImage(file, user?.id);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const newPaper = await addPaperAsync({
        title: cleanName || 'Papel Personalizado',
        imageUrl,
        options: { position: 'frame', colorMode: 'color', lineStyle: 'dotted' }
      }, user?.id);

      await handleRefreshPapers();
      setEditingPaper(newPaper);
    } catch (err) {
      console.error('Erro no upload de imagem:', err);
      alert('Não foi possível salvar a imagem: ' + err.message);
    } finally {
      e.target.value = '';
    }
  }

  // Imprimir PDF diretamente da galeria
  async function handleDirectPrint(paper, e) {
    e.stopPropagation();
    setPrintingId(paper.id);
    try {
      await exportLetterToA4PDF({ paper });
    } catch (err) {
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      setPrintingId(null);
    }
  }

  // Deletar da galeria
  async function handleDeletePaper(id, e) {
    e.stopPropagation();
    if (confirm('Deseja excluir este papel de carta da sua coleção?')) {
      await deletePaperAsync(id, user?.id);
      await handleRefreshPapers();
    }
  }

  // Atualizar papel (atualiza a lista localmente, sem refetch completo da nuvem)
  const handleUpdatePaper = useCallback(async (id, updates) => {
    try {
      await updatePaperAsync(id, updates, userId);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      return;
    }
    setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    // Forma funcional: se o modal já foi fechado (prev === null) NÃO reabre
    setEditingPaper((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
  }, [userId]);

  return (
    <div className="gallery-app-container">
      {/* Topo do Aplicativo */}
      <header className="gallery-header">
        <div className="gallery-brand">
          <span className="brand-icon">💌</span>
          <div>
            <h1 className="brand-title">Papéis de Carta Mágicos</h1>
            <p className="brand-tagline">Crie com IA, escreva com carinho e imprima 2 cartas por folha A4</p>
          </div>
        </div>

        {/* Status de Autenticação / Multi-usuário */}
        <div className="gallery-auth-box">
          {user ? (
            <div className="user-profile-pill">
              <span className="cloud-sync-badge" title="Sincronizado na Nuvem Supabase">
                <Cloud size={14} /> Nuvem Ativa
              </span>
              <span className="user-name">
                {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário'}
              </span>
              <button
                type="button"
                className="icon-button logout-btn"
                onClick={signOut}
                title="Sair da conta"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              title="Entrar com Google para salvar seus papéis na nuvem"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.68-5.17 3.68-9.09z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.37 24 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
              </svg>
              <span>Entrar com Google</span>
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="gallery-main">
        {/* Banner de Ação Principal */}
        <section className="create-hero-banner">
          <div className="hero-content">
            <span className="hero-sparkle-pill">✨ Inteligência Artificial</span>
            <h2 className="hero-title">Crie um papel exclusivo em segundos</h2>
            <p className="hero-desc">
              Escolha onde vão os desenhos, selecione colorido ou monocromático e o tipo de linha ideal para sua carta.
            </p>
            <div className="hero-buttons-row">
              <button
                type="button"
                className="hero-main-btn"
                onClick={() => setShowCreator(true)}
              >
                <Sparkles size={20} />
                <span>Criar Novo Papel com IA</span>
              </button>

              <button
                type="button"
                className="hero-secondary-btn"
                onClick={() => uploadInputRef.current?.click()}
                title="Carregar imagem do seu computador ou celular"
              >
                <Upload size={18} />
                <span>Usar Minha Imagem</span>
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleDirectUpload}
              />
            </div>
          </div>
        </section>

        {/* Seção da Galeria de Papéis */}
        <section className="saved-papers-section">
          <div className="section-header-row">
            <div className="section-title-box">
              <h3>Meus Papéis Salvos</h3>
              <span className="papers-count-badge">{papers.length}</span>
            </div>
            <p className="section-hint">Toque em qualquer papel para escrever ou imprimir</p>
          </div>

          {loading && papers.length === 0 && (
            <div className="gen-loading-box">
              <Loader2 size={28} className="spin" />
              <p>Carregando seus papéis...</p>
            </div>
          )}

          <div className="papers-grid">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="paper-card animate-fade-in"
                onClick={() => setEditingPaper(paper)}
              >
                {/* Visualização da Folha de Carta */}
                <div
                  className="paper-thumbnail"
                  style={{ backgroundImage: cssImageUrl(paper.imageUrl) }}
                >
                  <div className="paper-thumb-hover">
                    <span className="thumb-action-pill">
                      <Edit3 size={14} /> Escrever / Ver
                    </span>
                  </div>
                  {paper.content && (
                    <span className="written-indicator" title="Esta carta possui texto escrito">
                      ✍️ Com texto
                    </span>
                  )}
                </div>

                {/* Informações e Ações do Card */}
                <div className="paper-card-details">
                  <h4 className="paper-card-title">{paper.title}</h4>

                  <div className="card-actions-bar">
                    <button
                      type="button"
                      className="card-quick-print-btn"
                      onClick={(e) => handleDirectPrint(paper, e)}
                      disabled={printingId === paper.id}
                      title="Imprimir direto em PDF (2 por folha A4)"
                    >
                      <Printer size={15} />
                      <span>{printingId === paper.id ? 'Gerando...' : 'PDF A4'}</span>
                    </button>

                    <button
                      type="button"
                      className="card-delete-icon-btn"
                      onClick={(e) => handleDeletePaper(paper.id, e)}
                      title="Excluir da coleção"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Modal do Criador de Papel de Carta */}
      {showCreator && (
        <StationeryGeneratorModal
          onClose={() => setShowCreator(false)}
          onSelectStationery={handlePaperCreated}
        />
      )}

      {/* Modal do Editor de Carta e Impressão */}
      {editingPaper && (
        <LetterEditorModal
          paper={editingPaper}
          onClose={() => setEditingPaper(null)}
          onUpdatePaper={handleUpdatePaper}
          onDeletePaper={async (id) => {
            await deletePaperAsync(id, user?.id);
            await handleRefreshPapers();
          }}
        />
      )}
    </div>
  );
}
