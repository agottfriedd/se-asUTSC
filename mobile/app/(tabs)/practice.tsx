import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ML_URL } from '../../src/lib/config';

// Prototipo de riesgo validado en iPhone real (mobile/App.tsx), portado
// aquí sin cambios de lógica. La URL ahora sale de src/lib/config.ts en
// vez de estar hardcodeada en el archivo.
const RECOGNIZE_ENDPOINT = `${ML_URL}/recognize`;

const CAPTURE_INTERVAL_MS = 700; // cada cuánto se manda un frame
const FRAME_WIDTH = 480; // ancho al que se reduce el frame
const JPEG_QUALITY = 0.6; // compresión JPEG (0-1)
const REQUEST_TIMEOUT_MS = 4000; // corta la petición si el server no responde

type RecognizeResponse = {
  letter: string;
  confidence: number;
  hand_found: boolean;
};

type NetState = 'ok' | 'error';

export default function PracticeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [result, setResult] = useState<RecognizeResponse | null>(null);
  const [net, setNet] = useState<NetState>('ok');
  const [running, setRunning] = useState(true);
  // Arranca sin foco: no se monta <CameraView/> hasta confirmar por
  // useFocusEffect que el tab de Práctica está enfocado de verdad.
  const [focused, setFocused] = useState(false);

  // evita solapar peticiones si una tarda más que el intervalo
  const busyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  // Token de sesión — mismo patrón que src/components/SignPractice.tsx y que
  // el sessionRef de la web (LessonDetailView/PracticeView): invalida
  // cualquier foto/respuesta en vuelo que resuelva después de perder el foco.
  const sessionRef = useRef(0);

  // Ciclo de vida por FOCO de pantalla, no solo desmontaje. Esta pantalla es
  // un tab: al cambiar a otro tab con la navegación por tabs de expo-router,
  // el componente sigue MONTADO (solo pierde el foco), así que un cleanup de
  // useEffect al desmontar nunca se dispara y la cámara se queda encendida
  // (el punto verde de iOS no se apaga). useFocusEffect sí detecta la
  // pérdida de foco: aquí se invalida la sesión y se apaga `focused`, lo que
  // desmonta <CameraView/> más abajo y libera la cámara de verdad. Al volver
  // a este tab se reinicia el estado para que la cámara arranque limpia.
  useFocusEffect(
    useCallback(() => {
      sessionRef.current += 1;
      cameraReadyRef.current = false;
      busyRef.current = false;
      setResult(null);
      setNet('ok');
      setFocused(true);
      return () => {
        sessionRef.current += 1;
        cameraReadyRef.current = false;
        busyRef.current = false;
        setFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!permission?.granted || !running || !focused) return;

    const id = setInterval(() => {
      captureAndRecognize();
    }, CAPTURE_INTERVAL_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, running, focused]);

  async function captureAndRecognize() {
    if (busyRef.current || !cameraReadyRef.current || !cameraRef.current) return;
    const mySession = sessionRef.current;
    busyRef.current = true;

    try {
      // 1. Captura frame
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        shutterSound: false,
      });
      // Se perdió el foco (cambio de tab) mientras se tomaba la foto:
      // descartar en vez de seguir procesando sobre una cámara que ya se
      // está desmontando.
      if (sessionRef.current !== mySession || !photo?.uri) return;

      // 2. Reduce a ~480px de ancho + JPEG calidad 0.6 -> base64
      const ctx = ImageManipulator.manipulate(photo.uri);
      ctx.resize({ width: FRAME_WIDTH });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        compress: JPEG_QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (sessionRef.current !== mySession || !saved.base64) return;

      // 3. POST base64 puro (sin prefijo data URI) al endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(RECOGNIZE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: saved.base64, include_landmarks: false }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: RecognizeResponse = await res.json();
      // Respuesta tardía tras cambiar de tab: no tocar el estado de una
      // pantalla que ya no está en foco.
      if (sessionRef.current !== mySession) return;
      setNet('ok');
      setResult(data);
    } catch {
      // Cualquier fallo de red / timeout / server caído
      if (sessionRef.current === mySession) setNet('error');
    } finally {
      busyRef.current = false;
    }
  }

  // ── Estado: permiso todavía cargando ────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // ── Estado: sin permiso de cámara ───────────────────────────
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Cámara sin permiso</Text>
        <Text style={styles.subtitle}>
          Necesitamos acceso a la cámara para reconocer las señas.
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Dar permiso</Text>
        </Pressable>
      </View>
    );
  }

  // ── Sin foco (se cambió de tab, pero la pantalla sigue montada) ─────
  // NO se renderiza <CameraView/>: se libera la cámara de verdad en vez de
  // solo pausar el intervalo de captura (que ya está detenido arriba).
  if (!focused) {
    return <View style={styles.container} />;
  }

  // ── Estado principal: preview + overlay de resultado ────────
  const noHand = result != null && !result.hand_found;
  const confPct =
    result && result.hand_found ? Math.round(result.confidence * 100) : 0;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        animateShutter={false}
        onCameraReady={() => {
          cameraReadyRef.current = true;
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        {/* Banner de red */}
        {net === 'error' && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Sin conexión con el servidor ({ML_URL})
            </Text>
          </View>
        )}

        {/* Tarjeta de resultado */}
        <View style={styles.resultCard}>
          {net === 'error' ? (
            <Text style={styles.hint}>Reintentando…</Text>
          ) : noHand ? (
            <>
              <Text style={styles.letter}>–</Text>
              <Text style={styles.hint}>No se detecta la mano</Text>
            </>
          ) : result ? (
            <>
              <Text style={styles.letter}>{result.letter}</Text>
              <Text style={styles.confidence}>Confianza: {confPct}%</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.hint}>Analizando…</Text>
            </>
          )}
        </View>

        <Pressable style={styles.toggle} onPress={() => setRunning((r) => !r)}>
          <Text style={styles.toggleText}>
            {running ? 'Pausar' : 'Reanudar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 48,
    paddingHorizontal: 20,
    gap: 16,
  },
  banner: {
    backgroundColor: 'rgba(200,40,40,0.9)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  bannerText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  resultCard: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  letter: { color: '#fff', fontSize: 88, fontWeight: '800', lineHeight: 96 },
  confidence: { color: '#9fe', fontSize: 20, fontWeight: '600' },
  hint: { color: '#ccc', fontSize: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#bbb', fontSize: 15, textAlign: 'center' },
  button: {
    marginTop: 12,
    backgroundColor: '#2f6fed',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toggle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  toggleText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
