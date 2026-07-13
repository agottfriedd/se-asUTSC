import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import type { Lesson, ContentBlock } from '../types';
import { PBar } from '../components/UI';

// ── Tipos MediaPipe ─────────────────────────────────────────────────
type Pt = { x: number; y: number; z: number };

interface HandsInstance {
  setOptions: (o: object) => void;
  onResults: (cb: (r: { multiHandLandmarks?: Pt[][] }) => void) => void;
  send: (i: { image: HTMLVideoElement }) => Promise<void>;
}

declare global {
  interface Window {
    Hands: new(cfg: { locateFile: (f: string) => string }) => HandsInstance;
    drawConnectors: (ctx: CanvasRenderingContext2D, lm: Pt[], c: unknown[], s: object) => void;
    drawLandmarks:  (ctx: CanvasRenderingContext2D, lm: Pt[], s: object) => void;
    HAND_CONNECTIONS: unknown[];
  }
}

// ── Clasificador LSM (mismo que PracticeView) ───────────────────────
const norm = (v: [number,number,number]): [number,number,number] => {
  const n = Math.sqrt(v[0]**2+v[1]**2+v[2]**2) || 1e-8;
  return [v[0]/n, v[1]/n, v[2]/n];
};
const dot  = (a:[number,number,number], b:[number,number,number]) =>
  a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const dist = (a:Pt, b:Pt) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2);

function classifyLSM(lm: Pt[]): { letter: string; confidence: number } {
  if (lm.length < 21) return { letter:'?', confidence:0 };
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
  const thumbSide = ([lm[4].x-lm[0].x,lm[4].y-lm[0].y,lm[4].z-lm[0].z] as [number,number,number]).reduce((s,v,i)=>s+v*pl[i],0)/palmSize;
  const thumbUp2  = ([lm[4].x-lm[0].x,lm[4].y-lm[0].y,lm[4].z-lm[0].z] as [number,number,number]).reduce((s,v,i)=>s+v*pu[i],0)/palmSize;
  const thumbFwd  = ([lm[4].x-pc.x,lm[4].y-pc.y,lm[4].z-pc.z] as [number,number,number]).reduce((s,v,i)=>s+v*pu[i],0)/palmSize;
  const v_i1 = norm([lm[6].x-lm[5].x, lm[6].y-lm[5].y, lm[6].z-lm[5].z]);
  const v_i2 = norm([lm[7].x-lm[6].x, lm[7].y-lm[6].y, lm[7].z-lm[6].z]);
  const indexPipCos = Math.max(-1, Math.min(1, dot(v_i1, v_i2)));
  const f = {
    ext, thumbSide, thumbUp: thumbUp2, thumbForward: thumbFwd,
    dThumbIndex: dist(lm[4],lm[8])/palmSize,
    dIndexMiddle: dist(lm[8],lm[12])/palmSize,
    palmSize,
    indexPipCos,
  };
  const EXT=0.55, FOLD=0.30;
  const g = {
    idx: f.ext.index>EXT, mid: f.ext.middle>EXT, rng: f.ext.ring>EXT, pky: f.ext.pinky>EXT,
    idx_f: f.ext.index<FOLD, mid_f: f.ext.middle<FOLD, rng_f: f.ext.ring<FOLD, pky_f: f.ext.pinky<FOLD,
    thumbAbducted: f.thumbSide>0.35, thumbUp: f.thumbUp>0.45, thumbOver: f.thumbForward<-0.15,
    thumbTouchIdx: f.dThumbIndex<0.35, idxMidClose: f.dIndexMiddle<0.18,
    idxMidSpread: f.dIndexMiddle>0.28, indexHooked: f.indexPipCos<0.30,
  };
  let letter='?', base=0.25;
  if (g.idx_f && g.mid_f && g.rng_f && g.pky_f) {
    if (g.thumbOver) { letter='S'; base=0.90; }
    else if (f.dThumbIndex<0.20) { letter='T'; base=0.85; }
    else if (g.thumbAbducted && g.thumbUp) { letter='A'; base=0.87; }
    else { letter='A'; base=0.80; }
  } else if (g.idx && g.mid_f && g.rng_f && g.pky_f) {
    if (g.thumbAbducted && g.thumbUp) { letter='L'; base=0.93; }
    else if (g.thumbAbducted) { letter='G'; base=0.86; }
    else if (g.indexHooked) { letter='X'; base=0.82; }
    else { letter='D'; base=0.88; }
  } else if (g.idx_f && g.mid_f && g.rng_f && g.pky) {
    if (g.thumbAbducted && g.thumbUp) { letter='Y'; base=0.93; }
    else { letter='I'; base=0.91; }
  } else if (g.idx && g.mid_f && g.rng_f && g.pky) { letter='P'; base=0.86; }
  else if (g.idx && g.mid && g.rng_f && g.pky_f) {
    if (g.thumbAbducted) { letter='K'; base=0.87; }
    else if (g.idxMidClose) { letter='U'; base=0.89; }
    else if (g.idxMidSpread) { letter='V'; base=0.89; }
    else { letter='H'; base=0.81; }
  } else if (g.idx && g.mid && g.rng && g.pky_f) { letter='W'; base=0.88; }
  else if (g.idx && g.mid && g.rng && g.pky) { letter='B'; base=0.91; }
  else {
    const allBent = f.ext.index>FOLD&&f.ext.index<EXT && f.ext.middle>FOLD&&f.ext.middle<EXT && f.ext.ring>FOLD&&f.ext.ring<EXT;
    const allLow  = f.ext.index<0.62 && f.ext.middle<0.62 && f.ext.ring<0.62 && f.ext.pinky<0.62;
    if (allBent && f.dThumbIndex<0.28) { letter='O'; base=0.85; }
    else if (allBent) { letter='C'; base=0.81; }
    else if (allLow && g.thumbTouchIdx) { letter='F'; base=0.79; }
    else if (allLow && f.ext.index<0.45 && f.ext.middle<0.45) {
      letter = g.thumbOver ? 'S' : 'E'; base = g.thumbOver ? 0.75 : 0.77;
    } else if (g.indexHooked && g.idx_f && g.mid_f && g.pky_f) { letter='X'; base=0.83; }
    else {
      const n = [g.idx,g.mid,g.rng,g.pky].filter(Boolean).length;
      letter = ['?','D','U','W','B'][n]||'?'; base = [0.25,0.52,0.48,0.48,0.55][n]||0.25;
    }
  }
  const sizeOk = Math.min(1.0, f.palmSize/0.12);
  return { letter, confidence: Math.round(base*sizeOk*100)/100 };
}

// ── Props ───────────────────────────────────────────────────────────
interface Props {
  lesson:     Lesson;
  onBack:     () => void;
  onProgress: (lessonId: number, pct: number, completed: boolean) => void;
}

const STABLE_FRAMES_NEEDED = 20;

export function LessonDetailView({ lesson, onBack, onProgress }: Props) {
  const [content,  setContent]  = useState<ContentBlock[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [step,     setStep]     = useState(0);
  const [quizAns,  setQuizAns]  = useState<number|null>(null);
  const [done,     setDone]     = useState(false);

  // ── Camera state & Refs ─────────────────────────────────────────
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const handsRef   = useRef<HandsInstance|null>(null);
  const stepRef    = useRef<number>(0);

  const [mediapipeLoaded, setMediapipeLoaded] = useState(false);
  const [cameraOn,        setCameraOn]        = useState(false);
  const [detectedLetter,  setDetectedLetter]  = useState('');
  const [stableCount,     setStableCount]     = useState(0);
  const [signUnlocked,    setSignUnlocked]    = useState(false);
  const contentRef = useRef<ContentBlock[]>([]);
  const [lastDetected,    setLastDetected]    = useState('');
  const [cameraError,     setCameraError]     = useState('');

  const block = content.length > 0 && step < content.length ? content[step] : null;
  const isSignBlock = block?.type === 'sign';
  const targetLetter = (block as any)?.letter ?? '';
  
  // Alias de tipo any para evadir los errores estrictos en propiedades dinámicas del JSX
  const b = block as any;

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Sincronizar step con su referencia para mitigar cierres de ámbito obsoletos (stale closures)
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // ── Apagar la cámara al completar la lección ────────────────────
  useEffect(() => {
    if (done) stopCamera();
  }, [done]);

  // ── Cargar MediaPipe una sola vez ───────────────────────────────
  useEffect(() => {
    const load = (src: string) => new Promise<void>((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous';
      s.onload = () => res(); s.onerror = () => rej(); document.head.appendChild(s);
    });
    Promise.all([
      load('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'),
      load('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'),
    ]).then(() => setMediapipeLoaded(true)).catch(() => {});
  }, []);

  // ── Cargar contenido ─────────────────────────────────────────────
  useEffect(() => {
    setStep(0); setQuizAns(null); setDone(false); setLoading(true);
    api.lessons.getById(lesson.id)
      .then(data => { setContent((data.content as ContentBlock[]) ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lesson.id]);

  // ── Actualizar progreso al avanzar ───────────────────────────────
  useEffect(() => {
    if (content.length === 0) return;
    const pct = Math.round((step / content.length) * 100);
    onProgress(lesson.id, pct, false);
  }, [step, content.length]);

  // ── Encender/apagar cámara según bloque ──────────────────────────
  useEffect(() => {
    if (isSignBlock && mediapipeLoaded) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isSignBlock, mediapipeLoaded, step]);

  // ── Reset estado de detección al cambiar bloque ──────────────────
  useEffect(() => {
    setDetectedLetter(''); setStableCount(0);
    setSignUnlocked(false); setLastDetected('');
  }, [step]);

  // ── Iniciar cámara ───────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      await new Promise<void>(resolve => {
        const v = videoRef.current!;
        const check = () => v.videoWidth > 0 ? resolve() : requestAnimationFrame(check);
        v.onloadeddata = check;
        requestAnimationFrame(check);
      });

      handsRef.current = new window.Hands({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
      });
      handsRef.current.setOptions({
        maxNumHands: 1, modelComplexity: 1,
        minDetectionConfidence: 0.72, minTrackingConfidence: 0.55
      });
      handsRef.current.onResults(results => {
        const canvas = canvasRef.current; const video = videoRef.current;
        if (!canvas || !video || video.videoWidth === 0) return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0);
        if (results.multiHandLandmarks?.length) {
          const lm = results.multiHandLandmarks[0];
          window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS, { color: '#0ED2B8', lineWidth: 2 });
          window.drawLandmarks(ctx, lm, { color: '#9D7BF8', radius: 3, fillColor: '#9D7BF8' });
          const prediction = classifyLSM(lm);
          setDetectedLetter(prediction.letter);
          if (prediction.confidence > 0.72 && prediction.letter !== '?') {
            setLastDetected(prev => {
              if (prev === prediction.letter && prediction.letter === targetLetter) {
                setStableCount(c => {
                  const next = c + 1;
                  if (next >= STABLE_FRAMES_NEEDED) {
                    setSignUnlocked(true);
                    return 0;
                  }
                  return next;
                });
              } else {
                setStableCount(1);
              }
              return prediction.letter;
            });
          }
        } else {
          setDetectedLetter('');
        }
        ctx.restore();
      });

      setCameraOn(true);
      const loop = async () => {
        if (videoRef.current && handsRef.current && videoRef.current.videoWidth > 0) {
          await handsRef.current.send({ image: videoRef.current });
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('No se pudo acceder a la cámara.');
    }
  }, [mediapipeLoaded, targetLetter, content.length, lesson.id, onProgress]);

  // ── Detener cámara ───────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  const goBack = useCallback(() => {
    if (step > 0) { setStep(s => s - 1); setQuizAns(null); }
  }, [step]);

  // ────────────────────────────────────────────────────────────────
  const total = content.length;
  const progressPct = total > 0 ? Math.round((step / total) * 100) : 0;

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32,marginBottom:10 }}>⏳</div>
        <div>Cargando lección…</div>
      </div>
    </div>
  );

  // ── Pantalla de completado ───────────────────────────────────────
  if (done) return (
    <div className="anim-fade-up" style={{ height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center' }}>
      <div style={{ fontSize:64,marginBottom:16 }}>🎉</div>
      <div style={{ fontWeight:800,fontSize:24,marginBottom:8 }}>¡Lección completada!</div>
      <div style={{ fontSize:14,color:'var(--t2)',marginBottom:28 }}>{lesson.title}</div>
      <div style={{ display:'flex',gap:10 }}>
        <button className="btn-ghost" onClick={() => { setStep(0); setQuizAns(null); setDone(false); }}>Repasar</button>
        <button className="btn-primary" onClick={onBack}>Siguiente lección →</button>
      </div>
    </div>
  );

  if (!block) return null;

  return (
    <div className="anim-fade-up" style={{ height:'100%',display:'flex',flexDirection:'column' }}>

      {/* ── Header con progreso ── */}
      <div style={{ padding:'12px 16px',borderBottom:'1px solid var(--bdr)',background:'var(--bg2)',flexShrink:0 }}>
        <button className="btn-sm" onClick={onBack} style={{ marginBottom:8 }}>← Lecciones</button>
        <div style={{ fontWeight:700,fontSize:14,marginBottom:6 }}>{lesson.title}</div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ flex:1 }}><PBar pct={progressPct} height={5}/></div>
          <span style={{ fontSize:11,color:'var(--t3)',fontWeight:600,minWidth:40 }}>{step+1}/{total}</span>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ flex:1,overflowY:'auto' }}>

        {/* ═══ BLOQUE SIGN con cámara ═══════════════════════════════ */}
        {b.type === 'sign' && (
          <div key={step} className="anim-fade-up">

            {/* Éxito overlay */}
            {signUnlocked && (
              <div style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',background:'#22C97E',color:'#040D14',borderRadius:20,padding:'6px 18px',fontWeight:700,fontSize:14,zIndex:10}}>
                ✅ ¡Seña correcta! Toca Continuar
              </div>
            )}
            {false && (
              <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(8,13,26,.85)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16 }}>
                <div style={{ fontSize:80 }}>✅</div>
                <div style={{ fontSize:26,fontWeight:800,color:'#22C97E' }}>¡Seña correcta!</div>
                <div style={{ fontSize:16,color:'var(--t2)' }}>Avanzando…</div>
              </div>
            )}

            {/* Parte superior — info de la seña */}
            <div style={{ padding:'20px 20px 0' }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:14 }}>
                <span style={{ background:'var(--teal-d)',color:'var(--teal)',fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20,border:'1px solid var(--teal-b)' }}>
                  📸 Practica la seña
                </span>
              </div>
              <div style={{ display:'flex',gap:20,alignItems:'flex-start',marginBottom:20 }}>
                {/* Imagen de la seña */}
                <div style={{ flexShrink:0,width:120,height:120,borderRadius:14,overflow:'hidden',border:'2px solid var(--teal)',background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <img
                    src={`/signs/${b.letter}.png`}
                    alt={`Seña ${b.letter}`}
                    style={{ width:'100%',height:'100%',objectFit:'cover' }}
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.innerHTML = `<div style="font-size:52px;font-weight:900;color:var(--teal)">${b.letter}</div>`;
                    }}
                  />
                </div>
                {/* Descripción */}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:32,fontWeight:900,color:'var(--teal)',marginBottom:4 }}>{b.letter}</div>
                  <div style={{ fontWeight:700,fontSize:17,marginBottom:6 }}>{b.name}</div>
                  <div style={{ fontSize:13.5,color:'var(--t2)',lineHeight:1.6 }}>{b.description}</div>
                  {b.tip && (
                    <div style={{ fontSize:12,color:'var(--teal)',marginTop:8,padding:'6px 10px',background:'var(--teal-d)',borderRadius:8 }}>
                      💡 {b.tip}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Separador */}
            <div style={{ height:1,background:'var(--bdr)',margin:'0 20px 16px' }}/>

            {/* Parte inferior — cámara + imagen grande */}
            <div style={{ padding:'0 20px 20px' }}>
              <div style={{ fontWeight:700,fontSize:14,marginBottom:10,display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ width:8,height:8,borderRadius:'50%',background:cameraOn?'#22C97E':'var(--t3)',display:'inline-block' }}/>
                {cameraOn ? `Haz la seña "${targetLetter}"` : 'Iniciando cámara…'}
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

                {/* Cámara izquierda */}
                <div style={{ position:'relative',borderRadius:14,overflow:'hidden',background:'var(--bg3)',border:`2px solid ${signUnlocked?'#22C97E':'var(--bdr)'}`,aspectRatio:'4/3',transition:'border-color .3s' }}>
                  <video ref={videoRef} style={{ display:'none' }} playsInline muted/>
                  <canvas ref={canvasRef} style={{ width:'100%',height:'100%',objectFit:'cover',display:cameraOn?'block':'none' }}/>
                  {!cameraOn && !cameraError && (
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:10,color:'var(--t3)' }}>
                      <div style={{ fontSize:32 }}>📷</div>
                      <div style={{ fontSize:13 }}>Iniciando cámara…</div>
                    </div>
                  )}
                  {cameraError && (
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:10,padding:20,textAlign:'center' }}>
                      <div style={{ fontSize:28 }}>⚠️</div>
                      <div style={{ fontSize:13,color:'var(--red)' }}>{cameraError}</div>
                      <button className="btn-primary" onClick={startCamera}>Reintentar</button>
                    </div>
                  )}
                  {signUnlocked && (
                    <div style={{ position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',background:'#22C97E',color:'#040D14',borderRadius:20,padding:'6px 18px',fontWeight:700,fontSize:14,zIndex:10,whiteSpace:'nowrap' }}>
                      ✅ ¡Seña correcta!
                    </div>
                  )}
                  {cameraOn && (
                    <div style={{ position:'absolute',bottom:10,left:10,right:10,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                      <div style={{ background:'rgba(8,13,26,.85)',borderRadius:10,padding:'8px 14px',display:'flex',alignItems:'center',gap:10 }}>
                        <span style={{ fontSize:13,color:'var(--t3)' }}>Detectando:</span>
                        <span style={{ fontSize:22,fontWeight:900,color: detectedLetter === targetLetter ? '#22C97E' : 'var(--t2)' }}>
                          {detectedLetter || '—'}
                        </span>
                      </div>
                      <div style={{ background:'rgba(8,13,26,.85)',borderRadius:10,padding:'8px 14px',display:'flex',gap:6,alignItems:'center' }}>
                        {Array.from({ length: STABLE_FRAMES_NEEDED > 10 ? 10 : STABLE_FRAMES_NEEDED }).map((_, i) => (
                          <div key={i} style={{ width:10,height:10,borderRadius:'50%',background: i < Math.round(stableCount * 10 / STABLE_FRAMES_NEEDED) && lastDetected === targetLetter ? '#22C97E' : 'var(--bdr)',transition:'background .2s' }}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Imagen de referencia grande derecha */}
                <div style={{ borderRadius:14,overflow:'hidden',border:'2px solid var(--teal)',background:'var(--bg3)',aspectRatio:'4/3',display:'flex',alignItems:'center',justifyContent:'center',position:'relative' }}>
                  <img
                    src={`/signs/${targetLetter}.png`}
                    alt={`Seña ${targetLetter}`}
                    style={{ width:'100%',height:'100%',objectFit:'contain',padding:8 }}
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement!;
                      parent.innerHTML = `<div style="font-size:120px;font-weight:900;color:var(--teal);text-align:center">${targetLetter}</div>`;
                    }}
                  />
                  <div style={{ position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',background:'rgba(8,13,26,.8)',borderRadius:8,padding:'4px 12px',fontSize:12,color:'var(--teal)',fontWeight:600,whiteSpace:'nowrap' }}>
                    Referencia: {targetLetter}
                  </div>
                </div>

              </div>

              {cameraOn && !signUnlocked && (
                <div style={{ marginTop:12,textAlign:'center',fontSize:13,color:'var(--t3)',lineHeight:1.5 }}>
                  Imita la seña de referencia frente a la cámara y mantenla estable
                </div>
              )}
            </div>

          </div>
        )}

        {/* ═══ BLOQUE INTRO ══════════════════════════════════════════ */}
        {b.type === 'intro' && (
          <div key={step} className="anim-fade-up" style={{ padding:20 }}>
            <div style={{ fontWeight:800,fontSize:20,marginBottom:14,color:'var(--teal)' }}>{b.title}</div>
            <div style={{ fontSize:14.5,color:'var(--t2)',lineHeight:1.72 }}>{b.body}</div>
          </div>
        )}

        {/* ═══ BLOQUE HIGHLIGHT ══════════════════════════════════════ */}
        {b.type === 'highlight' && (
          <div key={step} className="anim-fade-up" style={{ padding:20 }}>
            <div style={{ background:'var(--amb-d)',border:'1px solid rgba(245,166,35,.25)',borderRadius:12,padding:'16px 18px',display:'flex',gap:12 }}>
              <div style={{ fontSize:20,flexShrink:0,marginTop:2 }}>{b.emoji}</div>
              <div style={{ fontSize:14,color:'var(--t2)',lineHeight:1.65 }}>{b.body}</div>
            </div>
          </div>
        )}

        {/* ═══ BLOQUE TIP ════════════════════════════════════════════ */}
        {b.type === 'tip' && (
          <div key={step} className="anim-fade-up" style={{ padding:20 }}>
            <div style={{ background:'var(--teal-d)',border:'1px solid var(--teal-b)',borderRadius:12,padding:'16px 18px' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{b.emoji}</span>
                <span style={{ fontWeight:700,fontSize:14,color:'var(--teal)' }}>{b.title}</span>
              </div>
              <div style={{ fontSize:13.5,color:'var(--t2)',lineHeight:1.6 }}>{b.body}</div>
            </div>
          </div>
        )}

        {/* ═══ BLOQUE STATS ══════════════════════════════════════════ */}
        {b.type === 'stats' && b.items && (
          <div key={step} className="anim-fade-up" style={{ padding:20 }}>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12 }}>
              {b.items.map(({ n, l }: { n: string; l: string }) => (
                <div key={n} className="glass" style={{ padding:16,textAlign:'center' }}>
                  <div style={{ fontSize:24,fontWeight:900,color:'var(--teal)',marginBottom:4 }}>{n}</div>
                  <div style={{ fontSize:11.5,color:'var(--t3)',lineHeight:1.4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ BLOQUE BODY ═══════════════════════════════════════════ */}
        {b.type === 'body' && (
          <div key={step} className="anim-fade-up" style={{ padding:20 }}>
            <div style={{ fontWeight:700,fontSize:17,marginBottom:12 }}>{b.title}</div>
            <div style={{ fontSize:14.5,color:'var(--t2)',lineHeight:1.72 }}>{b.body}</div>
          </div>
        )}

        {/* ═══ BLOQUE QUIZ ═══════════════════════════════════════════ */}
        {b.type === 'quiz' && (
          <div key={step} className="anim-fade-up" style={{ padding:20 }}>
            <span className="tag" style={{ background:'var(--vio-d)',color:'var(--vio)',marginBottom:14,fontSize:11.5 }}>
              📝 Pregunta de comprensión
            </span>
            <div style={{ fontWeight:700,fontSize:15.5,margin:'14px 0 18px',lineHeight:1.45 }}>{b.q}</div>
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {b.opts?.map((opt: string, i: number) => {
                const isCorrect = quizAns !== null && i === b.correct;
                const isWrong   = quizAns === i    && i !== b.correct;
                return (
                  <button key={i} onClick={() => quizAns === null && setQuizAns(i)}
                    style={{ padding:'13px 16px',borderRadius:11,cursor:quizAns===null?'pointer':'default',textAlign:'left',fontSize:13.5,fontFamily:'inherit',transition:'.2s',background:isCorrect?'var(--grn-d)':isWrong?'rgba(240,80,80,.12)':'var(--card)',border:`${isCorrect||isWrong?1.5:1}px solid ${isCorrect?'var(--grn)':isWrong?'var(--red)':'var(--bdr)'}`,color:isCorrect?'var(--grn)':isWrong?'var(--red)':'var(--t2)' } as React.CSSProperties}>
                    <span style={{ marginRight:8 }}>{['A','B','C','D'][i]}.</span>{opt}
                    {isCorrect && <span style={{ float:'right' }}>✅</span>}
                    {isWrong   && <span style={{ float:'right' }}>❌</span>}
                  </button>
                );
              })}
            </div>
            {quizAns !== null && (
              <div style={{ marginTop:14,padding:'13px 16px',borderRadius:11,background:quizAns===b.correct?'var(--grn-d)':'rgba(240,80,80,.1)',border:`1px solid ${quizAns===b.correct?'var(--grn)':'var(--red)'}`,fontSize:13,color:'var(--t2)',lineHeight:1.55 }}>
                {quizAns === b.correct ? '✅ ' : '❌ '}{b.feedback}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Botones de navegación — se ocultan en bloques sign ── */}
      {!isSignBlock && (
        <div style={{ padding:'14px 16px',borderTop:'1px solid var(--bdr)',display:'flex',gap:10,flexShrink:0 }}>
          <button className="btn-ghost" style={{ flex:1,justifyContent:'center' }}
            onClick={goBack} disabled={step===0}>
            ← Anterior
          </button>
          <button className="btn-primary" style={{ flex:1,justifyContent:'center' }}
            onClick={() => {
              const currentStep = stepRef.current;
              const total = content.length;
              if (currentStep < total - 1) {
                setStep(currentStep + 1);
                setQuizAns(null);
              } else {
                onProgress(lesson.id, 100, true);
                setDone(true);
              }
            }}
            disabled={b.type === 'quiz' && quizAns === null}>
            {step < total - 1 ? 'Siguiente →' : 'Completar ✓'}
          </button>
        </div>
      )}

      {/* En bloques sign — botones de navegación con desbloqueo */}
      {isSignBlock && (
        <div style={{ padding:'14px 16px',borderTop:'1px solid var(--bdr)',display:'flex',gap:10,flexShrink:0 }}>
          <button className="btn-ghost" style={{ flex:1,justifyContent:'center' }}
            onClick={goBack} disabled={step===0}>
            ← Anterior
          </button>
          <button
            className="btn-primary"
            style={{ flex:1,justifyContent:'center',opacity:signUnlocked?1:0.4,cursor:signUnlocked?'pointer':'not-allowed' }}
            disabled={!signUnlocked}
            onClick={() => {
              setSignUnlocked(false);
              setStableCount(0);
              setLastDetected('');
              const total = contentRef.current.length;
              if (step < total - 1) {
                setStep(s => s + 1);
                setQuizAns(null);
              } else {
                onProgress(lesson.id, 100, true);
                setDone(true);
              }
            }}>
            {signUnlocked ? 'Continuar →' : 'Haz la seña para continuar'}
          </button>
        </div>
      )}

    </div>
  );
}