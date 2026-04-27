import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DateNavigator from './DateNavigator';
import EntryList from './EntryList';
import EntryForm from './EntryForm';
import ThemeSelector from './ThemeSelector';
import ButterflyBackground from './ButterflyBackground';
import { Plus, Palette, LogOut, BookOpen, Sparkles } from 'lucide-react';

export default function DiaryHome() {
  const { user, signOut, isDemo } = useAuth();
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showThemes, setShowThemes] = useState(false);

  function handleNewEntry() {
    setEditingEntry(null);
    setShowEntryForm(true);
  }

  function handleEditEntry(entry) {
    setEditingEntry(entry);
    setShowEntryForm(true);
  }

  function handleCloseForm() {
    setShowEntryForm(false);
    setEditingEntry(null);
  }

  return (
    <div className="diary-home">
      {/* Magical Background */}
      <ButterflyBackground paused={showEntryForm || showThemes} />

      {/* Notebook lines background */}
      <div className="notebook-lines"></div>

      {/* Top Bar */}
      <header className="app-header">
        <div className="header-left">
          <BookOpen size={22} strokeWidth={1.5} />
          <h1 className="app-title">Bia Diário</h1>
          {isDemo && <span className="demo-badge">Demo</span>}
        </div>
        <div className="header-right">
          <button
            id="theme-button"
            className="icon-button header-icon"
            onClick={() => setShowThemes(true)}
            aria-label="Temas"
          >
            <Palette size={20} />
          </button>
          <button
            id="logout-button"
            className="icon-button header-icon"
            onClick={signOut}
            aria-label="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Date Navigator */}
      <DateNavigator />

      {/* Entry List */}
      <main className="diary-content">
        <EntryList onEditEntry={handleEditEntry} />
      </main>

      {/* FAB - Floating Action Button */}
      <button
        id="fab-new-entry"
        className="fab"
        onClick={handleNewEntry}
        aria-label="Novo registro"
      >
        <Plus size={28} strokeWidth={2.5} />
        <span className="fab-sparkle">
          <Sparkles size={12} />
        </span>
      </button>

      {/* Entry Form Modal */}
      {showEntryForm && (
        <EntryForm entry={editingEntry} onClose={handleCloseForm} />
      )}

      {/* Theme Selector Modal */}
      {showThemes && <ThemeSelector onClose={() => setShowThemes(false)} />}
    </div>
  );
}
