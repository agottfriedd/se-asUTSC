import type { User } from '../types';
import { BADGES_LIST } from '../data/lessons';
import { StatCard } from '../components/UI';

interface Props {
  user: User;
  onLogout: () => void;
}

export function ProfileView({ user, onLogout }: Props) {
  return (
    <div className="anim-fade-up" style={{ overflowY: 'auto', height: '100%', padding: 20 }}>
      {/* Avatar card */}
      <div className="glass" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#0ED2B8,#9D7BF8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800, color: '#040D14',
        }}>
          {user.initials}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{user.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 3 }}>{user.email}</div>
          <div style={{ marginTop: 6 }}>
            <span className="tag" style={{ background: 'var(--teal-d)', color: 'var(--teal)', fontSize: 10.5 }}>
              🎓 {user.level}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
        gap: 10, marginBottom: 20,
      }}>
        <StatCard icon="🔥" value={user.streak}      label="Días de racha"     color="#F5A623" />
        <StatCard icon="📖" value={user.totalSigns}  label="Señas aprendidas"  color="#0ED2B8" />
        <StatCard icon="🏆" value={user.badges}      label="Insignias"         color="#9D7BF8" />
        <StatCard icon="📅" value={user.joined}      label="Miembro desde"     color="#22C97E" />
      </div>

      {/* Badges */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Mis insignias</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {BADGES_LIST.map(b => (
            <div key={b.name} className="glass" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'var(--amb-d)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 19, flexShrink: 0,
              }}>
                {b.emoji}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team */}
      <div className="glass" style={{ padding: 14, marginBottom: 18, fontSize: 12, color: 'var(--t3)' }}>
        <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 6, fontSize: 12.5 }}>
          Equipo SeñasUTSCMX
        </div>
        <div style={{ lineHeight: 1.8 }}>
          Adrián Gottfried · Karolin Medina · Paola Moreno · Felipe Galván · Brandon González
        </div>
        <div style={{ marginTop: 6 }}>
          UTSC · Ingeniería en Desarrollo y Gestión de Software · 2026
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        style={{
          width: '100%', padding: '11px', borderRadius: 10,
          background: 'rgba(240,80,80,.1)', border: '1px solid rgba(240,80,80,.25)',
          color: 'var(--red)', fontWeight: 600, fontSize: 13.5,
          cursor: 'pointer', fontFamily: 'inherit', transition: '.2s',
        }}
      >
        🚪 Cerrar sesión
      </button>
    </div>
  );
}
