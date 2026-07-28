import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { LessonFromAPI } from '../../lib/api';
import type { ContentBlock } from '../../types';
import { validateContent, blockErrors } from '../../lib/validateContent';

type Level = 'BASICO' | 'INTERMEDIO' | 'AVANZADO';
type BlockType = ContentBlock['type'];

interface Props {
  lesson:    LessonFromAPI | null; // null = nueva lección
  nextOrder: number;
  onClose:   () => void;
  onSaved:   () => void;
}

const LEVELS: { value: Level; label: string }[] = [
  { value: 'BASICO',     label: 'Básico' },
  { value: 'INTERMEDIO', label: 'Intermedio' },
  { value: 'AVANZADO',   label: 'Avanzado' },
];

const TYPE_LABEL: Record<BlockType, string> = {
  intro: 'Introducción', body: 'Texto', highlight: 'Destacado',
  tip: 'Consejo', stats: 'Estadísticas', quiz: 'Quiz', sign: 'Seña',
};
const ADD_ORDER: BlockType[] = ['intro', 'body', 'highlight', 'tip', 'stats', 'quiz', 'sign'];

// Letras con imagen en /public/signs/. El input acepta texto libre igual
// (números, CH, RR, o letras-categoría como H para "Hola").
const SIGN_LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

// Bloque nuevo vacío del tipo dado (con la forma EXACTA del modelo).
function newBlock(type: BlockType): ContentBlock {
  switch (type) {
    case 'intro':     return { type: 'intro', title: '', body: '' };
    case 'body':      return { type: 'body', title: '', body: '' };
    case 'highlight': return { type: 'highlight', emoji: '⚠️', body: '' };
    case 'tip':       return { type: 'tip', emoji: '💡', title: '', body: '' };
    case 'stats':     return { type: 'stats', items: [{ n: '', l: '' }] };
    case 'quiz':      return { type: 'quiz', q: '', opts: ['', ''], correct: 0, feedback: '' };
    case 'sign':      return { type: 'sign', letter: '', name: '', description: '', tip: '' };
  }
}

const labelStyle = { fontSize: 11.5, color: 'var(--t3)', marginBottom: 4, fontWeight: 500 } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

// ── Selector de seña: input libre + preview de la imagen + galería ──
function SignPicker({ letter, onChange }: { letter: string; onChange: (l: string) => void }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [letter]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Preview — MISMO render que LessonDetailView: imagen o texto de fallback */}
        <div style={{ width: 74, height: 74, borderRadius: 10, border: '2px solid var(--teal)', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {letter && !imgError
            ? <img src={`/signs/${letter}.png`} alt={letter} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 5 }} onError={() => setImgError(true)} />
            : <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--teal)' }}>{letter || '?'}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={labelStyle}>Letra / seña</div>
          <input className="input-field" value={letter} onChange={e => onChange(e.target.value)} placeholder='A, B, 1, CH, o "H" para Hola…' />
          <button className="btn-sm" style={{ marginTop: 6 }} onClick={() => setGalleryOpen(o => !o)}>
            {galleryOpen ? '▲ Ocultar galería' : '▾ Elegir de la galería'}
          </button>
        </div>
      </div>
      {galleryOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(46px,1fr))', gap: 6, marginTop: 10 }}>
          {SIGN_LETTERS.map(L => (
            <button key={L} title={L} onClick={() => onChange(L)}
              style={{ position: 'relative', padding: 0, borderRadius: 8, overflow: 'hidden', border: `2px solid ${letter === L ? 'var(--teal)' : 'var(--bdr)'}`, background: 'var(--bg3)', cursor: 'pointer', aspectRatio: '1' }}>
              <img src={`/signs/${L}.png`} alt={L} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campos editables según el tipo de bloque ──
function BlockFields({ block, onChange }: { block: ContentBlock; onChange: (patch: Record<string, unknown>) => void }) {
  const ta = { minHeight: 76, resize: 'vertical' as const };

  switch (block.type) {
    case 'intro':
    case 'body':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Título"><input className="input-field" value={block.title} onChange={e => onChange({ title: e.target.value })} /></Field>
          <Field label="Cuerpo"><textarea className="input-field" style={ta} value={block.body} onChange={e => onChange({ body: e.target.value })} /></Field>
        </div>
      );

    case 'highlight':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Emoji"><input className="input-field" style={{ maxWidth: 90 }} value={block.emoji} onChange={e => onChange({ emoji: e.target.value })} /></Field>
          <Field label="Cuerpo"><textarea className="input-field" style={ta} value={block.body} onChange={e => onChange({ body: e.target.value })} /></Field>
        </div>
      );

    case 'tip':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Emoji"><input className="input-field" style={{ maxWidth: 90 }} value={block.emoji} onChange={e => onChange({ emoji: e.target.value })} /></Field>
            <div style={{ flex: 1 }}><Field label="Título"><input className="input-field" value={block.title} onChange={e => onChange({ title: e.target.value })} /></Field></div>
          </div>
          <Field label="Cuerpo"><textarea className="input-field" style={ta} value={block.body} onChange={e => onChange({ body: e.target.value })} /></Field>
        </div>
      );

    case 'stats':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={labelStyle}>Datos (número + etiqueta)</div>
          {block.items.map((it, j) => (
            <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input-field" style={{ maxWidth: 120 }} placeholder="150,000+" value={it.n}
                onChange={e => onChange({ items: block.items.map((x, k) => k === j ? { ...x, n: e.target.value } : x) })} />
              <input className="input-field" placeholder="hablantes de LSM" value={it.l}
                onChange={e => onChange({ items: block.items.map((x, k) => k === j ? { ...x, l: e.target.value } : x) })} />
              <button className="btn-sm-danger" disabled={block.items.length <= 1}
                onClick={() => onChange({ items: block.items.filter((_, k) => k !== j) })}>✕</button>
            </div>
          ))}
          <button className="btn-sm-outline" style={{ alignSelf: 'flex-start' }}
            onClick={() => onChange({ items: [...block.items, { n: '', l: '' }] })}>+ Dato</button>
        </div>
      );

    case 'quiz':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Pregunta"><textarea className="input-field" style={ta} value={block.q} onChange={e => onChange({ q: e.target.value })} /></Field>
          <div>
            <div style={labelStyle}>Opciones (marca la correcta)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {block.opts.map((opt, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="radio" name={`correct-${block.q.slice(0, 8)}-${j}-${block.opts.length}`} checked={block.correct === j}
                    onChange={() => onChange({ correct: j })} title="Marcar como correcta" style={{ flexShrink: 0 }} />
                  <input className="input-field" placeholder={`Opción ${j + 1}`} value={opt}
                    onChange={e => onChange({ opts: block.opts.map((x, k) => k === j ? e.target.value : x) })} />
                  <button className="btn-sm-danger" disabled={block.opts.length <= 2}
                    onClick={() => {
                      const opts = block.opts.filter((_, k) => k !== j);
                      const correct = block.correct === j ? 0 : block.correct > j ? block.correct - 1 : block.correct;
                      onChange({ opts, correct });
                    }}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn-sm-outline" style={{ marginTop: 7 }}
              onClick={() => onChange({ opts: [...block.opts, ''] })}>+ Opción</button>
          </div>
          <Field label="Retroalimentación (feedback)"><textarea className="input-field" style={ta} value={block.feedback} onChange={e => onChange({ feedback: e.target.value })} /></Field>
        </div>
      );

    case 'sign':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SignPicker letter={block.letter} onChange={l => onChange({ letter: l })} />
          <Field label="Nombre"><input className="input-field" placeholder='A · Hola · Papá…' value={block.name} onChange={e => onChange({ name: e.target.value })} /></Field>
          <Field label="Descripción"><textarea className="input-field" style={ta} value={block.description} onChange={e => onChange({ description: e.target.value })} /></Field>
          <Field label="Tip (opcional)"><input className="input-field" value={block.tip ?? ''} onChange={e => onChange({ tip: e.target.value })} /></Field>
        </div>
      );
  }
}

export function LessonEditor({ lesson, nextOrder, onClose, onSaved }: Props) {
  const isNew = lesson === null;

  const [title,       setTitle]       = useState(lesson?.title ?? '');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const [level,       setLevel]       = useState<Level>((lesson?.level as Level) ?? 'BASICO');
  const [duration,    setDuration]    = useState(String(lesson?.duration ?? 10));
  const [order,       setOrder]       = useState(String(lesson?.order ?? nextOrder));
  const [modules,     setModules]     = useState(String(lesson?.modules ?? 1));
  const [locked,      setLocked]      = useState(lesson?.locked ?? false);

  const [content, setContent] = useState<ContentBlock[]>([]);
  const [loadingContent, setLoadingContent] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState('');
  const [showErrors, setShowErrors] = useState(false); // mostrar errores por bloque tras intentar guardar

  useEffect(() => {
    if (isNew) return;
    api.lessons.getById(lesson!.id)
      .then(full => setContent((full.content as ContentBlock[]) ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingContent(false));
  }, [isNew, lesson]);

  const patchBlock = (i: number, patch: Record<string, unknown>) =>
    setContent(prev => prev.map((b, idx) => idx === i ? ({ ...b, ...patch } as ContentBlock) : b));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setContent(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeBlock = (i: number) => setContent(prev => prev.filter((_, idx) => idx !== i));
  const addBlock = (t: BlockType) => setContent(prev => [...prev, newBlock(t)]);

  const save = async () => {
    setError('');
    if (!title.trim())       { setError('El título es obligatorio.'); return; }
    if (!description.trim())  { setError('La descripción es obligatoria.'); return; }
    const dur = Number(duration), ord = Number(order), mods = Number(modules);
    if (!Number.isFinite(dur)  || dur  < 0) { setError('Duración inválida.'); return; }
    if (!Number.isFinite(ord)  || ord  < 1) { setError('Orden inválido (mínimo 1).'); return; }
    if (!Number.isFinite(mods) || mods < 0) { setError('Módulos inválido.'); return; }

    // Validación de bloques ESPEJO del backend: bloquea aquí antes de la API.
    const blockErrs = validateContent(content);
    if (blockErrs.length) {
      setShowErrors(true);
      setError(`Corrige los bloques marcados: ${blockErrs[0]}${blockErrs.length > 1 ? ` (y ${blockErrs.length - 1} más)` : ''}`);
      return;
    }

    setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), level, duration: dur, order: ord, modules: mods, locked, content };
      if (isNew) await api.lessons.create(payload);
      else       await api.lessons.update(lesson!.id, payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const metaLabel = { fontSize: 12, color: 'var(--t3)', marginBottom: 5, fontWeight: 500 } as const;

  return (
    <div className="anim-fade-up">
      {/* Barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <button className="btn-sm" onClick={onClose}>← Volver a lecciones</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Crear lección' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
        {isNew ? '➕ Nueva lección' : `✏️ Editar: ${lesson!.title}`}
      </div>

      {/* Metadatos */}
      <div className="glass" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div>
            <div style={metaLabel}>Título</div>
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Dactilología A–M" />
          </div>
          <div>
            <div style={metaLabel}>Descripción</div>
            <input className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descripción de la lección" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
            <div>
              <div style={metaLabel}>Nivel</div>
              <select className="input-field" value={level} onChange={e => setLevel(e.target.value as Level)}>
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div><div style={metaLabel}>Duración (min)</div><input className="input-field" type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)} /></div>
            <div><div style={metaLabel}>Orden</div><input className="input-field" type="number" min={1} value={order} onChange={e => setOrder(e.target.value)} /></div>
            <div><div style={metaLabel}>Módulos</div><input className="input-field" type="number" min={0} value={modules} onChange={e => setModules(e.target.value)} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)} />
            Bloqueada (los alumnos no pueden abrirla todavía)
          </label>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-d)', border: '1px solid var(--red-b)', borderRadius: 8, padding: '9px 13px', marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Bloques */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Bloques de contenido ({content.length})</div>
      </div>

      {loadingContent ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', animation: 'breathe 1.6s ease-in-out infinite' }}>Cargando bloques…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {content.map((b, i) => {
            const errs = showErrors ? blockErrors(b) : [];
            return (
              <div key={i} className="glass" style={{ padding: '13px 15px', border: errs.length ? '1px solid var(--red)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)' }}>#{i + 1}</span>
                  <span className="tag" style={{ background: 'var(--vio-d)', color: 'var(--vio)', fontSize: 10.5 }}>{TYPE_LABEL[b.type]}</span>
                  <div style={{ flex: 1 }} />
                  <button className="btn-sm-outline" disabled={i === 0} onClick={() => moveBlock(i, -1)} title="Subir">↑</button>
                  <button className="btn-sm-outline" disabled={i === content.length - 1} onClick={() => moveBlock(i, 1)} title="Bajar">↓</button>
                  <button className="btn-sm-danger" onClick={() => removeBlock(i)} title="Eliminar bloque">🗑</button>
                </div>
                <BlockFields block={b} onChange={patch => patchBlock(i, patch)} />
                {errs.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--red)' }}>
                    {errs.map((e, k) => <div key={k}>❌ {e}</div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Añadir bloque */}
      <div className="glass" style={{ padding: 14, marginTop: 12 }}>
        <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 9, fontWeight: 600 }}>➕ Añadir bloque</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {ADD_ORDER.map(t => (
            <button key={t} className="btn-sm-outline" onClick={() => addBlock(t)}>{TYPE_LABEL[t]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
