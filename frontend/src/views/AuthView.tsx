import { useState } from 'react';
import { checkPassword, passwordError, allChecksPassed } from '../lib/passwordPolicy';
import { emailError } from '../lib/emailValidation';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';

interface Props {
  mode:           'login' | 'register';
  onLogin:        (email: string, pw: string) => Promise<void>;
  onRegister:     (name: string, email: string, pw: string) => Promise<void>;
  onBack:         () => void;
  onSwitchMode:   (m: 'login' | 'register') => void;
}

export function AuthView({ mode, onLogin, onRegister, onBack, onSwitchMode }: Props) {
  const [isLogin,    setIsLogin]    = useState(mode === 'login');
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [pw,         setPw]         = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [err,        setErr]        = useState('');
  const [loading,    setLoading]    = useState(false);

  const toggle = (login: boolean) => {
    setIsLogin(login);
    setErr('');
    onSwitchMode(login ? 'login' : 'register');
  };

  const pwChecks    = checkPassword(pw);
  const confirmOk   = confirmPw.length > 0 && confirmPw === pw;
  const confirmBad  = confirmPw.length > 0 && confirmPw !== pw;
  // Todos los requisitos son obligatorios y bloqueantes: sin esto no se
  // puede ni pulsar "Crear cuenta".
  const canRegister = allChecksPassed(pwChecks) && confirmOk;

  const handleSubmit = async () => {
    setErr('');
    if (!email || !pw) { setErr('Completa todos los campos.'); return; }
    if (!isLogin) {
      if (!name) { setErr('Ingresa tu nombre completo.'); return; }
      // Formato de email antes de llamar a Firebase (mejor mensaje que el genérico).
      const eErr = emailError(email);
      if (eErr) { setErr(eErr); return; }
      // Validación de cliente — más estricta que el mínimo de 6 de Firebase
      // Auth. Debe correr ANTES de llamar a Firebase.
      const pwErr = passwordError(pw);
      if (pwErr) { setErr(pwErr); return; }
      if (pw !== confirmPw) { setErr('Las contraseñas no coinciden.'); return; }
    }
    setLoading(true);
    try {
      if (isLogin) await onLogin(email, pw);
      else          await onRegister(name, email, pw);
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="anim-fade-up" style={{ height:'100vh', overflowY:'auto', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--bdr)' }}>
        <button className="btn-sm" onClick={onBack}>← Volver al inicio</button>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ width:'100%', maxWidth:370 }}>
          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:26 }}>
            <div style={{ width:50,height:50,borderRadius:13,margin:'0 auto 10px',background:'var(--brand-grad)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'var(--on-pri)',fontWeight:900 }}>S</div>
            <div style={{ fontWeight:800, fontSize:19 }}>SeñasUTSCMX</div>
            <div style={{ color:'var(--t3)', fontSize:13, marginTop:4 }}>
              {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta gratuita'}
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display:'flex',background:'var(--card)',border:'1px solid var(--bdr)',borderRadius:11,padding:3,marginBottom:20 }}>
            {['Iniciar sesión','Crear cuenta'].map((t,i) => (
              <button key={t} onClick={()=>toggle(i===0)} style={{ flex:1,padding:'8px',border:'none',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',transition:'.18s',background:(i===0)===isLogin?'var(--brand-grad)':'transparent',color:(i===0)===isLogin?'var(--on-pri)':'var(--t3)' }}>
                {t}
              </button>
            ))}
          </div>
          {/* Fields */}
          <div style={{ display:'flex',flexDirection:'column',gap:13 }}>
            {!isLogin && (
              <div>
                <div style={{ fontSize:12,color:'var(--t3)',marginBottom:5,fontWeight:500 }}>Nombre completo</div>
                <input className="input-field" placeholder="Tu nombre" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
              </div>
            )}
            <div>
              <div style={{ fontSize:12,color:'var(--t3)',marginBottom:5,fontWeight:500 }}>Correo electrónico</div>
              <input className="input-field" type="email" placeholder="tu@utsc.edu.mx" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
            </div>
            <div>
              <div style={{ fontSize:12,color:'var(--t3)',marginBottom:5,fontWeight:500 }}>Contraseña</div>
              <div style={{ position:'relative' }}>
                <input className="input-field" type={showPw?'text':'password'}
                  placeholder={isLogin?'Tu contraseña':'Crea una contraseña segura'}
                  value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} style={{ paddingRight:40 }}/>
                <button onClick={()=>setShowPw(v=>!v)} style={{ position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:15,padding:2 }}>
                  {showPw?'🙈':'👁️'}
                </button>
              </div>

              {/* Medidor de fortaleza + requisitos — solo en registro */}
              {!isLogin && <PasswordStrengthMeter pw={pw} />}
            </div>

            {!isLogin && (
              <div>
                <div style={{ fontSize:12,color:'var(--t3)',marginBottom:5,fontWeight:500 }}>Confirmar contraseña</div>
                <div style={{ position:'relative' }}>
                  <input className="input-field" type={showConfirmPw?'text':'password'} placeholder="Repite tu contraseña"
                    value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
                    style={{ paddingRight:40, borderColor:confirmBad?'var(--red)':undefined }}/>
                  <button onClick={()=>setShowConfirmPw(v=>!v)} style={{ position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:15,padding:2 }}>
                    {showConfirmPw?'🙈':'👁️'}
                  </button>
                </div>
                {confirmBad && (
                  <div style={{ fontSize:11.5,color:'var(--red)',marginTop:5 }}>❌ Las contraseñas no coinciden</div>
                )}
                {confirmOk && (
                  <div style={{ fontSize:11.5,color:'var(--grn)',marginTop:5 }}>✅ Las contraseñas coinciden</div>
                )}
              </div>
            )}

            {err && (
              <div style={{ fontSize:12,color:'var(--red)',background:'var(--red-d)',borderRadius:8,padding:'8px 12px' }}>{err}</div>
            )}
            <button className="btn-primary" style={{ width:'100%',justifyContent:'center',padding:'12px',fontSize:14,marginTop:2 }}
              onClick={handleSubmit} disabled={loading || (!isLogin && !canRegister)}>
              {loading ? 'Procesando…' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
            {/* Recuperar contraseña — DESHABILITADO por ahora (hoy solo era un
                alert placeholder). Se retomará con el flujo de recuperación de
                Firebase (auth.sendPasswordResetEmail), que ya viene resuelto en
                el SDK; faltaría la UI para pedir el correo y mostrar el aviso de
                "revisa tu bandeja". No se renderiza para no dejar un botón inútil.
            {isLogin && (
              <div style={{ textAlign:'center' }}>
                <button style={{ background:'none',border:'none',color:'var(--t3)',fontSize:12,cursor:'pointer',textDecoration:'underline',fontFamily:'inherit' }}
                  onClick={()=>alert('Funcionalidad de reset: implementar onResetPassword() con Firebase')}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}
            */}
          </div>
        </div>
      </div>
    </div>
  );
}
