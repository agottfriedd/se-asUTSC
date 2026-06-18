import { useState, useEffect } from 'react';
import { api, apiLevelToLabel } from '../lib/api';
import type { LessonFromAPI } from '../lib/api';
import type { UserProfile, AppView, Lesson, LessonProgress } from '../types';
import { StatCard, PBar } from '../components/UI';

interface Props {
  user: UserProfile;
  nav:  (view: AppView, payload?: Lesson) => void;
  getForLesson: (id: number) => LessonProgress;
  globalProgress: number;
}

export function DashboardView({ user, nav, getForLesson, globalProgress }: Props) {
  const [lessons, setLessons] = useState<LessonFromAPI[]>([]);

  useEffect(() => {
    api.lessons.getAll().then(setLessons).catch(()=>{});
  }, []);

  const completedCount = lessons.filter(l => getForLesson(l.id).completed).length;
  const inProgress     = lessons.filter(l => { const p=getForLesson(l.id); return p.progress>0&&!p.completed; });
  const nextUp         = lessons.filter(l => !getForLesson(l.id).completed&&!l.locked&&getForLesson(l.id).progress===0).slice(0,2);
  const shown          = [...inProgress,...nextUp].slice(0,3);

  return (
    <div className="anim-fade-up" style={{ overflowY:'auto',height:'100%',padding:20 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:21,fontWeight:800,marginBottom:3 }}>Hola, <span className="gradient-text">{user.name.split(' ')[0]}</span> 👋</div>
        <div style={{ fontSize:13,color:'var(--t3)' }}>🔥 Racha de {user.streak} días. ¡Sigue así!</div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginBottom:18 }}>
        <StatCard icon="🔥" value={`${user.streak}d`}        label="Racha actual"   color="#F5A623"/>
        <StatCard icon="🎯" value={`${globalProgress}%`}     label="Progreso total" color="#0ED2B8"/>
        <StatCard icon="✅" value={completedCount}            label="Completadas"    color="#22C97E"/>
        <StatCard icon="🏆" value={user.badges}              label="Insignias"      color="#9D7BF8"/>
      </div>
      <div className="glass" style={{ padding:16,marginBottom:18 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9 }}>
          <div style={{ fontWeight:700,fontSize:13.5 }}>Progreso general</div>
          <div style={{ fontSize:13,color:'var(--teal)',fontWeight:700 }}>{globalProgress}%</div>
        </div>
        <PBar pct={globalProgress} height={9}/>
        <div style={{ fontSize:11.5,color:'var(--t3)',marginTop:7 }}>
          {completedCount} de {lessons.length} lecciones completadas · Nivel: <span style={{ color:'var(--teal)' }}>{user.level}</span>
        </div>
      </div>
      {shown.length > 0 && (
        <div style={{ marginBottom:18 }}>
          <div style={{ fontWeight:700,fontSize:14,marginBottom:12 }}>Continuar aprendiendo</div>
          <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
            {shown.map(l => {
              const prog = getForLesson(l.id);
              return (
                <div key={l.id} className="glass" style={{ padding:'13px 15px',cursor:'pointer' }}
                  onClick={()=>nav('lesson',{id:l.id,title:l.title,desc:l.description,level:apiLevelToLabel(l.level),dur:l.duration,mods:l.modules,locked:l.locked})}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                    <div style={{ flex:1,minWidth:0,marginRight:8 }}>
                      <div style={{ fontWeight:600,fontSize:13.5 }}>{l.title}</div>
                      <div style={{ fontSize:11.5,color:'var(--t3)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{l.description}</div>
                    </div>
                    <span style={{ color:'var(--t3)',fontSize:18,flexShrink:0 }}>›</span>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ flex:1 }}><PBar pct={prog.progress}/></div>
                    <span style={{ fontSize:11,color:'var(--t3)',fontWeight:600,minWidth:28 }}>{prog.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <div style={{ fontWeight:700,fontSize:14,marginBottom:12 }}>Acceso rápido</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          {[{icon:'📖',label:'Diccionario',sub:`${lessons.length ? '35' : '—'} señas`,v:'dictionary' as AppView},
            {icon:'🎓',label:'Lecciones',sub:`${lessons.length} módulos`,v:'lessons' as AppView}].map(({icon,label,sub,v})=>(
            <div key={v} className="glass" style={{ padding:16,cursor:'pointer',textAlign:'center' }} onClick={()=>nav(v)}>
              <div style={{ fontSize:24,marginBottom:7 }}>{icon}</div>
              <div style={{ fontWeight:600,fontSize:13.5 }}>{label}</div>
              <div style={{ fontSize:11,color:'var(--t3)',marginTop:3 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
