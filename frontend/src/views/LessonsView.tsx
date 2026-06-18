import { useState, useEffect } from 'react';
import { api, apiLevelToLabel } from '../lib/api';
import type { LessonFromAPI } from '../lib/api';
import type { AppView, Lesson, LessonProgress } from '../types';
import { PBar } from '../components/UI';

interface Props {
  nav: (view: AppView, payload?: Lesson) => void;
  getForLesson: (id: number) => LessonProgress;
}

const TABS = ['Todos','Básico','Intermedio','Avanzado'] as const;
const LCOLORS: Record<string,string> = { Básico:'#0ED2B8', Intermedio:'#9D7BF8', Avanzado:'#F5A623' };

export function LessonsView({ nav, getForLesson }: Props) {
  const [lessons,  setLessons]  = useState<LessonFromAPI[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<typeof TABS[number]>('Todos');

  useEffect(() => {
    api.lessons.getAll()
      .then(data => { setLessons(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32,marginBottom:10 }}>⏳</div>
        <div>Cargando lecciones…</div>
      </div>
    </div>
  );

  const levels = (['Básico','Intermedio','Avanzado'] as const).filter(l => tab==='Todos' || l===tab);

  const toLesson = (l: LessonFromAPI): Lesson => ({
    id:l.id, title:l.title, desc:l.description,
    level:apiLevelToLabel(l.level),
    dur:l.duration, mods:l.modules, locked:l.locked,
  });

  return (
    <div className="anim-fade-up" style={{ height:'100%',display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'12px 14px',borderBottom:'1px solid var(--bdr)',display:'flex',gap:8,background:'var(--bg2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 14px',borderRadius:20,cursor:'pointer',fontSize:12.5,fontWeight:600,fontFamily:'inherit',transition:'.15s',background:tab===t?(LCOLORS[t]||'var(--teal)'):'var(--card)',color:tab===t?'#040D14':'var(--t2)',border:tab===t?'none':'1px solid var(--bdr)' }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ flex:1,overflowY:'auto',padding:'14px',display:'flex',flexDirection:'column',gap:10 }}>
        {levels.map(level => {
          const levelLessons = lessons.filter(l => apiLevelToLabel(l.level) === level);
          if (levelLessons.length === 0) return null;
          return (
            <div key={level}>
              {tab==='Todos' && (
                <div style={{ fontWeight:700,fontSize:13,color:LCOLORS[level],marginBottom:9,display:'flex',alignItems:'center',gap:7 }}>
                  <div style={{ width:3,height:14,borderRadius:2,background:LCOLORS[level],flexShrink:0 }}/>
                  {level}
                </div>
              )}
              {levelLessons.map(lesson => {
                const prog = getForLesson(lesson.id);
                return (
                  <div key={lesson.id} className="glass" style={{ padding:'14px 15px',marginBottom:10,cursor:lesson.locked?'not-allowed':'pointer',opacity:lesson.locked?0.68:1 }}
                    onClick={()=>!lesson.locked&&nav('lesson', toLesson(lesson))}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10 }}>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:4 }}>
                          <div style={{ fontWeight:700,fontSize:13.5,color:lesson.locked?'var(--t3)':'var(--t1)' }}>{lesson.title}</div>
                          {prog.completed && <span style={{ fontSize:13 }}>✅</span>}
                          {lesson.locked   && <span style={{ fontSize:13 }}>🔒</span>}
                        </div>
                        <div style={{ fontSize:12,color:'var(--t3)',marginBottom:9,lineHeight:1.45 }}>{lesson.description}</div>
                        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:prog.progress>0?9:0 }}>
                          <span style={{ fontSize:11,color:'var(--t3)' }}>⏱ {lesson.duration} min</span>
                          <span style={{ fontSize:11,color:'var(--t3)' }}>📋 {lesson.modules} módulos</span>
                          <span className="tag" style={{ background:`${LCOLORS[level]}18`,color:LCOLORS[level],fontSize:10 }}>{level}</span>
                        </div>
                        {prog.progress>0 && <PBar pct={prog.progress} height={5}/>}
                      </div>
                      {!lesson.locked && (
                        <div style={{ width:34,height:34,borderRadius:9,background:`${LCOLORS[level]}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>
                          {prog.completed?'✅':prog.progress>0?'▶':'▷'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {tab==='Todos' && <div style={{ height:4 }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
