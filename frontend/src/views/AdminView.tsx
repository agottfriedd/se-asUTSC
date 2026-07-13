import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { UserProfile } from '../types';
import type { LessonFromAPI } from '../lib/api';

interface Props { adminUser: UserProfile; }

export function AdminView({ adminUser: _ }: Props) {
  const [tab,     setTab]     = useState<'lessons' | 'stats'>('stats');
  const [lessons, setLessons] = useState<LessonFromAPI[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'lessons') {
      setLoading(true);
      api.lessons.getAll().then(l => { setLessons(l); setLoading(false); });
    }
  }, [tab]);

  const TABS = [
    { id: 'stats'   as const, label: 'Estadísticas', e: '📊' },
    { id: 'lessons' as const, label: 'Contenido',    e: '📚' },
  ];

  const LEVEL_COLORS: Record<string, string> = {
    BASICO: '#0ED2B8', INTERMEDIO: '#9D7BF8', AVANZADO: '#F5A623',
  };

  return (
    <div className="anim-fade-up" style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Tabs */}
      <div style={{ display:'flex', gap:8, padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 15px', borderRadius: 10, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: '.15s',
            background:   tab === t.id ? 'var(--teal)' : 'var(--card)',
            color:        tab === t.id ? '#040D14'     : 'var(--t2)',
            border:       tab === t.id ? 'none'        : '1px solid var(--bdr)',
          } as React.CSSProperties}>
            {t.e} {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:20 }}>

        {/* STATS */}
        {tab === 'stats' && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Panel de administración</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
              {[
                { e:'📖', v: lessons.length || '—', l:'Lecciones activas', c:'#9D7BF8' },
                { e:'✅', v:'—', l:'Completaciones hoy', c:'#22C97E' },
                { e:'🔥', v:'—', l:'Racha promedio',     c:'#F5A623' },
              ].map(({ e,v,l,c }) => (
                <div key={l} className="glass" style={{ padding:16, textAlign:'center' }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{e}</div>
                  <div style={{ fontSize:24, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>
            <div className="glass" style={{ padding:16 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>ℹ️ Nota del sistema</div>
              <div style={{ fontSize:13, color:'var(--t2)', lineHeight:1.65 }}>
                El contenido se gestiona desde el backend API (PostgreSQL).
                Las lecciones y señas se editan desde la pestaña Contenido.
              </div>
            </div>
          </div>
        )}

        {/* LESSONS */}
        {tab === 'lessons' && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:6 }}>Gestión de contenido</div>
            <div style={{ fontSize:13, color:'var(--t3)', marginBottom:16 }}>
              Lecciones cargadas desde el backend API.
            </div>
            {loading ? (
              <div style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>Cargando…</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {lessons.map(l => (
                  <div key={l.id} className="glass" style={{ padding:'12px 15px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{
                      width:32, height:32, borderRadius:8, flexShrink:0,
                      background: `${LEVEL_COLORS[l.level] ?? '#0ED2B8'}18`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:14, fontWeight:800,
                      color: LEVEL_COLORS[l.level] ?? '#0ED2B8',
                    }}>{l.order}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13.5 }}>{l.title}</div>
                      <div style={{ fontSize:11, color:'var(--t3)' }}>
                        {l.level} · {l.duration} min · {l.modules} módulos
                      </div>
                    </div>
                    <span className="tag" style={{ background:'#22C97E18', color:'#22C97E', fontSize:10 }}>
                      {l.locked ? '🔒 Bloqueada' : '✅ Activa'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
