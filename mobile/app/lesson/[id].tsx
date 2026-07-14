import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api, type LessonFromAPI } from '../../src/lib/api';
import { useAuth } from '../../src/hooks/useAuth';
import { useProgress } from '../../src/hooks/useProgress';
import { colors, radius, spacing } from '../../src/theme';
import { glassStyle, PBar, Tag, LoadingView, ErrorBanner } from '../../src/components/UI';
import { SignPractice } from '../../src/components/SignPractice';
import type { ContentBlock } from '../../src/types';

// Flujo didáctico portado de frontend/src/views/LessonDetailView.tsx.
// La calibración del reconocimiento (intervalo, frames estables, gate de
// confianza) vive en src/components/SignPractice.tsx.

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
  const { user } = useAuth();
  const { saveProgress } = useProgress(user.uid);

  const [lesson,  setLesson]  = useState<LessonFromAPI | null>(null);
  const [content, setContent] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [step,         setStep]         = useState(0);
  const [quizAns,      setQuizAns]      = useState<number | null>(null);
  const [signUnlocked, setSignUnlocked] = useState(false);
  const [done,         setDone]         = useState(false);

  useEffect(() => {
    if (!id) return;
    api.lessons.getById(Number(id))
      .then(data => {
        setLesson(data);
        setContent((data.content as ContentBlock[]) ?? []);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Guardar progreso al avanzar (mismo criterio que la web)
  useEffect(() => {
    if (!lesson || content.length === 0 || done) return;
    saveProgress(lesson.id, Math.round((step / content.length) * 100), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, content.length]);

  // Reset de estado por bloque (quiz y seña)
  useEffect(() => {
    setQuizAns(null);
    setSignUnlocked(false);
  }, [step]);

  const total = content.length;
  const block = !done && total > 0 && step < total ? content[step] : null;

  const advance = () => {
    if (step < total - 1) {
      setStep(s => s + 1);
    } else if (lesson) {
      saveProgress(lesson.id, 100, true);
      setDone(true);
    }
  };

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

  if (done) {
    return (
      <>
        <Stack.Screen options={screenOptions(lesson.title)} />
        <View style={styles.doneWrap}>
          <Text style={{ fontSize: 64 }}>🎉</Text>
          <Text style={styles.doneTitle}>¡Lección completada!</Text>
          <Text style={styles.doneSub}>{lesson.title}</Text>
          <View style={styles.doneButtons}>
            <Pressable style={styles.ghostBtn} onPress={() => { setStep(0); setDone(false); }}>
              <Text style={styles.ghostBtnText}>Repasar</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
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
          <Text style={{ fontSize: 36 }}>📭</Text>
          <Text style={styles.emptyText}>Esta lección aún no tiene contenido interactivo.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>← Volver</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // ── Navegación inferior ──────────────────────────────────────────
  const isSign = block.type === 'sign';
  const isQuiz = block.type === 'quiz';
  const nextDisabled = (isQuiz && quizAns === null) || (isSign && !signUnlocked);
  const nextLabel = isSign && !signUnlocked
    ? 'Haz la seña para continuar'
    : step < total - 1 ? (isSign ? 'Continuar →' : 'Siguiente →') : 'Completar ✓';

  return (
    <>
      <Stack.Screen options={screenOptions(lesson.title)} />
      <View style={styles.container}>

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
              <Text style={{ fontSize: 20 }}>{block.emoji}</Text>
              <Text style={[styles.blockBody, { flex: 1 }]}>{block.body}</Text>
            </View>
          )}

          {block.type === 'tip' && (
            <View style={styles.tipBlock}>
              <View style={styles.tipHeader}>
                <Text style={{ fontSize: 18 }}>{block.emoji}</Text>
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
                    style={[
                      styles.quizOpt,
                      isCorrect && { backgroundColor: colors.greenBg, borderColor: colors.green },
                      isWrong   && { backgroundColor: colors.redBg,   borderColor: colors.red },
                    ]}
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
              <View style={styles.signHeader}>
                <Text style={styles.signLetterBig}>{block.letter}</Text>
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

              {/* key={step}: remonta la cámara y resetea el contador por bloque */}
              <SignPractice
                key={step}
                letter={block.letter}
                unlocked={signUnlocked}
                onUnlocked={() => setSignUnlocked(true)}
              />

              {!signUnlocked && (
                <Text style={styles.signHint}>
                  Imita la seña de referencia y mantenla estable frente a la cámara
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Botonera */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.ghostBtn, { opacity: step === 0 ? 0.4 : 1 }]}
            disabled={step === 0}
            onPress={() => setStep(s => s - 1)}
          >
            <Text style={styles.ghostBtnText}>← Anterior</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, { flex: 1, opacity: nextDisabled ? 0.4 : 1 }]}
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
  stepCounter: { fontSize: 11, color: colors.text3, fontWeight: '600', minWidth: 36, textAlign: 'right' },

  // Bloques de texto
  textBlock: { gap: spacing.md },
  blockTitleAccent: { fontSize: 20, fontWeight: '800', color: colors.teal },
  blockTitle: { fontSize: 17, fontWeight: '700', color: colors.text1 },
  blockBody: { fontSize: 14.5, color: colors.text2, lineHeight: 24 },
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
  tipTitle: { fontWeight: '700', fontSize: 14, color: colors.teal },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statBox: { flexGrow: 1, flexBasis: '45%', padding: spacing.lg, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '900', color: colors.teal, marginBottom: 4 },
  statCaption: { fontSize: 11.5, color: colors.text3, textAlign: 'center', lineHeight: 16 },

  // Quiz
  quizQ: { fontWeight: '700', fontSize: 15.5, color: colors.text1, lineHeight: 22, marginVertical: spacing.sm },
  quizOpt: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quizOptText: { fontSize: 13.5, color: colors.text2, lineHeight: 19 },
  quizFeedback: { padding: 14, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.xs },
  quizFeedbackText: { fontSize: 13, color: colors.text2, lineHeight: 19 },

  // Sign
  signHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  signLetterBig: { fontSize: 40, fontWeight: '900', color: colors.teal, lineHeight: 44 },
  signName: { fontWeight: '700', fontSize: 17, color: colors.text1, marginBottom: 4 },
  signDesc: { fontSize: 13, color: colors.text2, lineHeight: 19 },
  signTipBox: {
    backgroundColor: colors.tealBg,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  signTipText: { fontSize: 12, color: colors.teal, lineHeight: 17 },
  signHint: { fontSize: 12.5, color: colors.text3, textAlign: 'center', lineHeight: 18 },

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
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13.5 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: colors.text1, fontWeight: '600', fontSize: 13.5 },

  // Done / empty
  doneWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  doneTitle: { fontSize: 24, fontWeight: '800', color: colors.text1 },
  doneSub: { fontSize: 14, color: colors.text2 },
  doneButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  emptyText: { fontSize: 14, color: colors.text2, textAlign: 'center' },
});
