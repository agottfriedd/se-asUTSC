import { useState } from 'react';
import { SIGNS_ALPHA } from '../data/signs';

interface Props {
  onAuth: (mode: 'login' | 'register') => void;
}

const FEATURES = [
  { c: '#0ED2B8', e: '📖', t: 'Diccionario visual',
    b: '27 letras + frases comunes con ilustraciones interactivas de cada seña en LSM.' },
  { c: '#9D7BF8', e: '🎓', t: 'Lecciones por nivel',
    b: 'Básico, Intermedio y Avanzado. 12 módulos con progreso individual guardado.' },
  { c: '#F5A623', e: '🤖', t: 'IA con cámara',
    b: 'App MAUI + Python/MediaPipe reconoce tu seña en tiempo real con feedback instantáneo.' },
  { c: '#22C97E', e: '🏆', t: 'Logros y racha',
    b: 'Insignias, racha diaria y estadísticas para mantener tu motivación de aprendizaje.' },
];

const STATS = [
  ['27',   'señas del abecedario'],
  ['12',   'módulos de aprendizaje'],
  ['3',    'niveles de dificultad'],
  ['ML',   'reconocimiento en vivo'],
] as const;

export function LandingView({ onAuth }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg)' }}>
      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: '1px solid var(--bdr)',
        position: 'sticky', top: 0,
        background: 'rgba(8,13,26,.88)', backdropFilter: 'blur(14px)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 33, height: 33, borderRadius: 9,
            background: 'linear-gradient(135deg,#0ED2B8,#07A898)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, color: '#040D14', fontWeight: 900,
          }}>S</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1, letterSpacing: -0.3 }}>
              SeñasUTSCMX
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--t3)' }}>UTSC · Proyecto Integrador</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ padding: '7px 15px', fontSize: 12.5 }}
            onClick={() => onAuth('login')}>Iniciar sesión</button>
          <button className="btn-primary" style={{ padding: '7px 15px', fontSize: 12.5 }}
            onClick={() => onAuth('register')}>Comenzar →</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: 'center', padding: '64px 24px 52px', maxWidth: 680, margin: '0 auto' }}>
        <div className="tag" style={{
          background: 'var(--teal-d)', color: 'var(--teal)', border: '1px solid var(--teal-b)',
          marginBottom: 20, fontSize: 11.5,
        }}>
          🎓 ODS 4 + ODS 10 · Ingeniería en Desarrollo de Software UTSC
        </div>
        <h1 style={{
          fontSize: 'clamp(34px, 7vw, 52px)',
          fontWeight: 900, lineHeight: 1.07, marginBottom: 16,
          letterSpacing: -1.5, color: 'var(--t1)',
        }}>
          Aprende{' '}
          <span className="gradient-text">Lengua de Señas</span>
          <br />Mexicana
        </h1>
        <p style={{
          fontSize: 16, color: 'var(--t2)', lineHeight: 1.68,
          maxWidth: 500, margin: '0 auto 30px',
        }}>
          Plataforma educativa para la comunidad oyente de UTSC. Lecciones interactivas,
          diccionario visual y práctica con IA en tiempo real.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ padding: '12px 26px', fontSize: 14.5 }}
            onClick={() => onAuth('register')}>
            Empezar gratis →
          </button>
          <button className="btn-ghost" style={{ padding: '12px 26px', fontSize: 14.5 }}
            onClick={() => onAuth('login')}>
            Ver diccionario
          </button>
        </div>
      </section>

      {/* STATS STRIP */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        borderTop: '1px solid var(--bdr)', borderBottom: '1px solid var(--bdr)',
        margin: '0 0 52px', background: 'rgba(14,210,184,.03)',
      }}>
        {STATS.map(([n, l], i) => (
          <div key={i} style={{
            textAlign: 'center', padding: '20px 28px',
            borderRight: i < STATS.length - 1 ? '1px solid var(--bdr)' : 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--teal)' }}>{n}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <section style={{
        maxWidth: 860, margin: '0 auto', padding: '0 24px 52px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(195px,1fr))', gap: 14,
      }}>
        {FEATURES.map(({ c, e, t, b }) => (
          <div key={t} className="glass" style={{ padding: 18 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: `${c}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, marginBottom: 12,
            }}>{e}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t}</div>
            <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.58 }}>{b}</div>
          </div>
        ))}
      </section>

      {/* ALPHABET PREVIEW */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 56px', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Vista previa del abecedario LSM</div>
        <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 20 }}>
          Haz clic en cualquier letra para comenzar
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center' }}>
          {SIGNS_ALPHA.map(s => (
            <div
              key={s.id}
              title={`Letra ${s.letter}`}
              onClick={() => onAuth('register')}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: 48, height: 48, borderRadius: 11, cursor: 'pointer',
                border: `1px solid ${hovered === s.id ? s.color : 'var(--bdr)'}`,
                background: hovered === s.id ? `${s.color}18` : 'var(--card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 800, color: s.color,
                transition: '.18s',
                transform: hovered === s.id ? 'translateY(-3px)' : 'none',
              }}
            >
              {s.letter}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FOOTER */}
      <div style={{
        textAlign: 'center', padding: '44px 24px 56px',
        borderTop: '1px solid var(--bdr)',
        background: 'linear-gradient(180deg,transparent,rgba(14,210,184,.04))',
      }}>
        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>
          ¿Listo para <span className="gradient-text">empezar</span>?
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--t2)', marginBottom: 22 }}>
          Crea tu cuenta gratis y comienza a aprender LSM hoy mismo.
        </div>
        <button className="btn-primary" style={{ padding: '12px 30px', fontSize: 14.5 }}
          onClick={() => onAuth('register')}>
          Crear mi cuenta →
        </button>
        <div style={{ marginTop: 28, fontSize: 11, color: 'var(--t3)' }}>
          SeñasUTSCMX · Universidad Tecnológica de Santa Catarina · Proyecto Integrador 2026
        </div>
      </div>
    </div>
  );
}
