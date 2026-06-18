import { useState, useEffect } from 'react';
import { getAllUsers, updateUserProfile } from '../lib/firestore';
import type { UserProfile } from '../types';
import { LESSONS } from '../data/lessons';

interface Props {
  adminUser: UserProfile;
}

export function AdminView({ adminUser: _ }: Props) {
  const [tab,     setTab]     = useState<'users' | 'lessons' | 'stats'>('stats');
  const [users,   setUsers]   = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'users') {
      setLoading(true);
      getAllUsers().then(u => { setUsers(u); setLoading(false); });
    }
  }, [tab]);

  const TABS = [
    { id: 'stats'   as const, label: 'Estadísticas', e: '📊' },
    { id: 'users'   as const, label: 'Usuarios',     e: '👥' },
    { id: 'lessons' as const, label: 'Contenido',    e: '📚' },
  ];

  return (
    <div className="anim-fade-up" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid var(--bdr)', background: 'var(--bg2)',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 15px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: '.15s',
            background: tab === t.id ? 'var(--teal)' : 'var(--card)',
            color:      tab === t.id ? '#040D14' : 'var(--t2)',
            border:     tab !== t.id ? '1px solid var(--bdr)' : 'none',
          } as React.CSSProperties}>
            {t.e} {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* ── STATS ──────────────────────────────────────────── */}
        {tab === 'stats' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>
              Panel de administración
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
              gap: 12, marginBottom: 24,
            }}>
              {[
                { e:'👥', v:'—', l:'Usuarios totales',  c:'#0ED2B8' },
                { e:'📖', v: LESSONS.length, l:'Lecciones activas', c:'#9D7BF8' },
                { e:'✅', v:'—', l:'Completaciones hoy', c:'#22C97E' },
                { e:'🔥', l:'Racha promedio',           v:'—', c:'#F5A623' },
              ].map(({ e, v, l, c }) => (
                <div key={l} className="glass" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{e}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
            <div className="glass" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                ℹ️ Nota del sistema
              </div>
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
                Las estadísticas en tiempo real se calculan desde Firestore.
                Para ver los datos actuales, asegúrate de que los usuarios hayan completado al menos una sesión.
                Conecta las queries de Firestore en <code style={{ color: 'var(--teal)', fontSize: 12 }}>src/lib/firestore.ts</code> para obtener conteos reales.
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ──────────────────────────────────────────── */}
        {tab === 'users' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Gestión de usuarios</div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
                Cargando usuarios…
              </div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
                <div style={{ fontWeight: 600 }}>Sin usuarios registrados aún</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Cuando alguien se registre aparecerá aquí</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {users.map(user => (
                  <div key={user.uid} className="glass" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg,#0ED2B8,#9D7BF8)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: '#040D14',
                    }}>{user.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{user.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="tag" style={{
                        background: user.role === 'admin' ? 'var(--amb-d)' : 'var(--teal-d)',
                        color: user.role === 'admin' ? 'var(--amb)' : 'var(--teal)',
                        fontSize: 10,
                      }}>
                        {user.role === 'admin' ? '👑 Admin' : '🎓 Estudiante'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--t3)' }}>🔥 {user.streak}d</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LESSONS ────────────────────────────────────────── */}
        {tab === 'lessons' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Gestión de contenido</div>
            <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
              El contenido de las lecciones se edita en <code style={{ color: 'var(--teal)', fontSize: 12 }}>src/data/content.ts</code>.
              En la Fase 2 se conectará al backend API para CRUD desde esta interfaz.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {LESSONS.map(l => (
                <div key={l.id} className="glass" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${{ Básico: '#0ED2B8', Intermedio: '#9D7BF8', Avanzado: '#F5A623' }[l.level]}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800,
                    color: { Básico: '#0ED2B8', Intermedio: '#9D7BF8', Avanzado: '#F5A623' }[l.level],
                  }}>{l.id}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{l.level} · {l.dur} min · {l.mods} módulos</div>
                  </div>
                  <span className="tag" style={{
                    background: '#22C97E18', color: '#22C97E', fontSize: 10,
                  }}>✅ Activo</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
