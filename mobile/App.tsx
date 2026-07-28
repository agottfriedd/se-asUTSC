import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts, pressedStyle } from './src/theme';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// ─────────────────────────────────────────────────────────────
//  CONFIG — cambia esta IP por la del equipo que corre ml-service
//  (misma red WiFi que el teléfono). El puerto por defecto es 8000.
// ─────────────────────────────────────────────────────────────
const API_BASE_URL = 'http://192.168.1.29:8000';
const RECOGNIZE_ENDPOINT = `${API_BASE_URL}/recognize`;

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

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [result, setResult] = useState<RecognizeResponse | null>(null);
  const [net, setNet] = useState<NetState>('ok');
  const [running, setRunning] = useState(true);

  // evita solapar peticiones si una tarda más que el intervalo
  const busyRef = useRef(false);
  const cameraReadyRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted || !running) return;

    const id = setInterval(() => {
      captureAndRecognize();
    }, CAPTURE_INTERVAL_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, running]);

  async function captureAndRecognize() {
    if (busyRef.current || !cameraReadyRef.current || !cameraRef.current) return;
    busyRef.current = true;

    try {
      // 1. Captura frame
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!photo?.uri) return;

      // 2. Reduce a ~480px de ancho + JPEG calidad 0.6 -> base64
      const ctx = ImageManipulator.manipulate(photo.uri);
      ctx.resize({ width: FRAME_WIDTH });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        compress: JPEG_QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!saved.base64) return;

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
      setNet('ok');
      setResult(data);
    } catch (e) {
      // Cualquier fallo de red / timeout / server caído
      setNet('error');
    } finally {
      busyRef.current = false;
    }
  }

  // ── Estado: permiso todavía cargando ────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.inkT1} />
        <StatusBar style="light" />
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
        <Pressable style={({ pressed }) => [styles.button, pressed && pressedStyle]} onPress={requestPermission}>
          <Text style={styles.buttonText}>Dar permiso</Text>
        </Pressable>
        <StatusBar style="light" />
      </View>
    );
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
              Sin conexión con el servidor ({API_BASE_URL})
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
              <ActivityIndicator size="small" color={colors.inkT1} />
              <Text style={styles.hint}>Analizando…</Text>
            </>
          )}
        </View>

        <Pressable style={({ pressed }) => [styles.toggle, pressed && pressedStyle]} onPress={() => setRunning((r) => !r)}>
          <Text style={styles.toggleText}>
            {running ? 'Pausar' : 'Reanudar'}
          </Text>
        </Pressable>
      </View>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  center: {
    flex: 1,
    backgroundColor: colors.ink2,
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
    backgroundColor: colors.red,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  bannerText: { color: colors.onFill, textAlign: 'center', fontWeight: '600' },
  resultCard: {
    backgroundColor: colors.camVeil,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  letter: { color: colors.inkT1, fontSize: 88, fontFamily: fonts.extrabold, fontWeight: '800', lineHeight: 96 },
  confidence: { color: colors.inkPri, fontSize: 20, fontFamily: fonts.semibold, fontWeight: '600' },
  hint: { color: colors.inkT2, fontSize: 16, fontFamily: fonts.regular },
  title: { color: colors.inkT1, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700' },
  subtitle: { color: colors.inkT2, fontSize: 15, fontFamily: fonts.regular, textAlign: 'center' },
  button: {
    marginTop: 12,
    backgroundColor: colors.pri,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonText: { color: colors.onPri, fontSize: 16, fontFamily: fonts.bold, fontWeight: '700' },
  toggle: {
    alignSelf: 'center',
    backgroundColor: colors.camChip,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  toggleText: { color: colors.inkT1, fontSize: 15, fontFamily: fonts.semibold, fontWeight: '600' },
});
