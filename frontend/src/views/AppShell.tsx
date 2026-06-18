import { useCallback, useState } from 'react';
import type { UserProfile, AppView, Lesson } from '../types';
import { useProgress } from '../hooks/useProgress';
import { DashboardView }    from './DashboardView';
import { DictionaryView }   from './DictionaryView';
import { LessonsView }      from './LessonsView';
import { LessonDetailView } from './LessonDetailView';
import { ProfileView }      from './ProfileView';
import { PracticeView }     from './PracticeView';
import { AdminView }        from './AdminView';

interface Props { user: UserProfile; onLogout: () => void; }

const NAV = [
  {id:'dashboard'  as AppView, label:'Inicio',      e:'🏠'},
  {id:'dictionary' as AppView, label:'Diccionario', e:'📖'},
  {id:'lessons'    as AppView, label:'Lecciones',   e:'🎓'},
  {id:'practice'   as AppView, label:'Práctica ML', e:'📷'},
  {id:'profile'    as AppView, label:'Mi perfil',   e:'👤'},
];
const TITLES: Record<AppView, string> = {
  dashboard:'Inicio', dictionary:'Diccionario LSM', lessons:'Lecciones',
  lesson:'', practice:'Práctica con cámara', profile:'Mi perfil', admin:'Administración',
};
const SUBS: Record<AppView, string> = {
  dashboard:'Tu progreso de hoy', dictionary:'Señas cargadas desde la base de datos',
  lessons:'Lecciones desde la base de datos', lesson:'Contenido interactivo',
  practice:'Reconocimiento en tiempo real · MediaPipe', profile:'Tu cuenta y logros',
  admin:'Panel de administración',
};
const LCOLORS: Record<string,string> = {Básico:'#0ED2B8',Intermedio:'#9D7BF8',Avanzado:'#F5A623'};

export function AppShell({ user, onLogout }: Props) {
  const [view,   setView]   = useState<AppView>('dashboard');
  const [lesson, setLesson] = useState<Lesson|null>(null);
  const { saveProgress, getForLesson, globalProgress } = useProgress(user.uid);

  const nav = useCallback((dest: AppView, payload?: Lesson) => {
    if (dest==='lesson'&&payload) setLesson(payload);
    setView(dest);
  }, []);

  const initials = user.initials ||
    user.name.split(' ').filter(Boolean).map(n=>n[0]).join('').toUpperCase().slice(0,2);

  return (
    <div style={{ display:'flex',height:'100vh',overflow:'hidden',background:'var(--bg)' }}>
      <aside style={{ width:220,flexShrink:0,background:'var(--bg2)',borderRight:'1px solid var(--bdr)',display:'flex',flexDirection:'column',padding:'10px 9px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:9,padding:'8px 10px',marginBottom:14 }}>
          <div style={{ width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#0ED2B8,#07A898)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#040D14',fontWeight:900,flexShrink:0 }}>S</div>
          <div>
            <div style={{ fontWeight:800,fontSize:13.5,lineHeight:1,letterSpacing:-0.3 }}>SeñasUTSCMX</div>
            <div style={{ fontSize:9.5,color:'var(--t3)',marginTop:1 }}>UTSC · 2026</div>
          </div>
        </div>
        <nav style={{ flex:1,display:'flex',flexDirection:'column',gap:2 }}>
          {NAV.map(({id,label,e})=>(
            <button key={id} className={`nav-item ${(view===id||(view==='lesson'&&id==='lessons'))?'active':''}`} onClick={()=>nav(id)}>
              <span style={{ fontSize:16 }}>{e}</span> {label}
            </button>
          ))}
          {user.role==='admin' && (
            <button className={`nav-item ${view==='admin'?'active':''}`} onClick={()=>nav('admin')}>
              <span style={{ fontSize:16 }}>⚙️</span> Admin
              <span style={{ fontSize:10,background:'var(--amb-d)',color:'var(--amb)',padding:'1px 6px',borderRadius:4,marginLeft:'auto',fontWeight:700 }}>admin</span>
            </button>
          )}
        </nav>
        <div style={{ borderTop:'1px solid var(--bdr)',paddingTop:8,marginTop:6 }}>
          <div style={{ display:'flex',alignItems:'center',gap:9,padding:'8px 10px' }}>
            <div style={{ width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#0ED2B8,#9D7BF8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#040D14',flexShrink:0 }}>{initials}</div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.name.split(' ')[0]} {user.name.split(' ').slice(-1)[0]}</div>
              <div style={{ fontSize:10,color:'var(--t3)' }}>🔥 {user.streak}d · {globalProgress}%</div>
            </div>
          </div>
          <button className="nav-item" onClick={onLogout} style={{ color:'var(--red)',width:'100%' }}>
            <span style={{ fontSize:15 }}>🚪</span> Salir
          </button>
        </div>
      </aside>
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
        <header style={{ padding:'12px 18px',borderBottom:'1px solid var(--bdr)',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:700,fontSize:15 }}>{view==='lesson'?lesson?.title:TITLES[view]}</div>
            <div style={{ fontSize:11,color:'var(--t3)',marginTop:1 }}>
              {view==='lesson'&&lesson
                ? <span className="tag" style={{ background:`${LCOLORS[lesson.level]||'var(--teal)'}18`,color:LCOLORS[lesson.level]||'var(--teal)',fontSize:10 }}>{lesson.level}</span>
                : SUBS[view]}
            </div>
          </div>
          <div style={{ background:'var(--amb-d)',border:'1px solid rgba(245,166,35,.22)',borderRadius:8,padding:'4px 10px',display:'flex',alignItems:'center',gap:5 }}>
            <span style={{ fontSize:13 }}>🔥</span>
            <span style={{ fontSize:12,fontWeight:700,color:'var(--amb)' }}>{user.streak}</span>
          </div>
        </header>
        <main style={{ flex:1,overflow:'hidden' }}>
          {view==='dashboard'  && <DashboardView user={user} nav={nav} getForLesson={getForLesson} globalProgress={globalProgress}/>}
          {view==='dictionary' && <DictionaryView uid={user.uid}/>}
          {view==='lessons'    && <LessonsView nav={nav} getForLesson={getForLesson}/>}
          {view==='lesson'&&lesson && <LessonDetailView lesson={lesson} onBack={()=>setView('lessons')} onProgress={saveProgress}/>}
          {view==='practice'   && <PracticeView/>}
          {view==='profile'    && <ProfileView user={{...user,progress:globalProgress}} onLogout={onLogout}/>}
          {view==='admin'&&user.role==='admin' && <AdminView adminUser={user}/>}
        </main>
      </div>
    </div>
  );
}
