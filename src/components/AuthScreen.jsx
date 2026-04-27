import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Mail, Lock, LogIn, UserPlus, Sparkles } from 'lucide-react';

export default function AuthScreen() {
  const { signIn, signUp, isDemo } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (authError) {
        setError(authError.message || 'Erro na autenticação');
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    await signIn('demo@bia.app', 'demo');
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg-decoration">
        <div className="auth-circle auth-circle-1"></div>
        <div className="auth-circle auth-circle-2"></div>
        <div className="auth-circle auth-circle-3"></div>
      </div>

      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <BookOpen size={40} strokeWidth={1.5} />
          </div>
          <h1 className="auth-title">Bia Diário</h1>
          <p className="auth-subtitle">
            Seu diário inteligente pessoal
            <Sparkles size={16} className="sparkle-icon" />
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <Mail size={18} className="auth-input-icon" />
            <input
              id="auth-email"
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-input-group">
            <Lock size={18} className="auth-input-icon" />
            <input
              id="auth-password"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            id="auth-submit"
            type="submit"
            className="auth-button auth-button-primary"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-spinner"></span>
            ) : isLogin ? (
              <>
                <LogIn size={18} />
                Entrar
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Criar conta
              </>
            )}
          </button>

          <button
            type="button"
            className="auth-toggle"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin
              ? 'Não tem conta? Criar agora'
              : 'Já tem conta? Fazer login'}
          </button>

          {isDemo && (
            <button
              type="button"
              className="auth-button auth-button-demo"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              <Sparkles size={16} />
              Entrar no modo demo
            </button>
          )}
        </form>

        <div className="auth-footer">
          <p>✨ Diário com voz, IA e emoção</p>
        </div>
      </div>
    </div>
  );
}
