import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ML_CONFIDENCE_GATE, handednessDesdeLegacy } from '../lib/api';
import type { Lesson, ContentBlock, LessonProgress } from '../types';
import { PBar } from '../components/UI';
import { colors } from '../theme';

// ── Tipos MediaPipe ─────────────────────────────────────────────────
type Pt = { x: number; y: number; z: number };

interface HandsInstance {
  setOptions: (o: object) => void;
  onResults: (cb: (r: {
    multiHandLandmarks?: Pt[][];
    // Coordenadas en metros con origen en la muñeca: las que usa el modelo.
    multiHandWorldLandmarks?: Pt[][];
    multiHandedness?: { label?: string }[];
  }) => void) => void;
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

// La clasificación LSM vive en el ml-service (única fuente de verdad). Aquí
// solo extraemos los landmarks con MediaPipe y los enviamos a POST /classify
// vía api.ml.classify(). Ver PracticeView.tsx (mismo patrón).

// ── Props ───────────────────────────────────────────────────────────
interface Props {
  lesson:         Lesson;
  onBack:         () => void;
  onProgress:     (lessonId: number, pct: number, completed: boolean) => void;
  getForLesson:   (lessonId: number) => LessonProgress;
  progressLoaded: boolean;
}

// Throttle de la clasificación remota (un request en vuelo a la vez).
const CLASSIFY_MIN_INTERVAL_MS = 150;   // ~6.7 clasificaciones/s
// Frames estables para desbloquear. Antes 20 @30fps local (~0.7s). Con la
// clasificación remota a ~6.7/s, 13 frames ≈ 2s reales (13 × 150ms ≈ 1.95s).
const STABLE_FRAMES_NEEDED = 13;

// ── Fallback de práctica ────────────────────────────────────────────
// Si tras este tiempo el usuario no logra la seña con la cámara, se le
// ofrece una ruta alternativa (mini-quiz visual) para no atascarse.
const FALLBACK_TIMEOUT_S = 35;
// Aviso ámbar de los últimos segundos, proporcional al timeout (60→10, 35→6):
// era un 10 fijo; ahora se deriva para escalar con FALLBACK_TIMEOUT_S.
const FALLBACK_WARN_S = Math.round(FALLBACK_TIMEOUT_S / 6);
// Letras con imagen disponible en /public/signs/ — pool para los distractores
// del mini-quiz. Se garantiza que todas tienen PNG (evita el fallback a texto
// que delataría cuáles son "de relleno").
const SIGN_POOL = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','Ñ',
  'O','P','Q','R','S','T','U','V','W','X','Y','Z',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 4 opciones para el mini-quiz: la letra objetivo + 3 distractoras aleatorias.
function buildQuizOptions(target: string): string[] {
  const distractors = shuffle(SIGN_POOL.filter(l => l !== target)).slice(0, 3);
  return shuffle([target, ...distractors]);
}

// Segundos → "m:ss"
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function LessonDetailView({ lesson, onBack, onProgress, getForLesson, progressLoaded }: Props) {
  const [content,  setContent]  = useState<ContentBlock[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [step,     setStep]     = useState(0);
  const [quizAns,  setQuizAns]  = useState<number|null>(null);
  const [done,     setDone]     = useState(false);
  // Retomar donde se quedó: mientras no se decida (Continuar / Empezar de nuevo)
  // se muestra la tarjeta de retomar en vez del bloque. Se reinicia por lección.
  const [resumeDecided, setResumeDecided] = useState(false);

  // ── Camera state & Refs ─────────────────────────────────────────
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const handsRef   = useRef<HandsInstance|null>(null);
  const stepRef    = useRef<number>(0);
  // El MediaStream se guarda AQUÍ, no solo en videoRef.current.srcObject. Al
  // desmontar (navegar a otra vista), React pone videoRef.current = null ANTES
  // de correr el cleanup del useEffect, así que stopCamera() ya no podía
  // encontrar el stream por el ref del <video> y los tracks nunca se paraban
  // (la cámara del navegador quedaba encendida). streamRef sobrevive al
  // desmontaje y permite pararlos siempre.
  const streamRef  = useRef<MediaStream|null>(null);
  // Token de sesión: cada startCamera() se identifica con un id. Si stopCamera()
  // corre mientras un startCamera() está a mitad de un await (getUserMedia,
  // espera de video listo…), el id ya no coincide y esa invocación se aborta y
  // libera lo que haya adquirido, en vez de pisar la cámara ya detenida.
  const sessionRef = useRef(0);

  const [mediapipeLoaded, setMediapipeLoaded] = useState(false);
  const [cameraOn,        setCameraOn]        = useState(false);
  const [detectedLetter,  setDetectedLetter]  = useState('');
  const [stableCount,     setStableCount]     = useState(0);
  const [signUnlocked,    setSignUnlocked]    = useState(false);
  const contentRef = useRef<ContentBlock[]>([]);
  const [lastDetected,    setLastDetected]    = useState('');
  const [cameraError,     setCameraError]     = useState('');
  const [mlDown,          setMlDown]          = useState(false);

  // ── Fallback (mini-quiz visual) ─────────────────────────────────
  const [countdown,   setCountdown]   = useState(FALLBACK_TIMEOUT_S);
  const [quizOpen,    setQuizOpen]    = useState(false);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [wrongPick,   setWrongPick]   = useState<string|null>(null);
  const timerRef = useRef<number|null>(null);

  // Clasificación remota: un request en vuelo a la vez + throttle
  const busyRef    = useRef(false);
  const lastReqRef = useRef(0);

  const block = content.length > 0 && step < content.length ? content[step] : null;
  const isSignBlock = block?.type === 'sign';
  const targetLetter = (block as any)?.letter ?? '';
  
  // Alias de tipo any para evadir los errores estrictos en propiedades dinámicas del JSX
  const b = block as any;

  // El fallback se ofrece si, estando en un bloque de seña sin desbloquear, o
  // bien se agotó el minuto, o el servicio ML está caído (para no atascarse).
  const fallbackOffered = isSignBlock && !signUnlocked && (countdown === 0 || mlDown);

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
    setStep(0); setQuizAns(null); setDone(false); setLoading(true); setResumeDecided(false);
    api.lessons.getById(lesson.id)
      .then(data => { setContent((data.content as ContentBlock[]) ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lesson.id]);

  // ── Decisión de retomar: UNA sola vez al ABRIR ───────────────────
  // En cuanto contenido y progreso cargaron, si NO hay avance real que retomar
  // se resuelve de inmediato (resumeDecided=true → entrar directo). Así, avanzar
  // bloques dentro de la lección —que sube el % vía el guardado por-bloque— NO
  // vuelve a disparar la tarjeta. Si sí hay avance, se deja resumeDecided=false
  // para que la tarjeta se muestre y el usuario elija. Depende SOLO del momento
  // de carga (no de saved.progress), por eso decide una vez y no se re-evalúa.
  useEffect(() => {
    if (resumeDecided || !progressLoaded || content.length === 0) return;
    const s = getForLesson(lesson.id);
    const rStep = s.completed ? 0 : Math.min(content.length - 1, Math.max(0, Math.round((s.progress / 100) * content.length)));
    const shouldPrompt = !s.completed && s.progress > 0 && rStep >= 1;
    if (!shouldPrompt) setResumeDecided(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressLoaded, content.length, lesson.id]);

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
    setSignUnlocked(false); setLastDetected(''); setMlDown(false);
    busyRef.current = false; lastReqRef.current = 0;
    // Reset del fallback: cierra el quiz y limpia su estado (el countdown se
    // reinicia en su propio efecto).
    setQuizOpen(false); setQuizOptions([]); setWrongPick(null);
  }, [step]);

  // ── Temporizador del fallback ────────────────────────────────────
  // Al entrar a un bloque de seña arranca una cuenta regresiva de 60s. Si se
  // agota sin lograr la seña, se ofrece el mini-quiz. Se reinicia al cambiar de
  // bloque y se limpia en el cleanup para no fugar el interval.
  useEffect(() => {
    if (!isSignBlock) return;
    setCountdown(FALLBACK_TIMEOUT_S);
    const id = window.setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { window.clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    timerRef.current = id;
    return () => { window.clearInterval(id); timerRef.current = null; };
  }, [isSignBlock, step]);

  // Si se logra la seña con la cámara, el temporizador ya no hace falta.
  useEffect(() => {
    if (signUnlocked && timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [signUnlocked]);

  // ── Iniciar cámara ───────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    const mySession = ++sessionRef.current;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      // stopCamera() ya corrió (cambió el bloque/step, se desmontó, etc.)
      // mientras esperábamos el permiso de cámara: soltar el stream y salir.
      if (sessionRef.current !== mySession || !videoRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      streamRef.current = stream;   // referencia que sobrevive al desmontaje
      videoRef.current.play();

      await new Promise<void>(resolve => {
        const v = videoRef.current!;
        const check = () => v.videoWidth > 0 ? resolve() : requestAnimationFrame(check);
        v.onloadeddata = check;
        requestAnimationFrame(check);
      });

      if (sessionRef.current !== mySession) {
        stream.getTracks().forEach(t => t.stop());
        if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
        return;
      }

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
          window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS, { color: colors.utscOrange, lineWidth: 2 });
          window.drawLandmarks(ctx, lm, { color: colors.utscTeal, radius: 3, fillColor: colors.utscTeal });

          // Clasificación remota (fuente de verdad: ml-service). El dibujo de
          // arriba sigue a ~30fps; los requests van con throttle + guard.
          const now = Date.now();
          if (!busyRef.current && now - lastReqRef.current >= CLASSIFY_MIN_INTERVAL_MS) {
            busyRef.current = true;
            lastReqRef.current = now;
            // Los world landmarks son los que usa el modelo; los de imagen se
            // siguen mandando para dibujar y para el fallback de reglas.
            const world = results.multiHandWorldLandmarks?.[0];
            // La etiqueta de legacy va al revés que la de Tasks; hay que
            // traducirla o el servicio espeja la mano al revés. Ver api.ts.
            const hand  = handednessDesdeLegacy(results.multiHandedness?.[0]?.label);
            api.ml.classify(lm, world, hand)
              .then(prediction => {
                setMlDown(false);
                setDetectedLetter(prediction.letter);
                if (prediction.confidence > ML_CONFIDENCE_GATE && prediction.letter !== '?') {
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
              })
              .catch(() => {
                // Servicio ML caído: sin él no se puede avanzar de lección.
                setMlDown(true);
                setDetectedLetter('');
              })
              .finally(() => { busyRef.current = false; });
          }
        } else {
          setDetectedLetter('');
        }
        ctx.restore();
      });

      if (sessionRef.current !== mySession) {
        // Se canceló mientras se inicializaba MediaPipe: no arrancar el loop.
        stream.getTracks().forEach(t => t.stop());
        if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
        handsRef.current = null;
        return;
      }

      setCameraOn(true);
      const loop = async () => {
        // Se vuelve a comprobar en cada frame: si stopCamera() invalidó esta
        // sesión, el loop se corta aquí en vez de seguir pidiendo frames.
        if (sessionRef.current !== mySession) return;
        if (videoRef.current && handsRef.current && videoRef.current.videoWidth > 0) {
          await handsRef.current.send({ image: videoRef.current });
        }
        if (sessionRef.current === mySession) {
          rafRef.current = requestAnimationFrame(loop);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      console.error('Camera error:', err);
      setCameraError('No se pudo acceder a la cámara.');
    }
  }, [mediapipeLoaded, targetLetter, content.length, lesson.id, onProgress]);

  // ── Detener cámara ───────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    sessionRef.current += 1; // invalida cualquier startCamera() en vuelo
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    // Parar los tracks desde streamRef (sobrevive al desmontaje) — es lo que
    // apaga la cámara del navegador de verdad. Antes se buscaban vía
    // videoRef.current.srcObject, que en el cleanup de desmontaje ya es null.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    handsRef.current = null;
    setCameraOn(false);
    busyRef.current = false;
  }, []);

  const goBack = useCallback(() => {
    if (step > 0) { setStep(s => s - 1); setQuizAns(null); }
  }, [step]);

  // ── Fallback: mini-quiz visual ───────────────────────────────────
  const openFallbackQuiz = useCallback(() => {
    setQuizOptions(buildQuizOptions(targetLetter));
    setWrongPick(null);
    setQuizOpen(true);
  }, [targetLetter]);

  const answerFallbackQuiz = useCallback((letter: string) => {
    if (wrongPick) return; // ya falló esta ronda; espera a "otra combinación"
    if (letter === targetLetter) {
      // Mismo desbloqueo que lograr la seña con la cámara.
      setSignUnlocked(true);
      setQuizOpen(false);
      setWrongPick(null);
    } else {
      setWrongPick(letter);
    }
  }, [wrongPick, targetLetter]);

  const retryFallbackQuiz = useCallback(() => {
    setQuizOptions(buildQuizOptions(targetLetter));
    setWrongPick(null);
  }, [targetLetter]);

  // ────────────────────────────────────────────────────────────────
  const total = content.length;
  const progressPct = total > 0 ? Math.round((step / total) * 100) : 0;

  // ── Retomar donde se quedó ───────────────────────────────────────
  // El bloque se DERIVA del % guardado (redondeo exacto para nuestro tamaño de
  // lecciones). Por el blindaje del backend (progress = max) el % refleja el
  // bloque más lejano alcanzado, que es justo el punto de retomar. Si la lección
  // ya está completada NO se retoma: se repasa desde el inicio.
  const saved = getForLesson(lesson.id);
  const resumeStep = saved.completed
    ? 0
    : Math.min(total - 1, Math.max(0, Math.round((saved.progress / 100) * total)));
  // Solo se ofrece con AVANCE REAL: progreso guardado > 0 y bloque derivado >= 1
  // (no basta con que exista un registro — el guardado por-bloque crea uno con
  // 0% al abrir la lección). Sin completar y con el progreso ya cargado
  // (progressLoaded) para no decidir con datos a medias.
  const showResumePrompt = progressLoaded && !saved.completed && saved.progress > 0 && resumeStep >= 1 && !resumeDecided;
  const isReview = progressLoaded && saved.completed;
  const resumeBlk = content[resumeStep] as { type?: string; letter?: string } | undefined;
  const resumeExtra = resumeBlk?.type === 'sign' && resumeBlk.letter ? ` · Seña ${resumeBlk.letter}` : '';

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32,marginBottom:10,animation:'breathe 1.6s ease-in-out infinite' }}>⏳</div>
        <div>Cargando lección…</div>
      </div>
    </div>
  );

  // ── Tarjeta: ¿retomar o empezar de nuevo? ────────────────────────
  if (showResumePrompt) return (
    <div className="anim-fade-up" style={{ height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center' }}>
      <div style={{ fontSize:52,marginBottom:14 }}>⏸️</div>
      <div style={{ fontWeight:800,fontSize:21,marginBottom:6 }}>¿Retomar la lección?</div>
      <div style={{ fontSize:13.5,color:'var(--t2)',marginBottom:4 }}>{lesson.title}</div>
      <div style={{ fontSize:13,color:'var(--t3)',marginBottom:26 }}>
        Te quedaste en el bloque {resumeStep + 1} de {total}{resumeExtra}
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:320 }}>
        <button className="btn-primary" style={{ justifyContent:'center',padding:'12px' }}
          onClick={() => { setStep(resumeStep); setResumeDecided(true); }}>
          Continuar donde me quedé →
        </button>
        <button className="btn-ghost" style={{ justifyContent:'center',padding:'12px' }}
          onClick={() => { setStep(0); setResumeDecided(true); }}>
          Empezar de nuevo
        </button>
        <button className="btn-sm" style={{ marginTop:4 }} onClick={onBack}>← Lecciones</button>
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

      {/* Banner tenue de repaso — lección ya completada */}
      {isReview && (
        <div style={{ padding:'7px 16px',background:'var(--teal-d)',borderBottom:'1px solid var(--teal-b)',fontSize:12,color:'var(--teal)',fontWeight:600,flexShrink:0,textAlign:'center' }}>
          🔁 Repaso — ya completaste esta lección
        </div>
      )}

      {/* ── Contenido ── */}
      <div style={{ flex:1,overflowY:'auto' }}>

        {/* ═══ BLOQUE SIGN con cámara ═══════════════════════════════ */}
        {b.type === 'sign' && (
          <div key={step} className="anim-fade-up">

            {/* Éxito overlay */}
            {signUnlocked && (
              <div style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',background:'var(--grn)',color:'var(--on-fill)',borderRadius:20,padding:'6px 18px',fontWeight:700,fontSize:14,zIndex:10,animation:'unlockPopCentered var(--d-celebrate) var(--ease-bounce) both'}}>
                ✅ ¡Seña correcta! Toca Continuar
              </div>
            )}
            {false && (
              <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,background:'var(--scrim)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16 }}>
                <div style={{ fontSize:80 }}>✅</div>
                <div style={{ fontSize:26,fontWeight:800,color:'var(--ink-grn)' }}>¡Seña correcta!</div>
                <div style={{ fontSize:16,color:'var(--ink-t2)' }}>Avanzando…</div>
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
                {/* Imagen de la seña — durante el quiz se difumina (sigue dando una pista tenue, sin delatar la respuesta) */}
                <div style={{ flexShrink:0,width:120,height:120,borderRadius:14,overflow:'hidden',border:'2px solid var(--teal)',background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <img
                    src={`/signs/${b.letter}.png`}
                    alt={`Seña ${b.letter}`}
                    style={{ width:'100%',height:'100%',objectFit:'cover',filter:quizOpen?'blur(7px)':'none',transition:'filter .2s' }}
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
                <span style={{ width:8,height:8,borderRadius:'50%',background:cameraOn?'var(--grn)':'var(--t3)',display:'inline-block' }}/>
                <span style={{ flex:1 }}>{cameraOn ? `Haz la seña "${targetLetter}"` : 'Iniciando cámara…'}</span>
                {/* Cuenta regresiva discreta: solo mientras corre y sin desbloquear */}
                {!signUnlocked && countdown > 0 && (
                  <span
                    title="Si se te complica, en cuanto llegue a 0:00 te ofreceremos otra forma de practicar"
                    style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:countdown<=FALLBACK_WARN_S?'var(--amb)':'var(--t3)',background:'var(--bg3)',border:'1px solid var(--bdr)',borderRadius:20,padding:'3px 10px' }}>
                    ⏱ {fmtTime(countdown)}
                  </span>
                )}
              </div>

              {/* Cámara + referencia — ambas se ocultan por completo mientras el quiz
                  está activo (display:none, no desmontado: conserva el stream/refs de
                  la cámara corriendo en segundo plano para que reaparezca sin reiniciar). */}
              <div style={{ display:quizOpen?'none':'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

                {/* Cámara izquierda */}
                <div style={{ position:'relative',borderRadius:14,overflow:'hidden',background:'var(--bg3)',border:`2px solid ${signUnlocked?'var(--grn)':'var(--bdr)'}`,aspectRatio:'4/3',transition:'border-color .3s' }}>
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
                  {mlDown && cameraOn && !signUnlocked && (
                    <div style={{ position:'absolute',inset:0,zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:18,textAlign:'center',background:'var(--cam-veil)',backdropFilter:'blur(4px)' }}>
                      <div style={{ fontSize:34 }}>🔌</div>
                      <div style={{ fontWeight:800,fontSize:14,color:'var(--ink-red)' }}>Sin conexión con el servicio de reconocimiento</div>
                      <div style={{ fontSize:11.5,color:'var(--ink-t2)',lineHeight:1.5,maxWidth:280 }}>
                        La detección de señas corre en el servidor (ml-service) y no
                        responde. Reintentando automáticamente… o practica de otra
                        forma con el botón de abajo. 👇
                      </div>
                    </div>
                  )}
                  {signUnlocked && (
                    <div style={{ position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',background:'var(--grn)',color:'var(--on-fill)',borderRadius:20,padding:'6px 18px',fontWeight:700,fontSize:14,zIndex:10,whiteSpace:'nowrap',animation:'unlockPopCentered var(--d-celebrate) var(--ease-bounce) both' }}>
                      ✅ ¡Seña correcta!
                    </div>
                  )}
                  {cameraOn && (
                    <div style={{ position:'absolute',bottom:10,left:10,right:10,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                      <div style={{ background:'var(--cam-veil)',borderRadius:10,padding:'8px 14px',display:'flex',alignItems:'center',gap:10 }}>
                        <span style={{ fontSize:13,color:'var(--ink-t3)' }}>Detectando:</span>
                        <span style={{ fontSize:22,fontWeight:900,color: detectedLetter === targetLetter ? 'var(--ink-grn)' : 'var(--ink-t2)' }}>
                          {detectedLetter || '—'}
                        </span>
                      </div>
                      <div style={{ background:'var(--cam-veil)',borderRadius:10,padding:'8px 14px',display:'flex',gap:6,alignItems:'center' }}>
                        {Array.from({ length: STABLE_FRAMES_NEEDED > 10 ? 10 : STABLE_FRAMES_NEEDED }).map((_, i) => (
                          <div key={i} style={{ width:10,height:10,borderRadius:'50%',background: i < Math.round(stableCount * 10 / STABLE_FRAMES_NEEDED) && lastDetected === targetLetter ? 'var(--grn)' : 'var(--bdr)',transition:'background .2s' }}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Imagen de referencia grande derecha — la oculta el display:none del contenedor durante el quiz */}
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
                  <div style={{ position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',background:'var(--cam-veil)',borderRadius:8,padding:'4px 12px',fontSize:12,color:'var(--ink-pri)',fontWeight:600,whiteSpace:'nowrap' }}>
                    Referencia: {targetLetter}
                  </div>
                </div>

              </div>

              {cameraOn && !signUnlocked && !fallbackOffered && (
                <div style={{ marginTop:12,textAlign:'center',fontSize:13,color:'var(--t3)',lineHeight:1.5 }}>
                  Imita la seña de referencia frente a la cámara y mantenla estable
                </div>
              )}

              {/* ── Fallback: ruta alternativa (aparece al agotar el minuto o si el ML está caído) ── */}
              {fallbackOffered && !quizOpen && (
                <div style={{ marginTop:16,padding:'16px',borderRadius:12,background:'var(--vio-d)',border:'1px solid var(--vio-b)',textAlign:'center' }}>
                  <div style={{ fontSize:13.5,color:'var(--t2)',marginBottom:12,lineHeight:1.5 }}>
                    ¿Se te complica hacer la seña? No te preocupes, puedes practicar de otra forma.
                  </div>
                  <button className="btn-primary" onClick={openFallbackQuiz}
                    style={{ background:'var(--nav-ink)',borderColor:'var(--nav-ink)',color:'var(--on-fill)',justifyContent:'center' }}>
                    🧩 ¿Se te complica? Practica de otra forma
                  </button>
                </div>
              )}

              {/* ── Mini-quiz visual: identifica la seña "{targetLetter}" ──
                  Ocupa todo el ancho que dejan libre la cámara y la referencia
                  (ambas ocultas mientras tanto) — es el foco de la pantalla mientras
                  está activo, no un panel flotando pequeño. */}
              {quizOpen && !signUnlocked && (
                <div style={{ marginTop:16,padding:'32px 28px',borderRadius:16,background:'var(--card)',border:'1px solid var(--vio-b)',textAlign:'center' }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:9,marginBottom:8 }}>
                    <span style={{ fontSize:22 }}>🧩</span>
                    <span style={{ fontWeight:700,fontSize:19 }}>¿Cuál es la seña de la letra <span style={{ color:'var(--vio)' }}>{targetLetter}</span>?</span>
                  </div>
                  <div style={{ fontSize:14,color:'var(--t3)',marginBottom:24 }}>
                    Toca la imagen que corresponde a la seña <strong>{targetLetter}</strong>.
                  </div>
                  {/* auto-fit + minmax: 4 en fila en pantallas anchas, cae a 2x2 (o 1 columna)
                      en angostas — sin depender de media queries. */}
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:18 }}>
                    {quizOptions.map(letter => {
                      const isWrong = wrongPick === letter;
                      const answered = wrongPick !== null;
                      return (
                        <button key={letter} className="quiz-tile" onClick={() => answerFallbackQuiz(letter)} disabled={answered}
                          style={{ position:'relative',padding:0,borderRadius:16,overflow:'hidden',cursor:answered?'default':'pointer',background:'var(--bg3)',border:`3px solid ${isWrong?'var(--red)':'var(--bdr)'}`,aspectRatio:'1',transition:'.15s',opacity:answered&&!isWrong?0.5:1 }}>
                          <img
                            src={`/signs/${letter}.png`}
                            alt={`Seña ${letter}`}
                            style={{ width:'100%',height:'100%',objectFit:'contain',padding:14 }}
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:900;color:var(--teal)">${letter}</div>`);
                            }}
                          />
                          {isWrong && <span style={{ position:'absolute',top:8,right:10,fontSize:26 }}>❌</span>}
                        </button>
                      );
                    })}
                  </div>
                  {wrongPick !== null && (
                    <div style={{ marginTop:20,padding:'14px 16px',borderRadius:10,background:'var(--red-d)',border:'1px solid var(--red-b)',maxWidth:520,marginLeft:'auto',marginRight:'auto' }}>
                      <div style={{ fontSize:13.5,color:'var(--red)',fontWeight:600,marginBottom:10 }}>
                        ❌ Esa no era. La seña <strong>{targetLetter}</strong> es otra — inténtalo con una combinación nueva.
                      </div>
                      <button className="btn-ghost" onClick={retryFallbackQuiz} style={{ justifyContent:'center' }}>
                        🔄 Otra combinación
                      </button>
                    </div>
                  )}
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
            <div style={{ background:'var(--amb-d)',border:'1px solid var(--amb-b)',borderRadius:12,padding:'16px 18px',display:'flex',gap:12 }}>
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
                    style={{ padding:'13px 16px',borderRadius:11,cursor:quizAns===null?'pointer':'default',textAlign:'left',fontSize:13.5,fontFamily:'inherit',transition:'.2s',background:isCorrect?'var(--grn-d)':isWrong?'var(--red-d)':'var(--card)',border:`${isCorrect||isWrong?1.5:1}px solid ${isCorrect?'var(--grn)':isWrong?'var(--red)':'var(--bdr)'}`,color:isCorrect?'var(--grn)':isWrong?'var(--red)':'var(--t2)' } as React.CSSProperties}>
                    <span style={{ marginRight:8 }}>{['A','B','C','D'][i]}.</span>{opt}
                    {isCorrect && <span style={{ float:'right' }}>✅</span>}
                    {isWrong   && <span style={{ float:'right' }}>❌</span>}
                  </button>
                );
              })}
            </div>
            {quizAns !== null && (
              <div style={{ marginTop:14,padding:'13px 16px',borderRadius:11,background:quizAns===b.correct?'var(--grn-d)':'var(--red-d)',border:`1px solid ${quizAns===b.correct?'var(--grn)':'var(--red)'}`,fontSize:13,color:'var(--t2)',lineHeight:1.55 }}>
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