import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { UserProfile } from '../types';
import type { LessonFromAPI, AdminUser, UserRoleAPI } from '../lib/api';
import { LessonEditor } from './admin/LessonEditor';
import { checkPassword, passwordError, allChecksPassed } from '../lib/passwordPolicy';
import { emailError } from '../lib/emailValidation';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';

interface Props { adminUser: UserProfile; }

type Tab = 'stats' | 'users' | 'lessons';
type RoleFilter   = 'all' | 'student' | 'admin';
type StatusFilter = 'all' | 'active' | 'disabled';

const LEVEL_COLORS: Record<string, string> = {
  BASICO: '#0ED2B8', INTERMEDIO: '#9D7BF8', AVANZADO: '#F5A623',
};

export function AdminView({ adminUser }: Props) {
  const [tab, setTab] = useState<Tab>('users');

  // ── Contenido (lecciones) ───────────────────────────────────────
  const [lessons, setLessons] = useState<LessonFromAPI[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [lessonsError, setLessonsError] = useState('');
  // null = modo lista; 'new' = editor de lección nueva; LessonFromAPI = editar esa
  const [editingLesson, setEditingLesson] = useState<LessonFromAPI | 'new' | null>(null);

  const reloadLessons = useCallback(() => {
    setLoadingLessons(true);
    setLessonsError('');
    // getAllAdmin incluye inactivas (soft-deleted) para poder reactivarlas.
    api.lessons.getAllAdmin()
      .then(setLessons)
      .catch((e: Error) => setLessonsError(e.message))
      .finally(() => setLoadingLessons(false));
  }, []);

  useEffect(() => {
    if (tab === 'lessons') reloadLessons();
  }, [tab, reloadLessons]);

  const nextOrder = lessons.reduce((max, l) => Math.max(max, l.order), 0) + 1;

  // ── Usuarios ────────────────────────────────────────────────────
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null); // fila con acción en curso

  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Modales
  const [confirm, setConfirm]       = useState<null | { title: string; message: string; danger: boolean; onConfirm: () => void }>(null);
  const [pwModal, setPwModal]       = useState<null | { uid: string; name: string }>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadUsers = useCallback(() => {
    setLoading(true);
    setError('');
    api.users.list()
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab, loadUsers]);

  // Ejecuta una acción sobre una fila con estado busy + refresco + error.
  const runAction = useCallback(async (uid: string, fn: () => Promise<unknown>) => {
    setBusyUid(uid);
    setError('');
    try {
      await fn();
      await api.users.list().then(setUsers);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyUid(null);
    }
  }, []);

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = roleFilter === 'all'   || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? !u.disabled : u.disabled);
    return matchQ && matchRole && matchStatus;
  });

  const TABS: { id: Tab; label: string; e: string }[] = [
    { id: 'users',   label: 'Usuarios',     e: '👥' },
    { id: 'stats',   label: 'Estadísticas', e: '📊' },
    { id: 'lessons', label: 'Contenido',    e: '📚' },
  ];

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

        {/* ═══ USUARIOS ═══════════════════════════════════════════ */}
        {tab === 'users' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:17 }}>Gestión de usuarios</div>
                <div style={{ fontSize:12.5, color:'var(--t3)', marginTop:2 }}>{users.length} usuarios registrados</div>
              </div>
              <button className="btn-primary" onClick={() => setCreateOpen(true)}>➕ Añadir usuario</button>
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <input className="input-field" placeholder="🔎 Buscar por nombre o correo…" value={search}
                onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:180 }}/>
              <select className="input-field" value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)} style={{ width:'auto' }}>
                <option value="all">Todos los roles</option>
                <option value="admin">Admin</option>
                <option value="student">Student</option>
              </select>
              <select className="input-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={{ width:'auto' }}>
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="disabled">Inactivos</option>
              </select>
            </div>

            {error && (
              <div style={{ fontSize:12.5, color:'var(--red)', background:'var(--red-d)', border:'1px solid rgba(240,80,80,.3)', borderRadius:8, padding:'9px 13px', marginBottom:14 }}>
                ⚠️ {error}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--t3)' }}>Cargando usuarios…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--t3)' }}>
                {users.length === 0 ? 'No hay usuarios (o el Admin SDK aún no está configurado).' : 'Ningún usuario coincide con los filtros.'}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {filtered.map(u => {
                  const isSelf = u.uid === adminUser.uid;
                  const busy   = busyUid === u.uid;
                  return (
                    <div key={u.uid} className="glass" style={{ padding:'12px 15px', opacity: busy ? 0.55 : 1, transition:'opacity .15s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                        {/* Avatar */}
                        <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#0ED2B8,#9D7BF8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#040D14' }}>
                          {(u.name || u.email || '?').slice(0,2).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div style={{ flex:1, minWidth:140 }}>
                          <div style={{ fontWeight:600, fontSize:13.5, display:'flex', alignItems:'center', gap:6 }}>
                            {u.name || '(sin nombre)'}
                            {isSelf && <span style={{ fontSize:9.5, background:'var(--teal-d)', color:'var(--teal)', padding:'1px 6px', borderRadius:4, fontWeight:700 }}>tú</span>}
                          </div>
                          <div style={{ fontSize:11.5, color:'var(--t3)' }}>{u.email}</div>
                        </div>
                        {/* Badges */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span className="tag" style={{ fontSize:10, background: u.role==='admin' ? 'var(--amb-d)' : 'var(--vio-d)', color: u.role==='admin' ? 'var(--amb)' : 'var(--vio)' }}>
                            {u.role === 'admin' ? '⚙️ admin' : '🎓 student'}
                          </span>
                          <span className="tag" style={{ fontSize:10, background: u.disabled ? 'var(--red-d)' : 'var(--grn-d)', color: u.disabled ? 'var(--red)' : 'var(--grn)' }}>
                            {u.disabled ? '🚫 inactivo' : '✅ activo'}
                          </span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div style={{ display:'flex', gap:7, marginTop:11, flexWrap:'wrap' }}>
                        {/* Cambiar rol */}
                        <button className="btn-sm-outline" disabled={busy || (isSelf && u.role==='admin')}
                          title={isSelf && u.role==='admin' ? 'No puedes quitarte tu propio rol admin' : ''}
                          onClick={() => runAction(u.uid, () => api.users.setRole(u.uid, u.role === 'admin' ? 'student' : 'admin'))}>
                          {u.role === 'admin' ? '↓ Hacer student' : '↑ Hacer admin'}
                        </button>
                        {/* Activar / desactivar */}
                        {u.disabled ? (
                          <button className="btn-sm-outline" disabled={busy}
                            onClick={() => runAction(u.uid, () => api.users.setDisabled(u.uid, false))}>
                            ✅ Reactivar
                          </button>
                        ) : (
                          <button className="btn-sm-outline" disabled={busy || isSelf}
                            title={isSelf ? 'No puedes desactivar tu propia cuenta' : ''}
                            onClick={() => setConfirm({
                              title: 'Desactivar usuario', danger: false,
                              message: `¿Desactivar a ${u.name || u.email}? No podrá iniciar sesión hasta reactivarlo.`,
                              onConfirm: () => runAction(u.uid, () => api.users.setDisabled(u.uid, true)),
                            })}>
                            🚫 Desactivar
                          </button>
                        )}
                        {/* Cambiar contraseña */}
                        <button className="btn-sm-outline" disabled={busy}
                          onClick={() => setPwModal({ uid: u.uid, name: u.name || u.email })}>
                          🔑 Contraseña
                        </button>
                        {/* Eliminar */}
                        <button className="btn-sm-danger" disabled={busy || isSelf}
                          title={isSelf ? 'No puedes eliminar tu propia cuenta' : ''}
                          onClick={() => setConfirm({
                            title: 'Eliminar usuario', danger: true,
                            message: `¿Eliminar definitivamente a ${u.name || u.email}? Se borra de Firebase Auth y de la base de datos. Esta acción no se puede deshacer.`,
                            onConfirm: () => runAction(u.uid, () => api.users.remove(u.uid)),
                          })}>
                          🗑 Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ STATS ══════════════════════════════════════════════ */}
        {tab === 'stats' && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Panel de administración</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
              {[
                { e:'👥', v: users.length || '—', l:'Usuarios registrados', c:'#0ED2B8' },
                { e:'⚙️', v: users.filter(u=>u.role==='admin').length || '—', l:'Administradores', c:'#F5A623' },
                { e:'🚫', v: users.filter(u=>u.disabled).length, l:'Cuentas inactivas', c:'#F05050' },
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
                El contenido se gestiona desde el backend API (PostgreSQL). Los usuarios se
                administran vía Firebase Admin SDK en el backend. El rol vive en Realtime Database.
              </div>
            </div>
          </div>
        )}

        {/* ═══ LESSONS ════════════════════════════════════════════ */}
        {tab === 'lessons' && (
          editingLesson !== null ? (
            <LessonEditor
              lesson={editingLesson === 'new' ? null : editingLesson}
              nextOrder={nextOrder}
              onClose={() => setEditingLesson(null)}
              onSaved={() => { setEditingLesson(null); reloadLessons(); }}
            />
          ) : (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:17 }}>Gestión de contenido</div>
                <div style={{ fontSize:12.5, color:'var(--t3)', marginTop:2 }}>
                  {lessons.filter(l => l.active !== false).length} activas
                  {lessons.some(l => l.active === false) && ` · ${lessons.filter(l => l.active === false).length} inactivas`}
                  {' '}· desde el backend (BD)
                </div>
              </div>
              <button className="btn-primary" onClick={() => setEditingLesson('new')}>➕ Nueva lección</button>
            </div>

            {lessonsError && (
              <div style={{ fontSize:12.5, color:'var(--red)', background:'var(--red-d)', border:'1px solid rgba(240,80,80,.3)', borderRadius:8, padding:'9px 13px', marginBottom:14 }}>
                ⚠️ {lessonsError}
              </div>
            )}

            {loadingLessons ? (
              <div style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>Cargando…</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {lessons.map(l => {
                  const inactive = l.active === false;
                  return (
                  <div key={l.id} className="glass" style={{ padding:'12px 15px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', opacity: inactive ? 0.6 : 1 }}>
                    <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background: `${LEVEL_COLORS[l.level] ?? '#0ED2B8'}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color: LEVEL_COLORS[l.level] ?? '#0ED2B8' }}>{l.order}</div>
                    <div style={{ flex:1, minWidth:120 }}>
                      <div style={{ fontWeight:600, fontSize:13.5 }}>{l.title}</div>
                      <div style={{ fontSize:11, color:'var(--t3)' }}>{l.level} · {l.duration} min · {l.modules} módulos</div>
                    </div>
                    <span className="tag" style={{ fontSize:10, background: inactive ? 'var(--red-d)' : '#22C97E18', color: inactive ? 'var(--red)' : '#22C97E' }}>
                      {inactive ? '🚫 Inactiva' : l.locked ? '🔒 Bloqueada' : '✅ Activa'}
                    </span>
                    <div style={{ display:'flex', gap:7 }}>
                      <button className="btn-sm-outline" onClick={() => setEditingLesson(l)}>✏️ Editar</button>
                      {inactive ? (
                        <button className="btn-sm-outline" onClick={async () => {
                          try { await api.lessons.update(l.id, { active: true }); reloadLessons(); }
                          catch (e) { setLessonsError((e as Error).message); }
                        }}>♻️ Reactivar</button>
                      ) : (
                        <button className="btn-sm-danger" onClick={() => setConfirm({
                          title: 'Eliminar lección', danger: true,
                          message: `¿Eliminar "${l.title}"? Se desactiva (soft-delete) y deja de mostrarse a los alumnos. Podrás reactivarla después.`,
                          onConfirm: async () => {
                            try { await api.lessons.delete(l.id); reloadLessons(); }
                            catch (e) { setLessonsError((e as Error).message); }
                          },
                        })}>🗑 Eliminar</button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          )
        )}
      </div>

      {/* ═══ MODALES ══════════════════════════════════════════════ */}
      {confirm && (
        <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />
      )}
      {pwModal && (
        <PasswordModal uid={pwModal.uid} name={pwModal.name} onClose={() => setPwModal(null)} />
      )}
      {createOpen && (
        <CreateUserModal onClose={() => setCreateOpen(false)} onCreated={loadUsers} />
      )}
    </div>
  );
}

// ── Overlay base ───────────────────────────────────────────────────
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(4,8,14,.72)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="anim-fade-up" style={{ width:'100%', maxWidth:400, background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:16, padding:22 }}>
        {children}
      </div>
    </div>
  );
}

// ── Confirmación (acciones destructivas) ───────────────────────────
function ConfirmModal({ title, message, danger, onConfirm, onClose }: { title: string; message: string; danger: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Overlay>
      <div style={{ fontWeight:800, fontSize:16, marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:13.5, color:'var(--t2)', lineHeight:1.6, marginBottom:20 }}>{message}</div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className={danger ? 'btn-sm-danger' : 'btn-primary'} style={{ padding:'10px 18px' }}
          onClick={() => { onConfirm(); onClose(); }}>
          {danger ? 'Sí, eliminar' : 'Confirmar'}
        </button>
      </div>
    </Overlay>
  );
}

// ── Cambiar contraseña ─────────────────────────────────────────────
function PasswordModal({ uid, name, onClose }: { uid: string; name: string; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pwOk = allChecksPassed(checkPassword(pw));

  // Aviso de éxito y auto-cierre tras confirmar.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [success, onClose]);

  const submit = async () => {
    setErr('');
    // MISMA política estricta que el registro (no solo 8 caracteres).
    const pwErr = passwordError(pw);
    if (pwErr) { setErr(pwErr); return; }
    setSubmitting(true);
    try {
      await api.users.setPassword(uid, pw);
      setSuccess(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return (
    <Overlay>
      <div style={{ textAlign:'center', padding:'8px 0' }}>
        <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>Contraseña actualizada correctamente</div>
        <div style={{ fontSize:12.5, color:'var(--t3)' }}>Nueva contraseña de <strong>{name}</strong>.</div>
      </div>
    </Overlay>
  );

  return (
    <Overlay>
      <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>🔑 Cambiar contraseña</div>
      <div style={{ fontSize:12.5, color:'var(--t3)', marginBottom:16 }}>Nueva contraseña para <strong>{name}</strong></div>
      <input className="input-field" type="text" placeholder="Crea una contraseña segura" value={pw}
        onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && pwOk && submit()} autoFocus/>
      <PasswordStrengthMeter pw={pw} />
      {err && <div style={{ fontSize:12, color:'var(--red)', marginTop:8 }}>❌ {err}</div>}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:18 }}>
        <button className="btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
        <button className="btn-primary" style={{ padding:'10px 18px' }} onClick={submit} disabled={submitting || !pwOk}>
          {submitting ? 'Guardando…' : 'Cambiar'}
        </button>
      </div>
    </Overlay>
  );
}

// ── Crear usuario ──────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw]       = useState('');
  const [role, setRole]   = useState<UserRoleAPI>('student');
  const [err, setErr]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pwOk = allChecksPassed(checkPassword(pw));

  const submit = async () => {
    setErr('');
    if (!name || !email || !pw) { setErr('Completa todos los campos.'); return; }
    // Formato de email + política de contraseña ESTRICTA (igual que el registro).
    const eErr = emailError(email);
    if (eErr) { setErr(eErr); return; }
    const pwErr = passwordError(pw);
    if (pwErr) { setErr(pwErr); return; }
    setSubmitting(true);
    try {
      await api.users.create({ name, email, password: pw, role });
      onCreated();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay>
      <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>➕ Añadir usuario</div>
      <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
        <input className="input-field" placeholder="Nombre completo" value={name} onChange={e => setName(e.target.value)} autoFocus/>
        <input className="input-field" type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)}/>
        <div>
          <input className="input-field" type="text" placeholder="Crea una contraseña segura" value={pw} onChange={e => setPw(e.target.value)}/>
          <PasswordStrengthMeter pw={pw} />
        </div>
        <select className="input-field" value={role} onChange={e => setRole(e.target.value as UserRoleAPI)}>
          <option value="student">Rol: Student</option>
          <option value="admin">Rol: Admin</option>
        </select>
      </div>
      {err && <div style={{ fontSize:12, color:'var(--red)', marginTop:10 }}>❌ {err}</div>}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:18 }}>
        <button className="btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
        <button className="btn-primary" style={{ padding:'10px 18px' }} onClick={submit} disabled={submitting || !pwOk}>
          {submitting ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </Overlay>
  );
}
