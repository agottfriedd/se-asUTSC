import { useRef, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { RecognitionResult } from '../types';

type Pt = { x: number; y: number; z: number };

// La clasificación vive en ml-service/app/classifier.py (única fuente de
// verdad). Aquí solo extraemos landmarks con MediaPipe y los mandamos a
// POST /classify. Mínimo intervalo entre requests para no saturar el servicio
// (onResults dispara a ~30 fps).
const CLASSIFY_MIN_INTERVAL_MS = 150;

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

// Solo letras que el clasificador (ml-service) puede emitir.
const SIGN_DESCRIPTIONS: Record<string,string> = {
  A:'Puño, pulgar al costado', B:'Mano plana, dedos juntos',
  C:'Curva en C', D:'Solo índice arriba', E:'Todos doblados',
  F:'Índice+pulgar tocándose', G:'Índice lateral', H:'2 dedos horizontal',
  I:'Solo meñique', K:'V con pulgar', L:'Forma de L',
  O:'Círculo cerrado', P:'Índice+meñique abajo', S:'Puño+pulgar encima',
  T:'Pulgar entre índice+medio', U:'Índice+medio juntos', V:'Paz ✌️',
  W:'3 dedos separados', X:'Índice enganchado', Y:'Shaka 🤙',
};

export function PracticeView() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const handsRef  = useRef<HandsInstance|null>(null);
  // Token de sesión: invalida un startCamera() en vuelo si stopCamera() corre
  // antes de que termine (p.ej. se sale de la vista mientras carga la cámara).
  const sessionRef = useRef(0);

  const [result,     setResult]     = useState<RecognitionResult|null>(null);
  const [running,    setRunning]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [error,      setError]      = useState('');
  const [history,    setHistory]    = useState<string[]>([]);
  // Solo se usan los setters (lógica de estabilización por callbacks)
  const [, setLastLetter] = useState('');
  const [, setSameCount]  = useState(0);
  const [mlDown, setMlDown] = useState(false);

  // Clasificación remota: un request en vuelo a la vez + throttle
  const busyRef     = useRef(false);
  const lastReqRef  = useRef(0);
  // Últimos landmarks vistos (para capturar fixtures)
  const latestLmRef = useRef<Pt[]|null>(null);

  const classifyRemote = useCallback((lm: Pt[]) => {
    const now = Date.now();
    if (busyRef.current || now - lastReqRef.current < CLASSIFY_MIN_INTERVAL_MS) return;
    busyRef.current = true;
    lastReqRef.current = now;
    api.ml.classify(lm)
      .then(prediction => {
        setMlDown(false);
        setResult(prediction);
        if (prediction.confidence > 0.72 && prediction.letter !== '?') {
          setLastLetter(prev => {
            if (prev === prediction.letter) {
              setSameCount(c => {
                if (c >= 2) {
                  setHistory(h => [prediction.letter, ...h].slice(0, 12));
                  return 0;
                }
                return c + 1;
              });
            } else {
              setSameCount(1);
            }
            return prediction.letter;
          });
        }
      })
      .catch(() => {
        setMlDown(true);
        setResult(null);   // no mostrar una letra vieja si el servicio cayó
      })
      .finally(() => { busyRef.current = false; });
  }, []);

  // Descarga los landmarks del frame actual como JSON (fixtures para
  // comparar MediaPipe legacy-CDN vs Tasks; ver classifier.py).
  const captureFixture = useCallback(() => {
    const lm = latestLmRef.current;
    if (!lm) return;
    const letter = result && result.letter !== '?' ? result.letter : 'unknown';
    const payload = {
      capturedAt: new Date().toISOString(),
      source:     'mediapipe-hands-legacy-cdn',
      letter,
      confidence: result?.confidence ?? null,
      landmarks:  lm.map(p => ({ x: p.x, y: p.y, z: p.z })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lsm-fixture-${letter}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

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
    const mySession = ++sessionRef.current;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video:{width:640,height:480,facingMode:'user'}
      });
      // stopCamera() ya corrió (se salió de Práctica, etc.) mientras
      // esperábamos el permiso de cámara: soltar el stream y salir.
      if (sessionRef.current !== mySession || !videoRef.current) {
        stream.getTracks().forEach(t=>t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      // ── CORRECCIÓN: esperar a que el video tenga dimensiones reales ──
      await new Promise<void>(resolve => {
        const v = videoRef.current!;
        if (v.readyState >= 2 && v.videoWidth > 0) { resolve(); return; }
        const check = () => {
          if (v.videoWidth > 0) { resolve(); }
          else { requestAnimationFrame(check); }
        };
        v.onloadeddata = check;
        requestAnimationFrame(check);
      });

      if (sessionRef.current !== mySession) {
        stream.getTracks().forEach(t=>t.stop());
        if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
        return;
      }

      handsRef.current = new window.Hands({
        locateFile: (f:string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
      });
      handsRef.current.setOptions({
        maxNumHands:1, modelComplexity:1,
        minDetectionConfidence:0.72, minTrackingConfidence:0.55
      });
      handsRef.current.onResults(results => {
        const canvas=canvasRef.current; const video=videoRef.current;
        if (!canvas||!video||video.videoWidth===0) return;
        const ctx=canvas.getContext('2d')!;
        canvas.width=video.videoWidth; canvas.height=video.videoHeight;
        ctx.save(); ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(video,0,0);

        if (results.multiHandLandmarks?.length) {
          const lm=results.multiHandLandmarks[0];
          window.drawConnectors(ctx,lm,window.HAND_CONNECTIONS,{color:'#0ED2B8',lineWidth:2});
          window.drawLandmarks(ctx,lm,{color:'#9D7BF8',radius:3,fillColor:'#9D7BF8'});
          latestLmRef.current = lm;
          classifyRemote(lm);      // async; el dibujo no espera al servicio
        } else {
          latestLmRef.current = null;
          setResult(null);
        }
        ctx.restore();
      });

      if (sessionRef.current !== mySession) {
        // Se canceló mientras se inicializaba MediaPipe: no arrancar el loop.
        stream.getTracks().forEach(t=>t.stop());
        if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
        handsRef.current = null;
        return;
      }

      setRunning(true);
      const loop=async()=>{
        // Se revisa en cada frame: si stopCamera() invalidó esta sesión, el
        // loop se corta aquí en vez de seguir encadenando requestAnimationFrame.
        if (sessionRef.current !== mySession) return;
        if (videoRef.current && handsRef.current && videoRef.current.videoWidth>0) {
          await handsRef.current.send({image:videoRef.current});
        }
        if (sessionRef.current === mySession) {
          rafRef.current=requestAnimationFrame(loop);
        }
      };
      rafRef.current=requestAnimationFrame(loop);
    } catch {
      if (stream) stream.getTracks().forEach(t=>t.stop());
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    }
  }, [loaded, classifyRemote]);

  const stopCamera = useCallback(() => {
    sessionRef.current += 1; // invalida cualquier startCamera() en vuelo
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());
      videoRef.current.srcObject=null;
    }
    handsRef.current = null;
    setRunning(false); setResult(null); setMlDown(false);
    latestLmRef.current = null;
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
          {running && mlDown && (
            <div style={{position:'absolute',inset:0,zIndex:3,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,background:'rgba(8,13,26,.82)',backdropFilter:'blur(4px)',padding:24,textAlign:'center'}}>
              <div style={{fontSize:40}}>🔌</div>
              <div style={{fontWeight:800,fontSize:16,color:'var(--red)'}}>Sin conexión con el servicio de reconocimiento</div>
              <div style={{fontSize:12.5,color:'var(--t2)',maxWidth:380,lineHeight:1.5}}>
                La clasificación de señas ahora se hace en el servidor (ml-service).
                Mientras no responda, la práctica no puede reconocer letras.
                Verifica que el servicio esté corriendo y reintentaremos automáticamente.
              </div>
            </div>
          )}
          {running && result && result.letter!=='?' && (
            <div style={{position:'absolute',top:12,right:12,background:'rgba(8,13,26,.88)',backdropFilter:'blur(10px)',borderRadius:14,padding:'12px 18px',border:`1.5px solid ${confColor}40`,minWidth:80,textAlign:'center'}}>
              <div style={{fontSize:48,fontWeight:900,color:confColor,lineHeight:1}}>{result.letter}</div>
              <div style={{fontSize:11,color:confColor,fontWeight:600,marginTop:4}}>{confPct}% confianza</div>
              {SIGN_DESCRIPTIONS[result.letter] && (
                <div style={{fontSize:10,color:'var(--t3)',marginTop:3,maxWidth:120}}>{SIGN_DESCRIPTIONS[result.letter]}</div>
              )}
            </div>
          )}
          {running && !mlDown && (!result || result.letter==='?') && (
            <div style={{position:'absolute',top:12,left:12,background:'rgba(8,13,26,.7)',borderRadius:10,padding:'6px 12px',fontSize:12,color:'var(--t3)'}}>
              Sin mano detectada
            </div>
          )}
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
          {running && (
            <button
              className="btn-ghost"
              onClick={captureFixture}
              disabled={!latestLmRef.current}
              title="Descarga los 21 landmarks del frame actual como JSON (para fixtures de prueba)"
            >
              📥 Fixture
            </button>
          )}
          <button className="btn-ghost" onClick={()=>setHistory([])}>Limpiar</button>
        </div>

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