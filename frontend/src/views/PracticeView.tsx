import { useRef, useEffect, useState, useCallback } from 'react';
import type { RecognitionResult } from '../types';

/* ================================================================
   CLASIFICADOR LSM v2 — Algebra vectorial en el navegador
   Mismo algoritmo que el servicio Python (classifier.py)
   ================================================================ */
type Pt = { x: number; y: number; z: number };

const norm = (v: [number,number,number]): [number,number,number] => {
  const n = Math.sqrt(v[0]**2+v[1]**2+v[2]**2) || 1e-8;
  return [v[0]/n, v[1]/n, v[2]/n];
};
const dot  = (a:[number,number,number], b:[number,number,number]) =>
  a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub  = (a:Pt, b:Pt): [number,number,number] => [a.x-b.x, a.y-b.y, a.z-b.z];
const dist = (a:Pt, b:Pt) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2);
const dot3 = (v:[number,number,number], a:Pt, b:Pt) => dot(v, sub(b,a));

function extractFeatures(lm: Pt[]) {
  const palmUp  = norm(sub(lm[0], lm[9]).map(v=>-v) as [number,number,number]);
  // palm up = wrist(0) → middle_mcp(9)
  const pu = norm([lm[9].x-lm[0].x, lm[9].y-lm[0].y, lm[9].z-lm[0].z]);
  const pl = norm([lm[5].x-lm[17].x, lm[5].y-lm[17].y, lm[5].z-lm[17].z]);
  const palmSize = dist(lm[0], lm[9]) || 1;

  const joints: Record<string,[number,number,number,number]> = {
    thumb:[1,2,3,4], index:[5,6,7,8], middle:[9,10,11,12], ring:[13,14,15,16], pinky:[17,18,19,20]
  };

  const ext: Record<string,number> = {};
  for (const [name,[mi,pi,,ti]] of Object.entries(joints)) {
    const mcp=lm[mi], pip=lm[pi], tip=lm[ti];
    const v1=norm([pip.x-mcp.x, pip.y-mcp.y, pip.z-mcp.z]);
    const v2=norm([tip.x-pip.x, tip.y-pip.y, tip.z-pip.z]);
    const cosPip = Math.max(-1, Math.min(1, dot(v1,v2)));
    const elevation = ([tip.x-mcp.x, tip.y-mcp.y, tip.z-mcp.z] as [number,number,number])
      .reduce((s,v,i) => s + v*pu[i], 0) / palmSize;
    ext[name] = Math.max(0, Math.min(1, ((cosPip+1)/2) * Math.max(0, elevation)));
  }

  const pc = { x:(lm[5].x+lm[9].x+lm[13].x+lm[17].x)/4, y:(lm[5].y+lm[9].y+lm[13].y+lm[17].y)/4, z:(lm[5].z+lm[9].z+lm[13].z+lm[17].z)/4 };
  const thumbSide    = ([lm[4].x-lm[0].x,lm[4].y-lm[0].y,lm[4].z-lm[0].z] as [number,number,number]).reduce((s,v,i)=>s+v*pl[i],0)/palmSize;
  const thumbUp2     = ([lm[4].x-lm[0].x,lm[4].y-lm[0].y,lm[4].z-lm[0].z] as [number,number,number]).reduce((s,v,i)=>s+v*pu[i],0)/palmSize;
  const thumbFwd     = ([lm[4].x-pc.x,lm[4].y-pc.y,lm[4].z-pc.z] as [number,number,number]).reduce((s,v,i)=>s+v*pu[i],0)/palmSize;

  const v_i1 = norm([lm[6].x-lm[5].x, lm[6].y-lm[5].y, lm[6].z-lm[5].z]);
  const v_i2 = norm([lm[7].x-lm[6].x, lm[7].y-lm[6].y, lm[7].z-lm[6].z]);
  const indexPipCos = Math.max(-1, Math.min(1, dot(v_i1, v_i2)));

  return {
    ext,
    thumbSide,
    thumbUp:       thumbUp2,
    thumbForward:  thumbFwd,
    dThumbIndex:   dist(lm[4], lm[8])  / palmSize,
    dThumbMiddle:  dist(lm[4], lm[12]) / palmSize,
    dIndexMiddle:  dist(lm[8], lm[12]) / palmSize,
    spanTips:      dist(lm[8], lm[20]) / palmSize,
    indexPipCos,
    palmSize,
  };
}

function classifyLSM(lm: Pt[]): RecognitionResult {
  if (lm.length < 21) return { letter:'?', confidence:0 };
  const f = extractFeatures(lm);
  const e = f.ext;

  const EXT=0.55, FOLD=0.30;
  const g = {
    idx: e.index>EXT, mid: e.middle>EXT, rng: e.ring>EXT, pky: e.pinky>EXT,
    idx_f: e.index<FOLD, mid_f: e.middle<FOLD, rng_f: e.ring<FOLD, pky_f: e.pinky<FOLD,
    idx_b: e.index>FOLD&&e.index<EXT, mid_b: e.middle>FOLD&&e.middle<EXT,
    rng_b: e.ring>FOLD&&e.ring<EXT,
    thumbAbducted: f.thumbSide   >  0.35,
    thumbUp:       f.thumbUp     >  0.45,
    thumbOver:     f.thumbForward < -0.15,
    thumbTouchIdx: f.dThumbIndex  <  0.35,
    thumbTouchMid: f.dThumbMiddle <  0.35,
    idxMidClose:   f.dIndexMiddle <  0.18,
    idxMidSpread:  f.dIndexMiddle >  0.28,
    indexHooked:   f.indexPipCos  <  0.30,
  };

  let letter='?', base=0.25;

  // Puño (ningun dedo extendido)
  if (g.idx_f && g.mid_f && g.rng_f && g.pky_f) {
    if (g.thumbOver)                          { letter='S'; base=0.90; }
    else if (f.dThumbIndex < 0.20)            { letter='T'; base=0.85; }
    else if (g.thumbAbducted && g.thumbUp)    { letter='A'; base=0.87; }
    else                                      { letter='A'; base=0.80; }
  }
  // Solo índice
  else if (g.idx && g.mid_f && g.rng_f && g.pky_f) {
    if (g.thumbAbducted && g.thumbUp)         { letter='L'; base=0.93; }
    else if (g.thumbAbducted)                 { letter='G'; base=0.86; }
    else if (g.indexHooked)                   { letter='X'; base=0.82; }
    else                                      { letter='D'; base=0.88; }
  }
  // Solo meñique
  else if (g.idx_f && g.mid_f && g.rng_f && g.pky) {
    if (g.thumbAbducted && g.thumbUp)         { letter='Y'; base=0.93; }
    else                                      { letter='I'; base=0.91; }
  }
  // Índice + meñique
  else if (g.idx && g.mid_f && g.rng_f && g.pky) { letter='P'; base=0.86; }
  // Índice + medio
  else if (g.idx && g.mid && g.rng_f && g.pky_f) {
    if (g.thumbAbducted)                      { letter='K'; base=0.87; }
    else if (g.idxMidClose)                   { letter='U'; base=0.89; }
    else if (g.idxMidSpread)                  { letter='V'; base=0.89; }
    else                                      { letter='H'; base=0.81; }
  }
  // Índice + medio + anular
  else if (g.idx && g.mid && g.rng && g.pky_f) { letter='W'; base=0.88; }
  // Todos extendidos
  else if (g.idx && g.mid && g.rng && g.pky)   { letter='B'; base=0.91; }
  else {
    const allBent = e.index>FOLD&&e.index<EXT && e.middle>FOLD&&e.middle<EXT &&
                    e.ring>FOLD&&e.ring<EXT;
    const allLow  = Object.values(e).every((v,i) => i>0 ? true : true) &&
                    e.index<0.62 && e.middle<0.62 && e.ring<0.62 && e.pinky<0.62;

    if (allBent && f.dThumbIndex < 0.28)      { letter='O'; base=0.85; }
    else if (allBent)                          { letter='C'; base=0.81; }
    else if (allLow && g.thumbTouchIdx)        { letter='F'; base=0.79; }
    else if (allLow && e.index<0.45 && e.middle<0.45) {
      if (g.thumbOver)                         { letter='S'; base=0.75; }
      else                                     { letter='E'; base=0.77; }
    }
    else if (g.indexHooked && g.mid_f && g.rng_f && g.pky_f) { letter='X'; base=0.83; }
    else {
      const n = [g.idx,g.mid,g.rng,g.pky].filter(Boolean).length;
      const fb = ['?','D','U','W','B'][n] || '?';
      const fc = [0.25,0.52,0.48,0.48,0.55][n] || 0.25;
      letter=fb; base=fc;
    }
  }

  const sizeOk = Math.min(1.0, f.palmSize / 0.12);
  return { letter, confidence: Math.round(base * sizeOk * 100) / 100 };
}

/* ================================================================
   COMPONENTE REACT
   ================================================================ */
declare global {
  interface Window {
    Hands: new(cfg:{locateFile:(f:string)=>string})=>{
      setOptions:(o:object)=>void;
      onResults:(cb:(r:{multiHandLandmarks?:Pt[][]})=>void)=>void;
      send:(i:{image:HTMLVideoElement})=>Promise<void>;
    };
    drawConnectors:(ctx:CanvasRenderingContext2D,lm:Pt[],c:unknown[],s:object)=>void;
    drawLandmarks: (ctx:CanvasRenderingContext2D,lm:Pt[],s:object)=>void;
    HAND_CONNECTIONS: unknown[];
  }
}

const SIGN_DESCRIPTIONS: Record<string,string> = {
  A:'Puño, pulgar al costado', B:'Mano plana, dedos juntos',
  C:'Curva en C', D:'Solo índice arriba', E:'Todos doblados',
  F:'Índice+pulgar tocándose', G:'Índice lateral', H:'2 dedos horizontal',
  I:'Solo meñique', K:'V con pulgar', L:'Forma de L',
  M:'3 dedos sobre pulgar', N:'2 dedos sobre pulgar', O:'Círculo cerrado',
  P:'Índice+meñique abajo', R:'Índice+medio cruzados', S:'Puño+pulgar encima',
  T:'Pulgar entre índice+medio', U:'Índice+medio juntos', V:'Paz ✌️',
  W:'3 dedos separados', X:'Índice enganchado', Y:'Shaka 🤙', Z:'Índice traza Z',
};

export function PracticeView() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const handsRef  = useRef<ReturnType<typeof window.Hands>|null>(null);

  const [result,  setResult]  = useState<RecognitionResult|null>(null);
  const [running, setRunning] = useState(false);
  const [loaded,  setLoaded]  = useState(false);
  const [error,   setError]   = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [lastLetter, setLastLetter] = useState('');
  const [sameCount,  setSameCount]  = useState(0);

  useEffect(() => {
    const load = (src:string) => new Promise<void>((res,rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s=document.createElement('script'); s.src=src; s.crossOrigin='anonymous';
      s.onload=()=>res(); s.onerror=()=>rej(); document.head.appendChild(s);
    });
    Promise.all([
      load('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'),
      load('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'),
    ]).then(()=>setLoaded(true)).catch(()=>setError('No se pudo cargar MediaPipe. Verifica tu conexión.'));
  }, []);

  const startCamera = useCallback(async () => {
    if (!loaded) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{width:640,height:480,facingMode:'user'}
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      handsRef.current = new window.Hands({
        locateFile: (f:string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
      });
      handsRef.current.setOptions({
        maxNumHands:1, modelComplexity:1,
        minDetectionConfidence:0.72, minTrackingConfidence:0.55
      });
      handsRef.current.onResults(results => {
        const canvas=canvasRef.current; const video=videoRef.current;
        if (!canvas||!video) return;
        const ctx=canvas.getContext('2d')!;
        canvas.width=video.videoWidth; canvas.height=video.videoHeight;
        ctx.save(); ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(video,0,0);

        if (results.multiHandLandmarks?.length) {
          const lm=results.multiHandLandmarks[0];
          window.drawConnectors(ctx,lm,window.HAND_CONNECTIONS,{color:'#0ED2B8',lineWidth:2});
          window.drawLandmarks(ctx,lm,{color:'#9D7BF8',radius:3,fillColor:'#9D7BF8'});
          const prediction=classifyLSM(lm);
          setResult(prediction);
          // Solo agregar al historial si la misma letra aparece 3 veces seguidas
          if (prediction.confidence>0.72 && prediction.letter!=='?') {
            setLastLetter(prev => {
              if (prev===prediction.letter) {
                setSameCount(c => {
                  if (c>=2) {
                    setHistory(h=>[prediction.letter,...h].slice(0,12));
                    return 0;
                  }
                  return c+1;
                });
              } else {
                setSameCount(1);
              }
              return prediction.letter;
            });
          }
        } else {
          setResult(null);
        }
        ctx.restore();
      });

      setRunning(true);
      const loop=async()=>{
        if (videoRef.current && handsRef.current) {
          await handsRef.current.send({image:videoRef.current});
        }
        rafRef.current=requestAnimationFrame(loop);
      };
      rafRef.current=requestAnimationFrame(loop);
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    }
  }, [loaded]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());
      videoRef.current.srcObject=null;
    }
    setRunning(false); setResult(null);
  }, []);

  useEffect(()=>()=>stopCamera(),[stopCamera]);

  const confPct   = result ? Math.round(result.confidence*100) : 0;
  const confColor = confPct>=80?'#22C97E':confPct>=60?'#F5A623':'#F05050';

  return (
    <div className="anim-fade-up" style={{height:'100%',overflowY:'auto',padding:20}}>
      <div style={{maxWidth:720,margin:'0 auto'}}>
        <div style={{marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Práctica con <span className="gradient-text">cámara</span> 📷</div>
          <div style={{fontSize:13,color:'var(--t3)',lineHeight:1.5}}>
            Coloca tu mano frente a la cámara y ejecuta una seña del abecedario LSM.
            El sistema detecta y mantiene una seña estable 3 frames antes de registrarla.
          </div>
        </div>

        {/* Área de cámara */}
        <div style={{position:'relative',borderRadius:16,overflow:'hidden',background:'var(--bg3)',border:'1px solid var(--bdr)',aspectRatio:'4/3',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <video ref={videoRef} style={{display:'none'}} playsInline muted/>
          <canvas ref={canvasRef} style={{width:'100%',height:'100%',objectFit:'cover',display:running?'block':'none'}}/>
          {!running && (
            <div style={{textAlign:'center',padding:32}}>
              <div style={{fontSize:48,marginBottom:12}}>📷</div>
              <div style={{fontWeight:600,marginBottom:8}}>{!loaded?'Cargando MediaPipe…':'Cámara inactiva'}</div>
              <div style={{fontSize:12,color:'var(--t3)',marginBottom:20}}>
                {!loaded?'Descargando modelo de detección de manos (~5 MB)…':'Activa la cámara para comenzar'}
              </div>
              {loaded && <button className="btn-primary" onClick={startCamera}>Activar cámara</button>}
            </div>
          )}

          {/* Resultado overlay */}
          {running && result && result.letter!=='?' && (
            <div style={{position:'absolute',top:12,right:12,background:'rgba(8,13,26,.88)',backdropFilter:'blur(10px)',borderRadius:14,padding:'12px 18px',border:`1.5px solid ${confColor}40`,minWidth:80,textAlign:'center'}}>
              <div style={{fontSize:48,fontWeight:900,color:confColor,lineHeight:1}}>{result.letter}</div>
              <div style={{fontSize:11,color:confColor,fontWeight:600,marginTop:4}}>{confPct}% confianza</div>
              {SIGN_DESCRIPTIONS[result.letter] && (
                <div style={{fontSize:10,color:'var(--t3)',marginTop:3,maxWidth:120}}>{SIGN_DESCRIPTIONS[result.letter]}</div>
              )}
            </div>
          )}

          {/* Sin mano detectada */}
          {running && (!result || result.letter==='?') && (
            <div style={{position:'absolute',top:12,left:12,background:'rgba(8,13,26,.7)',borderRadius:10,padding:'6px 12px',fontSize:12,color:'var(--t3)'}}>
              Sin mano detectada
            </div>
          )}

          {/* Barra de confianza */}
          {running && result && (
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:5,background:'rgba(0,0,0,.4)'}}>
              <div style={{height:'100%',width:`${confPct}%`,background:confColor,transition:'width .15s,background .15s'}}/>
            </div>
          )}
        </div>

        {error && (
          <div style={{padding:'10px 14px',borderRadius:10,marginBottom:14,background:'rgba(240,80,80,.1)',border:'1px solid rgba(240,80,80,.25)',fontSize:13,color:'var(--red)'}}>
            ⚠️ {error}
          </div>
        )}

        <div style={{display:'flex',gap:10,marginBottom:20}}>
          {running
            ? <button className="btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={stopCamera}>⏹ Detener</button>
            : <button className="btn-primary" style={{flex:1,justifyContent:'center'}} onClick={startCamera} disabled={!loaded}>
                {loaded?'▶ Iniciar práctica':'⏳ Cargando…'}
              </button>
          }
          <button className="btn-ghost" onClick={()=>setHistory([])}>Limpiar</button>
        </div>

        {/* Historial */}
        {history.length>0 && (
          <div className="glass" style={{padding:'16px',marginBottom:20}}>
            <div style={{fontWeight:700,fontSize:13.5,marginBottom:10}}>Señas detectadas (estabilizadas)</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
              {history.map((l,i)=>(
                <div key={i} style={{width:42,height:42,borderRadius:10,background:'var(--teal-d)',border:'1px solid var(--teal-b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'var(--teal)'}}>
                  {l}
                </div>
              ))}
            </div>
            <div style={{fontSize:12,color:'var(--t3)'}}>
              Deletreado: <strong style={{color:'var(--teal)',fontSize:14}}>{history.join('')}</strong>
            </div>
          </div>
        )}

        {/* Guía rápida */}
        <div className="glass" style={{padding:16,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:13.5,marginBottom:12}}>📋 Señas con mayor precisión</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
            {[['A','Puño, pulgar al costado'],['B','Mano plana abierta'],['D','Solo índice arriba'],
              ['I','Solo meñique arriba'],['L','L con índice+pulgar'],['O','Círculo con todos'],
              ['S','Puño+pulgar encima'],['U','Índice+medio juntos'],['V','✌️ Índice+medio abiertos'],
              ['Y','🤙 Meñique+pulgar'],['W','3 dedos separados'],['B','Todos extendidos'],
            ].map(([l,d])=>(
              <div key={l+d} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:7,background:'var(--teal-d)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'var(--teal)',flexShrink:0}}>{l}</div>
                <div style={{fontSize:11,color:'var(--t3)'}}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass" style={{padding:16}}>
          <div style={{fontWeight:700,fontSize:13.5,marginBottom:10}}>💡 Consejos para mejor precisión</div>
          {['Fondo uniforme claro (pared blanca) detrás de tu mano.',
            'Buena iluminación frontal — no contraluces.',
            'Mano a 40–60 cm de la cámara, completamente visible.',
            'Mueve la mano despacio entre señas.',
            'La palma debe estar orientada hacia la cámara.',
            'El sistema requiere 3 frames estables antes de registrar — ¡mantén la seña!',
          ].map((t,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:6,fontSize:12.5,color:'var(--t2)'}}>
              <span style={{color:'var(--teal)',flexShrink:0}}>→</span>{t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
