import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Lesson, ContentBlock } from '../types';
import { PBar } from '../components/UI';

interface Props {
  lesson:     Lesson;
  onBack:     () => void;
  onProgress: (lessonId: number, pct: number, completed: boolean) => void;
}

export function LessonDetailView({ lesson, onBack, onProgress }: Props) {
  const [content,  setContent]  = useState<ContentBlock[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [step,     setStep]     = useState(0);
  const [quizAns,  setQuizAns]  = useState<number|null>(null);
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    setStep(0); setQuizAns(null); setDone(false); setLoading(true);
    api.lessons.getById(lesson.id)
      .then(data => {
        setContent((data.content as ContentBlock[]) ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lesson.id]);

  // Actualizar progreso al avanzar pasos
  useEffect(() => {
    if (content.length === 0) return;
    const pct = Math.round((step / content.length) * 100);
    onProgress(lesson.id, pct, false);
  }, [step, content.length]);

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32,marginBottom:10 }}>⏳</div>
        <div>Cargando lección…</div>
      </div>
    </div>
  );

  if (done) return (
    <div className="anim-fade-up" style={{ height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center' }}>
      <div style={{ fontSize:52,marginBottom:16 }}>🎉</div>
      <div style={{ fontWeight:800,fontSize:22,marginBottom:8 }}>¡Lección completada!</div>
      <div style={{ fontSize:14,color:'var(--t2)',marginBottom:28 }}>{lesson.title}</div>
      <div style={{ display:'flex',gap:10 }}>
        <button className="btn-ghost" onClick={()=>{setStep(0);setQuizAns(null);setDone(false);}}>Repasar</button>
        <button className="btn-primary" onClick={onBack}>Siguiente lección →</button>
      </div>
    </div>
  );

  if (content.length === 0) return (
    <div className="anim-fade-up" style={{ height:'100%',overflowY:'auto',padding:20 }}>
      <button className="btn-sm" onClick={onBack} style={{ marginBottom:16 }}>← Lecciones</button>
      <div style={{ textAlign:'center',padding:'40px 20px' }}>
        <div style={{ fontSize:40,marginBottom:14 }}>🚧</div>
        <div style={{ fontWeight:700,fontSize:17,marginBottom:8 }}>{lesson.title}</div>
        <div style={{ fontSize:13,color:'var(--t2)' }}>Contenido en desarrollo.</div>
      </div>
    </div>
  );

  const block = content[step];
  const total = content.length;

  return (
    <div className="anim-fade-up" style={{ height:'100%',display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'12px 16px',borderBottom:'1px solid var(--bdr)',background:'var(--bg2)' }}>
        <button className="btn-sm" onClick={onBack} style={{ marginBottom:8 }}>← Lecciones</button>
        <div style={{ fontWeight:700,fontSize:14,marginBottom:6 }}>{lesson.title}</div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ flex:1 }}><PBar pct={Math.round((step/total)*100)} height={5}/></div>
          <span style={{ fontSize:11,color:'var(--t3)',fontWeight:600,minWidth:40 }}>{step}/{total}</span>
        </div>
      </div>

      <div style={{ flex:1,overflowY:'auto',padding:20 }}>
        {block && (
          <div className="anim-fade-up" key={step}>
            {block.type==='intro' && (
              <div>
                <div style={{ fontWeight:800,fontSize:19,marginBottom:14,color:'var(--teal)' }}>{block.title}</div>
                <div style={{ fontSize:14.5,color:'var(--t2)',lineHeight:1.72 }}>{block.body}</div>
              </div>
            )}
            {block.type==='highlight' && (
              <div style={{ background:'var(--amb-d)',border:'1px solid rgba(245,166,35,.25)',borderRadius:12,padding:'16px 18px',display:'flex',gap:12 }}>
                <div style={{ fontSize:20,flexShrink:0,marginTop:2 }}>{block.emoji}</div>
                <div style={{ fontSize:14,color:'var(--t2)',lineHeight:1.65 }}>{block.body}</div>
              </div>
            )}
            {block.type==='tip' && (
              <div style={{ background:'var(--teal-d)',border:'1px solid var(--teal-b)',borderRadius:12,padding:'16px 18px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>{block.emoji}</span>
                  <span style={{ fontWeight:700,fontSize:14,color:'var(--teal)' }}>{block.title}</span>
                </div>
                <div style={{ fontSize:13.5,color:'var(--t2)',lineHeight:1.6 }}>{block.body}</div>
              </div>
            )}
            {block.type==='stats' && (
              <div>
                <div style={{ fontWeight:700,fontSize:15,marginBottom:14 }}>En números</div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12 }}>
                  {block.items.map(({n,l}) => (
                    <div key={n} className="glass" style={{ padding:16,textAlign:'center' }}>
                      <div style={{ fontSize:24,fontWeight:900,color:'var(--teal)',marginBottom:4 }}>{n}</div>
                      <div style={{ fontSize:11.5,color:'var(--t3)',lineHeight:1.4 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {block.type==='body' && (
              <div>
                <div style={{ fontWeight:700,fontSize:17,marginBottom:12 }}>{block.title}</div>
                <div style={{ fontSize:14.5,color:'var(--t2)',lineHeight:1.72 }}>{block.body}</div>
              </div>
            )}
            {block.type==='sign' && (
              <div className="glass" style={{ padding:20,textAlign:'center' }}>
                <div style={{ fontSize:48,fontWeight:900,color:'var(--teal)',marginBottom:8 }}>{block.letter}</div>
                <div style={{ fontWeight:700,fontSize:18,marginBottom:10 }}>{block.name}</div>
                <div style={{ fontSize:14,color:'var(--t2)',lineHeight:1.6,marginBottom:block.tip?12:0 }}>{block.description}</div>
                {block.tip && <div style={{ fontSize:12.5,color:'var(--teal)',padding:'8px 12px',background:'var(--teal-d)',borderRadius:8 }}>💡 {block.tip}</div>}
              </div>
            )}
            {block.type==='quiz' && (
              <div>
                <span className="tag" style={{ background:'var(--vio-d)',color:'var(--vio)',marginBottom:14,fontSize:11.5 }}>📝 Pregunta de comprensión</span>
                <div style={{ fontWeight:700,fontSize:15.5,margin:'14px 0 18px',lineHeight:1.45 }}>{block.q}</div>
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {block.opts.map((opt,i) => {
                    const isCorrect = quizAns!==null && i===block.correct;
                    const isWrong   = quizAns===i    && i!==block.correct;
                    return (
                      <button key={i} onClick={()=>quizAns===null&&setQuizAns(i)}
                        style={{ padding:'13px 16px',borderRadius:11,cursor:quizAns===null?'pointer':'default',textAlign:'left',fontSize:13.5,fontFamily:'inherit',transition:'.2s',background:isCorrect?'var(--grn-d)':isWrong?'rgba(240,80,80,.12)':'var(--card)',border:`${isCorrect||isWrong?1.5:1}px solid ${isCorrect?'var(--grn)':isWrong?'var(--red)':'var(--bdr)'}`,color:isCorrect?'var(--grn)':isWrong?'var(--red)':'var(--t2)' } as React.CSSProperties}>
                        <span style={{ marginRight:8 }}>{['A','B','C','D'][i]}.</span>{opt}
                        {isCorrect && <span style={{ float:'right' }}>✅</span>}
                        {isWrong   && <span style={{ float:'right' }}>❌</span>}
                      </button>
                    );
                  })}
                </div>
                {quizAns!==null && (
                  <div style={{ marginTop:14,padding:'13px 16px',borderRadius:11,background:quizAns===block.correct?'var(--grn-d)':'rgba(240,80,80,.1)',border:`1px solid ${quizAns===block.correct?'var(--grn)':'var(--red)'}`,fontSize:13,color:'var(--t2)',lineHeight:1.55 }}>
                    {quizAns===block.correct?'✅ ':'❌ '}{block.feedback}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding:'14px 16px',borderTop:'1px solid var(--bdr)',display:'flex',gap:10 }}>
        <button className="btn-ghost" style={{ flex:1,justifyContent:'center' }} onClick={()=>{setStep(s=>Math.max(0,s-1));setQuizAns(null);}} disabled={step===0}>← Anterior</button>
        <button className="btn-primary" style={{ flex:1,justifyContent:'center' }} onClick={()=>{
          if (step<total-1){setStep(s=>s+1);setQuizAns(null);}
          else { onProgress(lesson.id,100,true); setDone(true); }
        }}>
          {step<total-1?'Siguiente →':'Completar ✓'}
        </button>
      </div>
    </div>
  );
}
