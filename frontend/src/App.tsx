import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LandingView }  from './views/LandingView';
import { AuthView }     from './views/AuthView';
import { AppShell }     from './views/AppShell';

export default function App() {
  const { user, fbUser, loading, login, register, logout } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 36 }}>🤟</div>
        <div style={{ fontSize: 14, color: 'var(--t3)' }}>Cargando SeñasUTSCMX…</div>
      </div>
    );
  }

  if (user && fbUser) {
    return <AppShell user={user} onLogout={logout} />;
  }

  if (!user && authMode) {
    // Check if we're on the auth screen (we use a separate flag)
  }

  return (
    <AuthRouter
      defaultMode={authMode}
      onLogin={login}
      onRegister={register}
      onShowAuth={(m) => setAuthMode(m)}
    />
  );
}

// ─── Sub-router: landing ↔ auth ───────────────────────────────
function AuthRouter({
  defaultMode, onLogin, onRegister, onShowAuth,
}: {
  defaultMode: 'login' | 'register';
  onLogin:    (email: string, pw: string)   => Promise<void>;
  onRegister: (name: string, email: string, pw: string) => Promise<void>;
  onShowAuth: (m: 'login' | 'register') => void;
}) {
  const [phase, setPhase] = useState<'landing' | 'auth'>('landing');
  const [mode,  setMode]  = useState<'login' | 'register'>(defaultMode);

  const goAuth = (m: 'login' | 'register') => { setMode(m); setPhase('auth'); onShowAuth(m); };

  if (phase === 'auth') {
    return (
      <AuthView
        mode={mode}
        onLogin={onLogin}
        onRegister={onRegister}
        onBack={() => setPhase('landing')}
        onSwitchMode={(m) => setMode(m)}
      />
    );
  }
  return <LandingView onAuth={goAuth} />;
}
