import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { api, type LessonFromAPI } from '../../src/lib/api';
import { useProgress } from '../../src/hooks/useProgress';
import { colors, fonts, pressedStyle, radius, spacing } from '../../src/theme';
import { glassStyle, PBar, Tag, LoadingView, ErrorBanner } from '../../src/components/UI';
import { SignPractice } from '../../src/components/SignPractice';
import { SIGN_IMAGES } from '../../src/lib/signImages';
import type { ContentBlock } from '../../src/types';

// Flujo didáctico portado de frontend/src/views/LessonDetailView.tsx.
// La calibración del reconocimiento (intervalo, frames estables, gate de
// confianza) vive en src/components/SignPractice.tsx.

// ── Fallback de práctica (mini-quiz visual) ──────────────────────────
// Portado de LessonDetailView.tsx (web). Si tras este tiempo el usuario no
// logra la seña con la cámara —o si el ml-service está caído— se le ofrece una
// ruta alternativa (identificar la seña entre 4 imágenes) para no atascarse.
const FALLBACK_TIMEOUT_S = 35;
// Aviso ámbar de los últimos segundos, proporcional al timeout (60→10, 35→6):
// era un 10 fijo; ahora se deriva para escalar con FALLBACK_TIMEOUT_S.
const FALLBACK_WARN_S = Math.round(FALLBACK_TIMEOUT_S / 6);

// Pool de distractores: solo letras con imagen (las claves de SIGN_IMAGES),
// así ninguna opción cae al fallback de texto que delataría cuáles son de
// relleno.
const SIGN_POOL = Object.keys(SIGN_IMAGES);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 4 opciones: la letra objetivo + 3 distractoras aleatorias, barajadas.
function buildQuizOptions(target: string): string[] {
  const distractors = shuffle(SIGN_POOL.filter(l => l !== target)).slice(0, 3);
  return shuffle([target, ...distractors]);
}

// Segundos → "m:ss"
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// La ruta raíz oculta el header; esta pantalla vive fuera de (tabs) y lo
// reactiva para tener botón de volver.
const screenOptions = (title: string) => ({
  title,
  headerShown: true,
  headerStyle: { backgroundColor: colors.bg2 },
  headerTintColor: colors.text1,
  headerShadowVisible: false,
});

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { saveProgress, getForLesson, loaded: progressLoaded } = useProgress();

  const [lesson,  setLesson]  = useState<LessonFromAPI | null>(null);
  const [content, setContent] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [step,         setStep]         = useState(0);
  const [quizAns,      setQuizAns]      = useState<number | null>(null);
  const [signUnlocked, setSignUnlocked] = useState(false);
  const [done,         setDone]         = useState(false);
  // Retomar donde se quedó: mientras no se decida (Continuar / Empezar de nuevo)
  // se muestra la tarjeta de retomar en vez del bloque.
  const [resumeDecided, setResumeDecided] = useState(false);

  // ── Fallback (mini-quiz visual) ─────────────────────────────────
  const [countdown,    setCountdown]    = useState(FALLBACK_TIMEOUT_S);
  const [mlDown,       setMlDown]       = useState(false);   // reportado por SignPractice
  const [quizOpen,     setQuizOpen]     = useState(false);
  const [quizOptions,  setQuizOptions]  = useState<string[]>([]);
  const [wrongPick,    setWrongPick]    = useState<string | null>(null);
  // Foco de la pantalla: gatea el temporizador (respeta M2 — al perder el foco
  // se para el timer, igual que la cámara).
  const [focused,      setFocused]      = useState(true);

  useEffect(() => {
    if (!id) return;
    setResumeDecided(false);
    api.lessons.getById(Number(id))
      .then(data => {
        setLesson(data);
        setContent((data.content as ContentBlock[]) ?? []);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Decisión de retomar: UNA sola vez al ABRIR ───────────────────
  // En cuanto contenido y progreso cargaron, si NO hay avance real que retomar
  // se resuelve de inmediato (resumeDecided=true → entrar directo). Así, avanzar
  // bloques —que sube el % vía el guardado por-bloque— NO vuelve a disparar la
  // tarjeta. Si sí hay avance, se deja que la tarjeta se muestre y el usuario
  // elija. Depende SOLO del momento de carga (no de saved.progress).
  useEffect(() => {
    if (resumeDecided || !progressLoaded || !lesson || content.length === 0) return;
    const s = getForLesson(lesson.id);
    const rStep = s.completed ? 0 : Math.min(content.length - 1, Math.max(0, Math.round((s.progress / 100) * content.length)));
    const shouldPrompt = !s.completed && s.progress > 0 && rStep >= 1;
    if (!shouldPrompt) setResumeDecided(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressLoaded, content.length, lesson?.id]);

  // Guardar progreso al avanzar (mismo criterio que la web)
  useEffect(() => {
    if (!lesson || content.length === 0 || done) return;
    saveProgress(lesson.id, Math.round((step / content.length) * 100), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, content.length]);

  // Reset de estado por bloque (quiz, seña y fallback). El temporizador
  // vuelve a 60s aquí; el intervalo lo arranca el efecto de abajo.
  useEffect(() => {
    setQuizAns(null);
    setSignUnlocked(false);
    setCountdown(FALLBACK_TIMEOUT_S);
    setMlDown(false);
    setQuizOpen(false);
    setQuizOptions([]);
    setWrongPick(null);
  }, [step]);

  const total = content.length;
  const block = !done && total > 0 && step < total ? content[step] : null;
  const isSign = block?.type === 'sign';

  // Foco de pantalla — para el temporizador al salir/perder foco (M2).
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  // ── Temporizador del fallback ────────────────────────────────────
  // Cuenta regresiva mientras se está en un bloque de seña sin desbloquear y
  // con la pantalla enfocada. Se reinicia al cambiar de bloque (efecto de
  // arriba), se cancela al desbloquear (deja de cumplirse la condición), al
  // perder el foco y en el cleanup (no fuga el interval).
  useEffect(() => {
    if (!isSign || signUnlocked || !focused) return;
    const id = setInterval(() => {
      setCountdown(c => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isSign, signUnlocked, focused, step]);

  // El fallback se ofrece si, en un bloque de seña sin desbloquear, se agotó el
  // minuto O el ml-service está caído (para no atascarse). Con la seña ya
  // lograda nunca aparece.
  const fallbackOffered = !!isSign && !signUnlocked && (countdown === 0 || mlDown);

  const openFallbackQuiz = useCallback((target: string) => {
    setQuizOptions(buildQuizOptions(target));
    setWrongPick(null);
    setQuizOpen(true);
  }, []);

  const answerFallbackQuiz = useCallback((picked: string, target: string) => {
    if (wrongPick) return; // ya falló esta ronda; espera "otra combinación"
    if (picked === target) {
      // Mismo desbloqueo que lograr la seña con la cámara.
      setSignUnlocked(true);
      setQuizOpen(false);
      setWrongPick(null);
    } else {
      setWrongPick(picked);
    }
  }, [wrongPick]);

  const retryFallbackQuiz = useCallback((target: string) => {
    setQuizOptions(buildQuizOptions(target));
    setWrongPick(null);
  }, []);

  const advance = () => {
    if (step < total - 1) {
      setStep(s => s + 1);
    } else if (lesson) {
      saveProgress(lesson.id, 100, true);
      setDone(true);
    }
  };

  // ── Retomar donde se quedó ───────────────────────────────────────
  // El bloque se DERIVA del % guardado (redondeo exacto para nuestro tamaño de
  // lecciones). Por el blindaje del backend (progress = max) el % refleja el
  // bloque más lejano alcanzado. Si ya está completada NO se retoma: se repasa
  // desde el inicio. Se espera a que el progreso esté cargado (progressLoaded).
  const saved = lesson ? getForLesson(lesson.id) : null;
  const resumeStep = saved && !saved.completed && total > 0
    ? Math.min(total - 1, Math.max(0, Math.round((saved.progress / 100) * total)))
    : 0;
  // Solo con AVANCE REAL: progreso guardado > 0 y bloque derivado >= 1 (no basta
  // con que exista un registro — el guardado por-bloque crea uno con 0% al abrir).
  const showResumePrompt = !!saved && progressLoaded && !saved.completed && saved.progress > 0 && resumeStep >= 1 && !resumeDecided;
  const isReview = !!saved && progressLoaded && saved.completed;
  const resumeBlk = content[resumeStep] as { type?: string; letter?: string } | undefined;
  const resumeExtra = resumeBlk?.type === 'sign' && resumeBlk.letter ? ` · Seña ${resumeBlk.letter}` : '';

  // ── Carga / error / completado / sin contenido ──────────────────
  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions('Lección')} />
        <LoadingView label="Cargando lección…" />
      </>
    );
  }

  if (error || !lesson) {
    return (
      <>
        <Stack.Screen options={screenOptions('Lección')} />
        <View style={styles.pad}>
          <ErrorBanner text="No se pudo cargar esta lección. Verifica tu red e inténtalo de nuevo." />
        </View>
      </>
    );
  }

  // ── Tarjeta: ¿retomar o empezar de nuevo? ────────────────────────
  if (showResumePrompt) {
    return (
      <>
        <Stack.Screen options={screenOptions(lesson.title)} />
        <View style={styles.resumeWrap}>
          <Text style={{ fontSize: 52, fontFamily: fonts.regular }}>⏸️</Text>
          <Text style={styles.resumeTitle}>¿Retomar la lección?</Text>
          <Text style={styles.resumeSub}>{lesson.title}</Text>
          <Text style={styles.resumeInfo}>
            Te quedaste en el bloque {resumeStep + 1} de {total}{resumeExtra}
          </Text>
          <View style={styles.resumeButtons}>
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && pressedStyle]} onPress={() => { setStep(resumeStep); setResumeDecided(true); }}>
              <Text style={styles.primaryBtnText}>Continuar donde me quedé →</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && pressedStyle]} onPress={() => { setStep(0); setResumeDecided(true); }}>
              <Text style={styles.ghostBtnText}>Empezar de nuevo</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.resumeBack, pressed && pressedStyle]}>
              <Text style={styles.resumeBackText}>← Lecciones</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  if (done) {
    return (
      <>
        <Stack.Screen options={screenOptions(lesson.title)} />
        <View style={styles.doneWrap}>
          <Text style={{ fontSize: 64, fontFamily: fonts.regular }}>🎉</Text>
          <Text style={styles.doneTitle}>¡Lección completada!</Text>
          <Text style={styles.doneSub}>{lesson.title}</Text>
          <View style={styles.doneButtons}>
            <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && pressedStyle]} onPress={() => { setStep(0); setDone(false); }}>
              <Text style={styles.ghostBtnText}>Repasar</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && pressedStyle]} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>Volver a lecciones →</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  if (!block) {
    return (
      <>
        <Stack.Screen options={screenOptions(lesson.title)} />
        <View style={[styles.pad, { alignItems: 'center', gap: spacing.md }]}>
          <Text style={{ fontSize: 36, fontFamily: fonts.regular }}>📭</Text>
          <Text style={styles.emptyText}>Esta lección aún no tiene contenido interactivo.</Text>
          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && pressedStyle]} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>← Volver</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // ── Navegación inferior ──────────────────────────────────────────
  // isSign ya está declarado arriba (para el temporizador del fallback).
  const isQuiz = block.type === 'quiz';
  const nextDisabled = (isQuiz && quizAns === null) || (isSign && !signUnlocked);
  const nextLabel = isSign && !signUnlocked
    ? 'Haz la seña para continuar'
    : step < total - 1 ? (isSign ? 'Continuar →' : 'Siguiente →') : 'Completar ✓';

  return (
    <>
      <Stack.Screen options={screenOptions(lesson.title)} />
      <View style={styles.container}>

        {/* Banner tenue de repaso — lección ya completada */}
        {isReview && (
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerText}>🔁 Repaso — ya completaste esta lección</Text>
          </View>
        )}

        {/* Barra de progreso + contador de pasos */}
        <View style={styles.progressRow}>
          <View style={{ flex: 1 }}>
            <PBar pct={Math.round((step / total) * 100)} height={5} />
          </View>
          <Text style={styles.stepCounter}>{step + 1}/{total}</Text>
        </View>

        {/* Contenido del bloque */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.pad}>
          {block.type === 'intro' && (
            <View style={styles.textBlock}>
              <Text style={styles.blockTitleAccent}>{block.title}</Text>
              <Text style={styles.blockBody}>{block.body}</Text>
            </View>
          )}

          {block.type === 'body' && (
            <View style={styles.textBlock}>
              <Text style={styles.blockTitle}>{block.title}</Text>
              <Text style={styles.blockBody}>{block.body}</Text>
            </View>
          )}

          {block.type === 'highlight' && (
            <View style={styles.highlightBox}>
              <Text style={{ fontSize: 20, fontFamily: fonts.regular }}>{block.emoji}</Text>
              <Text style={[styles.blockBody, { flex: 1 }]}>{block.body}</Text>
            </View>
          )}

          {block.type === 'tip' && (
            <View style={styles.tipBlock}>
              <View style={styles.tipHeader}>
                <Text style={{ fontSize: 18, fontFamily: fonts.regular }}>{block.emoji}</Text>
                <Text style={styles.tipTitle}>{block.title}</Text>
              </View>
              <Text style={styles.blockBody}>{block.body}</Text>
            </View>
          )}

          {block.type === 'stats' && (
            <View style={styles.statsGrid}>
              {block.items.map(({ n, l }) => (
                <View key={n} style={[glassStyle, styles.statBox]}>
                  <Text style={styles.statNumber}>{n}</Text>
                  <Text style={styles.statCaption}>{l}</Text>
                </View>
              ))}
            </View>
          )}

          {block.type === 'quiz' && (
            <View style={{ gap: spacing.sm }}>
              <Tag text="📝 Pregunta de comprensión" color={colors.violet} />
              <Text style={styles.quizQ}>{block.q}</Text>
              {block.opts.map((opt, i) => {
                const isCorrect = quizAns !== null && i === block.correct;
                const isWrong   = quizAns === i && i !== block.correct;
                return (
                  <Pressable
                    key={i}
                    disabled={quizAns !== null}
                    onPress={() => setQuizAns(i)}
                    style={({ pressed }) => [
                      styles.quizOpt,
                      isCorrect && { backgroundColor: colors.greenBg, borderColor: colors.green },
                      isWrong   && { backgroundColor: colors.redBg,   borderColor: colors.red },
                    , pressed && pressedStyle]}
                  >
                    <Text style={[
                      styles.quizOptText,
                      isCorrect && { color: colors.green },
                      isWrong   && { color: colors.red },
                    ]}>
                      {['A', 'B', 'C', 'D'][i]}. {opt}{isCorrect ? '  ✅' : isWrong ? '  ❌' : ''}
                    </Text>
                  </Pressable>
                );
              })}
              {quizAns !== null && (
                <View style={[
                  styles.quizFeedback,
                  quizAns === block.correct
                    ? { backgroundColor: colors.greenBg, borderColor: colors.green }
                    : { backgroundColor: colors.redBg, borderColor: colors.red },
                ]}>
                  <Text style={styles.quizFeedbackText}>
                    {quizAns === block.correct ? '✅ ' : '❌ '}{block.feedback}
                  </Text>
                </View>
              )}
            </View>
          )}

          {block.type === 'sign' && (
            <View style={{ gap: spacing.md }}>
              {/* Header: miniatura de referencia (con blur durante el quiz) +
                  letra objetivo + nombre + descripción. */}
              <View style={styles.signHeader}>
                {SIGN_IMAGES[block.letter] ? (
                  <Image
                    source={SIGN_IMAGES[block.letter]}
                    style={styles.signThumb}
                    resizeMode="contain"
                    // Durante el quiz se difumina: da una pista tenue sin
                    // delatar cuál de las 4 imágenes es la respuesta.
                    blurRadius={quizOpen ? 14 : 0}
                  />
                ) : (
                  <Text style={styles.signLetterBig}>{block.letter}</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.signName}>{block.name}</Text>
                  <Text style={styles.signDesc}>{block.description}</Text>
                </View>
              </View>

              {block.tip ? (
                <View style={styles.signTipBox}>
                  <Text style={styles.signTipText}>💡 {block.tip}</Text>
                </View>
              ) : null}

              {signUnlocked ? (
                // Desbloqueada (por cámara o por el quiz): tarjeta de éxito con
                // la cámara APAGADA — no re-montamos <CameraView/> solo para
                // mostrar un banner estático (respeta el objetivo de M2).
                <View style={styles.signDoneCard}>
                  <Text style={styles.signDoneText}>✅ ¡Seña correcta! Toca Continuar</Text>
                </View>
              ) : quizOpen ? (
                // ── Mini-quiz visual: cámara y referencia grande OCULTAS,
                //    el quiz es el único foco (2x2 grande). ──
                <View style={styles.quizCard}>
                  <Text style={styles.quizTitle}>
                    🧩 ¿Cuál es la seña de la letra{' '}
                    <Text style={styles.quizTitleLetter}>{block.letter}</Text>?
                  </Text>
                  <Text style={styles.quizSub}>Toca la imagen que corresponde a la seña.</Text>

                  <View style={styles.quizGrid}>
                    {quizOptions.map(l => {
                      const isWrong  = wrongPick === l;
                      const answered = wrongPick !== null;
                      return (
                        <Pressable
                          key={l}
                          disabled={answered}
                          onPress={() => answerFallbackQuiz(l, block.letter)}
                          style={({ pressed }) => [
                            styles.quizTile,
                            isWrong && { borderColor: colors.red },
                            answered && !isWrong && { opacity: 0.45 },
                          , pressed && pressedStyle]}
                        >
                          {SIGN_IMAGES[l] ? (
                            <Image source={SIGN_IMAGES[l]} style={styles.quizTileImg} resizeMode="contain" />
                          ) : (
                            <Text style={styles.quizTileLetter}>{l}</Text>
                          )}
                          {isWrong && <Text style={styles.quizTileX}>❌</Text>}
                        </Pressable>
                      );
                    })}
                  </View>

                  {wrongPick !== null && (
                    <View style={styles.quizWrongBox}>
                      <Text style={styles.quizWrongText}>
                        ❌ Esa no era. La seña {block.letter} es otra — inténtalo con una combinación nueva.
                      </Text>
                      <Pressable style={({ pressed }) => [styles.retryBtn, pressed && pressedStyle]} onPress={() => retryFallbackQuiz(block.letter)}>
                        <Text style={styles.retryBtnText}>🔄 Otra combinación</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : (
                // ── Flujo normal con cámara ──
                <>
                  {countdown > 0 && (
                    <View style={styles.countdownRow}>
                      <View style={[styles.countdownPill, countdown <= FALLBACK_WARN_S && styles.countdownPillWarn]}>
                        <Text style={[styles.countdownText, countdown <= FALLBACK_WARN_S && { color: colors.amber }]}>
                          ⏱ {fmtTime(countdown)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* key={step}: remonta la cámara y resetea el contador por bloque */}
                  <SignPractice
                    key={step}
                    letter={block.letter}
                    unlocked={signUnlocked}
                    onUnlocked={() => setSignUnlocked(true)}
                    onMlDownChange={setMlDown}
                  />

                  {fallbackOffered && (
                    <Pressable style={({ pressed }) => [styles.fallbackBtn, pressed && pressedStyle]} onPress={() => openFallbackQuiz(block.letter)}>
                      <Text style={styles.fallbackBtnText}>🧩 ¿Se te complica? Practica de otra forma</Text>
                    </Pressable>
                  )}

                  <Text style={styles.signHint}>
                    Imita la seña de referencia y mantenla estable frente a la cámara
                  </Text>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Botonera */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, { opacity: step === 0 ? 0.4 : 1 }, pressed && pressedStyle]}
            disabled={step === 0}
            onPress={() => setStep(s => s - 1)}
          >
            <Text style={styles.ghostBtnText}>← Anterior</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, { flex: 1, opacity: nextDisabled ? 0.4 : 1 }, pressed && pressedStyle]}
            disabled={nextDisabled}
            onPress={advance}
          >
            <Text style={styles.primaryBtnText}>{nextLabel}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.xl },

  // Tarjeta de retomar
  resumeWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  resumeTitle: { fontSize: 21, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.text1, marginTop: spacing.sm },
  resumeSub:   { fontSize: 13.5, fontFamily: fonts.regular, color: colors.text2 },
  resumeInfo:  { fontSize: 13, fontFamily: fonts.regular, color: colors.text3, marginBottom: spacing.lg, textAlign: 'center' },
  resumeButtons: { width: '100%', maxWidth: 320, gap: spacing.sm },
  resumeBack:  { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  resumeBackText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text3, fontWeight: '600' },

  // Banner tenue de repaso
  reviewBanner: {
    paddingVertical: 7,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.tealBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.tealBorder,
    alignItems: 'center',
  },
  reviewBannerText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.teal, fontWeight: '600' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepCounter: { fontSize: 11, fontFamily: fonts.semibold, color: colors.text3, fontWeight: '600', minWidth: 36, textAlign: 'right' },

  // Bloques de texto
  textBlock: { gap: spacing.md },
  blockTitleAccent: { fontSize: 20, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.teal },
  blockTitle: { fontSize: 17, fontFamily: fonts.bold, fontWeight: '700', color: colors.text1 },
  blockBody: { fontSize: 14.5, fontFamily: fonts.regular, color: colors.text2, lineHeight: 24 },
  highlightBox: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: `${colors.amber}40`,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  tipBlock: {
    backgroundColor: colors.tealBg,
    borderWidth: 1,
    borderColor: colors.tealBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipTitle: { fontWeight: '700', fontSize: 14, fontFamily: fonts.bold, color: colors.teal },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statBox: { flexGrow: 1, flexBasis: '45%', padding: spacing.lg, alignItems: 'center' },
  statNumber: { fontSize: 24, fontFamily: fonts.extrabold, fontWeight: '900', color: colors.teal, marginBottom: 4 },
  statCaption: { fontSize: 11.5, fontFamily: fonts.regular, color: colors.text3, textAlign: 'center', lineHeight: 16 },

  // Quiz
  quizQ: { fontWeight: '700', fontSize: 15.5, fontFamily: fonts.bold, color: colors.text1, lineHeight: 22, marginVertical: spacing.sm },
  quizOpt: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quizOptText: { fontSize: 13.5, fontFamily: fonts.regular, color: colors.text2, lineHeight: 19 },
  quizFeedback: { padding: 14, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.xs },
  quizFeedbackText: { fontSize: 13, fontFamily: fonts.regular, color: colors.text2, lineHeight: 19 },

  // Sign
  signHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  signLetterBig: { fontSize: 40, fontFamily: fonts.extrabold, fontWeight: '900', color: colors.teal, lineHeight: 44 },
  signThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.text1,
  },
  signName: { fontWeight: '700', fontSize: 17, fontFamily: fonts.bold, color: colors.text1, marginBottom: 4 },
  signDesc: { fontSize: 13, fontFamily: fonts.regular, color: colors.text2, lineHeight: 19 },
  signTipBox: {
    backgroundColor: colors.tealBg,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  signTipText: { fontSize: 12, fontFamily: fonts.regular, color: colors.teal, lineHeight: 17 },
  signHint: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.text3, textAlign: 'center', lineHeight: 18 },

  // Éxito (desbloqueo por cámara o por quiz) — cámara ya apagada
  signDoneCard: {
    backgroundColor: colors.greenBg,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  signDoneText: { fontSize: 15, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.green },

  // Cuenta regresiva del fallback (discreta pero visible)
  countdownRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  countdownPillWarn: { borderColor: colors.amber },
  countdownText: { fontSize: 12, fontFamily: fonts.bold, fontWeight: '700', color: colors.text3, fontVariant: ['tabular-nums'] },

  // Botón que ofrece el fallback
  fallbackBtn: {
    backgroundColor: colors.violet,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  fallbackBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13.5, fontFamily: fonts.bold },

  // Mini-quiz visual (2x2 de imágenes grandes)
  quizCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.violetBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  quizTitle: { fontSize: 16, fontFamily: fonts.bold, fontWeight: '700', color: colors.text1, textAlign: 'center', lineHeight: 22 },
  quizTitleLetter: { color: colors.violet, fontWeight: '900' },
  quizSub: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.text3, textAlign: 'center' },
  quizGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  quizTile: {
    flexBasis: '46%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.border2,
    backgroundColor: colors.text1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTileImg: { width: '100%', height: '100%' },
  quizTileLetter: { fontSize: 56, fontFamily: fonts.extrabold, fontWeight: '900', color: colors.teal },
  quizTileX: { position: 'absolute', top: 6, right: 8, fontSize: 24, fontFamily: fonts.regular },
  quizWrongBox: {
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: `${colors.red}4D`,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  quizWrongText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.red, fontWeight: '600', lineHeight: 19 },
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  retryBtnText: { color: colors.text1, fontWeight: '600', fontSize: 13, fontFamily: fonts.semibold },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg2,
  },
  primaryBtn: {
    backgroundColor: colors.pri,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.onPri, fontWeight: '700', fontSize: 13.5, fontFamily: fonts.bold },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: colors.text1, fontWeight: '600', fontSize: 13.5, fontFamily: fonts.semibold },

  // Done / empty
  doneWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  doneTitle: { fontSize: 24, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.text1 },
  doneSub: { fontSize: 14, fontFamily: fonts.regular, color: colors.text2 },
  doneButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  emptyText: { fontSize: 14, fontFamily: fonts.regular, color: colors.text2, textAlign: 'center' },
});
