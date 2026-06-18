// ─── Progress Bar ──────────────────────────────────────────────
interface PBarProps {
  pct: number;          // 0–100
  height?: number;
  gradient?: string;
}
export function PBar({ pct, height = 6, gradient = 'linear-gradient(90deg,#0ED2B8,#9D7BF8)' }: PBarProps) {
  return (
    <div className="pbar-track" style={{ height }}>
      <div
        className="pbar-fill"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: gradient }}
      />
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────
interface StatCardProps {
  icon: string;         // emoji
  value: string | number;
  label: string;
  color: string;
}
export function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <div className="glass" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--t3)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)' }}>{value}</div>
    </div>
  );
}

// ─── Tag ───────────────────────────────────────────────────────
interface TagProps {
  text: string;
  color: string;
}
export function Tag({ text, color }: TagProps) {
  return (
    <span
      className="tag"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {text}
    </span>
  );
}
