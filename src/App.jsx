import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DiaryProvider } from './contexts/DiaryContext';
import AuthScreen from './components/AuthScreen';
import DiaryHome from './components/DiaryHome';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <Loader2 size={40} className="spin" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <DiaryProvider>
      <DiaryHome />
    </DiaryProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
