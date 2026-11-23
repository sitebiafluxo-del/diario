import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearCloudCaches } from '../lib/paperStore';

const AuthContext = createContext(null);
const LOCAL_USER_KEY = 'bia_diary_user';

function readLocalUser() {
  try {
    const saved = localStorage.getItem(LOCAL_USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Fonte da verdade:
 * - Supabase configurado → a sessão do Supabase (persistida pelo próprio SDK).
 *   Nenhum usuário "falso" é criado: se o login falhar, o erro é devolvido.
 * - Supabase não configurado → modo demo/offline com usuário salvo no localStorage.
 */
export function AuthProvider({ children }) {
  const cloud = isSupabaseConfigured();
  const [user, setUser] = useState(() => (cloud ? null : readLocalUser()));
  const [loading, setLoading] = useState(cloud);

  useEffect(() => {
    if (!cloud) return;

    // Limpa usuários "fantasmas" criados por versões anteriores (ids não-UUID)
    localStorage.removeItem(LOCAL_USER_KEY);

    let active = true;
    const timeoutId = setTimeout(() => active && setLoading(false), 4000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.warn('Falha ao obter sessão do Supabase:', err.message);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Também trata SIGNED_OUT / sessão expirada (session === null)
      if (event === 'SIGNED_OUT') clearCloudCaches();
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, [cloud]);

  const signInWithGoogle = useCallback(async () => {
    if (!cloud) {
      throw new Error('Login com Google indisponível: Supabase não está configurado.');
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
    // O navegador será redirecionado para o Google; o usuário chega via onAuthStateChange
    return { data, error: null };
  }, [cloud]);

  const signOut = useCallback(async () => {
    if (cloud) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Erro ao sair do Supabase:', err.message);
      }
    }
    localStorage.removeItem(LOCAL_USER_KEY);
    clearCloudCaches(); // não deixa cartas da conta legíveis no aparelho
    setUser(null);
  }, [cloud]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signOut,
        isDemo: !cloud,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
