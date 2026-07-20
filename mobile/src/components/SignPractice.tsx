import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { DEBUG_RECOGNITION, ML_URL } from '../lib/config';
import { SIGN_IMAGES } from '../lib/signImages';
import { colors, radius, spacing } from '../theme';

// ─── Calibración del reconocimiento — AJUSTAR CON PRUEBAS EN IPHONE ────
// Cómo se relacionan las tres constantes:
//   · Cada CAPTURE_INTERVAL_MS se captura un frame y se manda a /recognize,
//     salvo que haya un request en vuelo (busyRef lo impide). La captura +
//     resize + red suman ~200-400ms extra, así que el ritmo efectivo real
//     es ~1.5-2 respuestas/segundo, no 1000/CAPTURE_INTERVAL_MS.
//   · Una respuesta SUMA al contador solo si trae la letra objetivo con
//     confidence > CONFIDENCE_GATE. Hacen falta STABLE_NEEDED consecutivas
//     para desbloquear.
//   · Tiempo real de seña estable ≈ STABLE_NEEDED × ritmo efectivo
//     → 4 × ~500-650ms ≈ 2-2.5 segundos.
//   · Una letra DISTINTA y confiada resetea el contador. "Sin mano", '?'
//     o baja confianza no suman pero tampoco resetean (un parpadeo de
//     detección no roba el progreso).
// Si el gate resulta demasiado alto para móvil (mide con el modo debug:
// DEBUG_RECOGNITION en config.ts o tap largo en la barra "Detectando"),
// baja CONFIDENCE_GATE primero; toca STABLE_NEEDED y el intervalo después.
const CAPTURE_INTERVAL_MS = 500;
const STABLE_NEEDED = 4;
const CONFIDENCE_GATE = 0.72;

// Pipeline de captura — idéntico al validado en practice.tsx
const RECOGNIZE_ENDPOINT = `${ML_URL}/recognize`;
const FRAME_WIDTH = 480;
const JPEG_QUALITY = 0.6;
const REQUEST_TIMEOUT_MS = 4000;

type RecognizeResponse = {
  letter: string;
  confidence: number;
  hand_found: boolean;
};

interface Props {
  /** Letra objetivo del bloque sign. */
  letter: string;
  /** El padre es dueño del estado de desbloqueo (habilita "Continuar"). */
  unlocked: boolean;
  onUnlocked: () => void;
  /** Reporta al padre si el ml-service está caído, para que pueda ofrecer el
   *  fallback (mini-quiz) de inmediato aunque no se agote el temporizador. */
  onMlDownChange?: (down: boolean) => void;
}

export function SignPractice({ letter, unlocked, onUnlocked, onMlDownChange }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const responseCountRef = useRef(0);
  // Token de sesión — equivalente RN del sessionRef de la web
  // (LessonDetailView/PracticeView). Cada vez que la pantalla pierde el foco
  // o el componente se desmonta se incrementa; captureAndRecognize() lo
  // comprueba tras cada await y descarta el resultado si ya no coincide, en
  // vez de aplicar un permiso/foto/respuesta que llegó tarde sobre una
  // cámara que ya debería estar apagada.
  const sessionRef = useRef(0);

  const [last, setLast]               = useState<RecognizeResponse | null>(null);
  const [mlDown, setMlDown]           = useState(false);
  const [stableCount, setStableCount] = useState(0);
  const [refExpanded, setRefExpanded] = useState(false);
  const [debug, setDebug]             = useState(DEBUG_RECOGNITION);
  // Arranca sin foco: no se monta <CameraView/> hasta que useFocusEffect
  // confirme que la pantalla está enfocada de verdad.
  const [focused, setFocused] = useState(false);

  // Desbloqueo al llegar al umbral (como efecto, no dentro del setState)
  useEffect(() => {
    if (!unlocked && stableCount >= STABLE_NEEDED) onUnlocked();
  }, [stableCount, unlocked, onUnlocked]);

  // Espeja mlDown hacia el padre (que decide si ofrece el fallback).
  useEffect(() => {
    onMlDownChange?.(mlDown);
  }, [mlDown, onMlDownChange]);

  // Ciclo de vida por foco de pantalla — NO solo desmontaje. Con navegación
  // por tabs el componente puede seguir montado sin estar visible (p.ej. el
  // usuario cambia de tab); ahí "unmount" nunca dispara y la cámara seguiría
  // corriendo. Al perder el foco (o desmontar — la limpieza de
  // useFocusEffect corre en ambos casos) se invalida la sesión y se apaga el
  // flag `focused`, lo que desmonta <CameraView/> más abajo y libera la
  // cámara de verdad. Al recuperar el foco se reinicia todo el estado de
  // detección para que la cámara arranque limpia.
  useFocusEffect(
    useCallback(() => {
      sessionRef.current += 1;
      cameraReadyRef.current = false;
      busyRef.current = false;
      responseCountRef.current = 0;
      setLast(null);
      setMlDown(false);
      setStableCount(0);
      setFocused(true);
      return () => {
        sessionRef.current += 1;
        cameraReadyRef.current = false;
        busyRef.current = false;
        setFocused(false);
      };
    }, [])
  );

  // Loop de captura. Se detiene al desbloquear (la seña ya se validó:
  // seguir clasificando sería batería y red desperdiciadas), al perder el
  // foco y al desmontar (cambio de bloque o salida de la pantalla).
  useEffect(() => {
    if (!permission?.granted || unlocked || !focused) return;
    const id = setInterval(captureAndRecognize, CAPTURE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, unlocked, focused]);

  async function captureAndRecognize() {
    if (busyRef.current || !cameraReadyRef.current || !cameraRef.current) return;
    const mySession = sessionRef.current;
    busyRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        shutterSound: false,
      });
      // Se perdió el foco mientras se tomaba la foto: descartar en vez de
      // seguir procesando sobre una cámara que ya se está desmontando.
      if (sessionRef.current !== mySession || !photo?.uri) return;

      const ctx = ImageManipulator.manipulate(photo.uri);
      ctx.resize({ width: FRAME_WIDTH });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        compress: JPEG_QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (sessionRef.current !== mySession || !saved.base64) return;

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
      // Respuesta tardía tras salir de la pantalla: no tocar el estado (ni
      // desbloquear la seña) de un componente que ya no está en foco.
      if (sessionRef.current !== mySession) return;
      responseCountRef.current += 1;
      setMlDown(false);
      setLast(data);

      const confident =
        data.hand_found && data.letter !== '?' && data.confidence > CONFIDENCE_GATE;
      if (confident && data.letter === letter) {
        setStableCount(c => c + 1);
      } else if (confident && data.letter !== letter) {
        setStableCount(0); // otra seña clara: se pierde la racha
      }
      // sin mano / '?' / baja confianza: no suma, no resetea
    } catch {
      if (sessionRef.current === mySession) setMlDown(true);
    } finally {
      busyRef.current = false;
    }
  }

  // ── Permiso cargando / denegado ─────────────────────────────────
  if (!permission) {
    return (
      <View style={[styles.cameraBox, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={[styles.cameraBox, styles.center]}>
        <Text style={styles.permTitle}>Cámara sin permiso</Text>
        <Text style={styles.permText}>
          Necesitamos la cámara para validar que haces la seña correctamente.
        </Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Dar permiso</Text>
        </Pressable>
      </View>
    );
  }

  // Sin foco (se salió de la pantalla o se cambió de tab, pero el componente
  // sigue montado): NO se renderiza <CameraView/>, así se libera la cámara
  // de verdad en vez de solo pausar el intervalo de captura.
  if (!focused) {
    return <View style={[styles.cameraBox, { borderColor: colors.border }]} />;
  }

  const refImage = SIGN_IMAGES[letter] ?? null;
  const detected = last?.hand_found ? last.letter : '';
  const match = detected !== '' && detected === letter;

  return (
    <View style={[styles.cameraBox, { borderColor: unlocked ? colors.green : colors.border }]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        animateShutter={false}
        onCameraReady={() => { cameraReadyRef.current = true; }}
      />

      {/* Estado inferior: letra detectada + puntos de estabilidad.
          Tap largo aquí alterna el modo debug. */}
      <Pressable
        style={styles.statusRow}
        onLongPress={() => setDebug(d => !d)}
        delayLongPress={600}
      >
        <View style={styles.pill}>
          <Text style={styles.statusLabel}>Detectando:</Text>
          <Text style={[styles.statusLetter, { color: match ? colors.green : colors.text2 }]}>
            {detected || '—'}
          </Text>
        </View>
        <View style={[styles.pill, { gap: 6 }]}>
          {Array.from({ length: STABLE_NEEDED }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i < stableCount ? colors.green : colors.border2 }]}
            />
          ))}
        </View>
      </Pressable>

      {last && !last.hand_found && !mlDown && !unlocked && (
        <View style={styles.noHand}>
          <Text style={styles.noHandText}>No se detecta la mano</Text>
        </View>
      )}

      {debug && (
        <View style={styles.debugStrip}>
          <Text style={styles.debugText}>
            DBG #{responseCountRef.current} · letra={last?.letter ?? '·'} · conf=
            {last ? last.confidence.toFixed(3) : '·'} · mano=
            {last ? (last.hand_found ? 'sí' : 'no') : '·'} · gate={CONFIDENCE_GATE} · int=
            {CAPTURE_INTERVAL_MS}ms
          </Text>
        </View>
      )}

      {/* PiP: referencia siempre visible mientras haces la seña */}
      <Pressable style={styles.pip} onPress={() => setRefExpanded(true)}>
        {refImage ? (
          <Image source={refImage} style={styles.pipImage} resizeMode="contain" />
        ) : (
          <Text style={styles.pipLetter}>{letter}</Text>
        )}
        <View style={styles.pipCaption}>
          <Text style={styles.pipCaptionText}>Referencia: {letter}</Text>
        </View>
      </Pressable>

      {refExpanded && (
        <Pressable style={styles.expanded} onPress={() => setRefExpanded(false)}>
          {refImage ? (
            <Image source={refImage} style={styles.expandedImage} resizeMode="contain" />
          ) : (
            <Text style={styles.expandedLetter}>{letter}</Text>
          )}
          <Text style={styles.expandedHint}>Toca para cerrar</Text>
        </Pressable>
      )}

      {unlocked && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✅ ¡Seña correcta! Toca Continuar</Text>
        </View>
      )}

      {/* ML caído: sin el servicio NO se puede avanzar de lección */}
      {mlDown && !unlocked && (
        <View style={styles.mlDown}>
          <Text style={{ fontSize: 34 }}>🔌</Text>
          <Text style={styles.mlDownTitle}>Sin conexión con el servicio de reconocimiento</Text>
          <Text style={styles.mlDownText}>
            La validación de señas corre en el servidor (ml-service). No puedes
            avanzar de lección hasta que responda. Reintentando automáticamente…
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraBox: {
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.bg3,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    borderColor: colors.border,
  },
  permTitle: { fontSize: 16, fontWeight: '800', color: colors.text1 },
  permText: { fontSize: 12.5, color: colors.text3, textAlign: 'center', lineHeight: 18 },
  permBtn: {
    backgroundColor: colors.teal,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: radius.md,
  },
  permBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13.5 },

  statusRow: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg2,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statusLabel: { fontSize: 12, color: colors.text3 },
  statusLetter: { fontSize: 20, fontWeight: '900' },
  dot: { width: 10, height: 10, borderRadius: 5 },

  noHand: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.bg2,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  noHandText: { fontSize: 11.5, color: colors.text3 },

  debugStrip: {
    position: 'absolute',
    bottom: 58,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.bg2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  debugText: { fontSize: 10.5, color: colors.amber, fontVariant: ['tabular-nums'] },

  pip: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: '38%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.text1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipImage: { width: '100%', height: '100%' },
  pipLetter: { fontSize: 48, fontWeight: '900', color: colors.teal },
  pipCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg2,
    paddingVertical: 3,
    alignItems: 'center',
  },
  pipCaptionText: { fontSize: 10, fontWeight: '700', color: colors.teal },

  expanded: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    zIndex: 10,
  },
  expandedImage: { width: '85%', aspectRatio: 1, borderRadius: radius.lg },
  expandedLetter: { fontSize: 140, fontWeight: '900', color: colors.teal },
  expandedHint: { fontSize: 12, color: colors.text3 },

  successBanner: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 18,
    zIndex: 5,
  },
  successText: { fontSize: 13.5, fontWeight: '700', color: colors.bg },

  mlDown: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    zIndex: 20,
  },
  mlDownTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.red,
    textAlign: 'center',
  },
  mlDownText: {
    fontSize: 12,
    color: colors.text2,
    textAlign: 'center',
    lineHeight: 18,
  },
});
