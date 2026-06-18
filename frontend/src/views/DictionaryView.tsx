import { useState, useEffect, useMemo } from 'react';
import { api, apiLevelToLabel } from '../lib/api';
import type { SignFromAPI } from '../lib/api';
import type { HandConfig } from '../types';
import { HandSVG } from '../components/HandSVG';

const CATS = ['Todos','Abecedario','Saludos','Respuestas','Frases útiles','Especiales'] as const;

interface Props { uid?: string; }

export function DictionaryView({ uid: _ }: Props) {
  const [signs,    setSigns]    = useState<SignFromAPI[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [q,        setQ]        = useState('');
  const [cat,      setCat]      = useState('Todos');
  const [liked,    setLiked]    = useState<Record<string,boolean>>({});
  const [selected, setSelected] = useState<string|null>(null);

  useEffect(() => {
    api.dictionary.getAll()
      .then(data => { setSigns(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    signs.filter(s => {
      const matchQ = s.name.toLowerCase().includes(q.toLowerCase()) ||
                     s.description.toLowerCase().includes(q.toLowerCase());
      const matchC = cat === 'Todos' || s.category === cat;
      return matchQ && matchC;
    }), [signs, q, cat]);

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32,marginBottom:10 }}>⏳</div>
        <div>Cargando diccionario…</div>
      </div>
    </div>
  );

  return (
    <div className="anim-fade-up" style={{ height:'100%',display:'flex',flexDirection:'column' }}>
      {/* Search + filters */}
      <div style={{ padding:'14px 16px',borderBottom:'1px solid var(--bdr)',background:'var(--bg2)' }}>
        <div style={{ position:'relative',marginBottom:12 }}>
          <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:15,color:'var(--t3)' }}>🔍</span>
          <input className="input-field" style={{ paddingLeft:36 }} placeholder="Buscar seña o descripción…" value={q} onChange={e=>setQ(e.target.value)}/>
          {q && <button onClick={()=>setQ('')} style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:18 }}>×</button>}
        </div>
        <div style={{ display:'flex',gap:7,overflowX:'auto',paddingBottom:2 }}>
          {CATS.map(c => (
            <button key={c} onClick={()=>setCat(c)} style={{ flexShrink:0,padding:'5px 13px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit',transition:'.15s',background:cat===c?'var(--teal)':'var(--card)',color:cat===c?'#040D14':'var(--t2)',border:cat===c?'1px solid var(--teal)':'1px solid var(--bdr)' }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:'8px 16px',fontSize:11.5,color:'var(--t3)',borderBottom:'1px solid var(--bdr)',background:'var(--bg2)' }}>
        {filtered.length} seña{filtered.length!==1?'s':''} · {signs.length} en total
      </div>
      {/* Grid */}
      <div style={{ flex:1,overflowY:'auto',padding:14 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center',padding:'40px 20px',color:'var(--t3)' }}>
            <div style={{ fontSize:32,marginBottom:12 }}>🤷</div>
            <div style={{ fontWeight:600 }}>No se encontraron señas</div>
          </div>
        ) : (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:11 }}>
            {filtered.map(s => (
              <div key={s.id} className="sign-card" style={{ border:selected===s.id?`1.5px solid ${s.color}`:'1px solid var(--bdr)',boxShadow:selected===s.id?`0 0 0 3px ${s.color}18`:undefined }} onClick={()=>setSelected(p=>p===s.id?null:s.id)}>
                <div style={{ padding:'14px 12px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,background:`${s.color}08` }}>
                  {s.handConfig
                    ? <HandSVG config={s.handConfig as HandConfig} color={s.color} size={56}/>
                    : <div style={{ width:56,height:66,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:900,color:s.color,background:`${s.color}14`,borderRadius:12 }}>{s.letter}</div>
                  }
                </div>
                <div style={{ padding:'8px 10px 12px' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                    <div style={{ fontWeight:700,fontSize:15,color:s.color }}>{s.name}</div>
                    <button onClick={e=>{e.stopPropagation();setLiked(l=>({...l,[s.id]:!l[s.id]}));}} style={{ background:'none',border:'none',cursor:'pointer',fontSize:14,padding:2 }}>
                      {liked[s.id]?'❤️':'🤍'}
                    </button>
                  </div>
                  <span className="tag" style={{ background:`${s.color}18`,color:s.color,fontSize:10,marginBottom:5 }}>{s.category}</span>
                  <div style={{ fontSize:11,color:'var(--t3)',lineHeight:1.45,marginTop:5 }}>{s.description}</div>
                  {s.tip && selected===s.id && <div style={{ fontSize:11,color:'var(--teal)',marginTop:6,padding:'5px 8px',background:'var(--teal-d)',borderRadius:6 }}>💡 {s.tip}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
