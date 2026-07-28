import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, type LessonFromAPI } from '../../src/lib/api';
import { useAuth } from '../../src/hooks/useAuth';
import { useProgress } from '../../src/hooks/useProgress';
import { colors, fonts, pressedStyle, spacing } from '../../src/theme';
import { glassStyle, PBar, StatCard, LoadingView, ErrorBanner } from '../../src/components/UI';

// Portado de frontend/src/views/DashboardView.tsx

export default function InicioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getForLesson, globalProgress, loaded: progressLoaded } = useProgress();

  const [lessons, setLessons]         = useState<LessonFromAPI[]>([]);
  const [signCount, setSignCount]     = useState<number | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [error, setError]             = useState(false);

  useEffect(() => {
    Promise.all([api.lessons.getAll(), api.dictionary.getAll()])
      .then(([lessonsData, signsData]) => {
        setLessons(lessonsData);
        setSignCount(signsData.length);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLessonsLoading(false));
  }, []);

  if (lessonsLoading || !progressLoaded) {
    return <LoadingView label="Cargando tu progreso…" />;
  }

  const completedCount = lessons.filter(l => getForLesson(l.id).completed).length;
  const inProgress = lessons.filter(l => {
    const p = getForLesson(l.id);
    return p.progress > 0 && !p.completed;
  });
  const nextUp = lessons
    .filter(l => !getForLesson(l.id).completed && !l.locked && getForLesson(l.id).progress === 0)
    .slice(0, 2);
  const shown = [...inProgress, ...nextUp].slice(0, 3);
  const firstName = user.name.split(' ')[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && <ErrorBanner text="No se pudo conectar con el servidor. Verifica tu red." />}

      <View style={{ marginBottom: spacing.xl }}>
        <Text style={styles.greeting}>
          Hola, <Text style={{ color: colors.teal }}>{firstName}</Text> 👋
        </Text>
        <Text style={styles.streakLine}>🔥 Racha de {user.streak} días. ¡Sigue así!</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard icon="🔥" value={`${user.streak}d`} label="Racha actual" color={colors.amber} />
        <StatCard icon="🎯" value={`${globalProgress}%`} label="Progreso total" color={colors.teal} />
        <StatCard icon="✅" value={completedCount} label="Completadas" color={colors.green} />
        <StatCard icon="🏆" value={user.badges} label="Insignias" color={colors.violet} />
      </View>

      <View style={[glassStyle, styles.progressCard]}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progreso general</Text>
          <Text style={styles.progressPct}>{globalProgress}%</Text>
        </View>
        <PBar pct={globalProgress} height={9} />
        <Text style={styles.progressSub}>
          {completedCount} de {lessons.length} lecciones completadas · Nivel:{' '}
          <Text style={{ color: colors.teal }}>{user.level}</Text>
        </Text>
      </View>

      {shown.length > 0 && (
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={styles.sectionTitle}>Continuar aprendiendo</Text>
          <View style={{ gap: spacing.sm }}>
            {shown.map(l => {
              const prog = getForLesson(l.id);
              return (
                <Pressable
                  key={l.id}
                  style={({ pressed }) => [glassStyle, styles.lessonRow, pressed && pressedStyle]}
                  onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: String(l.id) } })}
                >
                  <View style={styles.lessonRowTop}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={styles.lessonTitle} numberOfLines={1}>{l.title}</Text>
                      <Text style={styles.lessonDesc} numberOfLines={1}>{l.description}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                  <View style={styles.lessonProgressRow}>
                    <View style={{ flex: 1 }}><PBar pct={prog.progress} /></View>
                    <Text style={styles.lessonPct}>{prog.progress}%</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View>
        <Text style={styles.sectionTitle}>Acceso rápido</Text>
        <View style={styles.quickGrid}>
          <Pressable style={({ pressed }) => [glassStyle, styles.quickCard, pressed && pressedStyle]} onPress={() => router.push('/dictionary')}>
            <Text style={styles.quickIcon}>📖</Text>
            <Text style={styles.quickLabel}>Diccionario</Text>
            <Text style={styles.quickSub}>{signCount ?? '—'} señas</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [glassStyle, styles.quickCard, pressed && pressedStyle]} onPress={() => router.push('/lessons')}>
            <Text style={styles.quickIcon}>🎓</Text>
            <Text style={styles.quickLabel}>Lecciones</Text>
            <Text style={styles.quickSub}>{lessons.length} módulos</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  greeting: { fontSize: 21, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.text1, marginBottom: 3 },
  streakLine: { fontSize: 13, fontFamily: fonts.regular, color: colors.text3 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressCard: { padding: spacing.lg, marginBottom: spacing.lg },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  progressLabel: { fontWeight: '700', fontSize: 13.5, fontFamily: fonts.bold, color: colors.text1 },
  progressPct: { fontSize: 13, fontFamily: fonts.bold, color: colors.teal, fontWeight: '700' },
  progressSub: { fontSize: 11.5, fontFamily: fonts.regular, color: colors.text3, marginTop: 7 },
  sectionTitle: { fontWeight: '700', fontSize: 14, fontFamily: fonts.bold, color: colors.text1, marginBottom: spacing.md },
  lessonRow: { padding: 14 },
  lessonRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  lessonTitle: { fontWeight: '600', fontSize: 13.5, fontFamily: fonts.semibold, color: colors.text1 },
  lessonDesc: { fontSize: 11.5, fontFamily: fonts.regular, color: colors.text3, marginTop: 2 },
  chevron: { color: colors.text3, fontSize: 18, fontFamily: fonts.regular },
  lessonProgressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lessonPct: { fontSize: 11, fontFamily: fonts.semibold, color: colors.text3, fontWeight: '600', minWidth: 28 },
  quickGrid: { flexDirection: 'row', gap: spacing.sm },
  quickCard: { flex: 1, padding: spacing.lg, alignItems: 'center' },
  quickIcon: { fontSize: 24, fontFamily: fonts.regular, marginBottom: 7 },
  quickLabel: { fontWeight: '600', fontSize: 13.5, fontFamily: fonts.semibold, color: colors.text1 },
  quickSub: { fontSize: 11, fontFamily: fonts.regular, color: colors.text3, marginTop: 3 },
});
