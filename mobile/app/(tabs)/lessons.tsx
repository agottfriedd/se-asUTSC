import { useEffect, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, apiLevelToLabel, type LessonFromAPI } from '../../src/lib/api';
import { useAuth } from '../../src/hooks/useAuth';
import { useProgress } from '../../src/hooks/useProgress';
import { colors, levelColors, radius, spacing } from '../../src/theme';
import { glassStyle, PBar, Tag, LoadingView, ErrorBanner } from '../../src/components/UI';
import type { LessonLevel } from '../../src/types';

// Portado de frontend/src/views/LessonsView.tsx

const TABS = ['Todos', 'Básico', 'Intermedio', 'Avanzado'] as const;
const LEVELS: LessonLevel[] = ['Básico', 'Intermedio', 'Avanzado'];

type Section = { title: LessonLevel; showHeader: boolean; data: LessonFromAPI[] };

export default function LessonsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getForLesson, loaded: progressLoaded } = useProgress(user.uid);

  const [lessons, setLessons] = useState<LessonFromAPI[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [error, setError]   = useState(false);
  const [tab, setTab]       = useState<typeof TABS[number]>('Todos');

  useEffect(() => {
    if (!progressLoaded) return;
    api.lessons.getAll()
      .then(data => {
        const sorted = [...data].sort((a, b) => a.order - b.order);
        sorted.forEach((l, i) => {
          l.locked = i === 0 ? false : !getForLesson(sorted[i - 1].id).completed;
        });
        setLessons(sorted);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLessonsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressLoaded]);

  if (lessonsLoading || !progressLoaded) return <LoadingView label="Cargando lecciones…" />;

  const levels = LEVELS.filter(l => tab === 'Todos' || l === tab);
  const sections: Section[] = levels
    .map(level => ({
      title: level,
      showHeader: tab === 'Todos',
      data: lessons.filter(l => apiLevelToLabel(l.level) === level),
    }))
    .filter(s => s.data.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        {TABS.map(t => {
          const active = tab === t;
          const color = t === 'Todos' ? colors.teal : levelColors[t];
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, { backgroundColor: active ? color : colors.card, borderColor: active ? color : colors.border }]}
            >
              <Text style={[styles.tabText, { color: active ? '#040D14' : colors.text2 }]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && <View style={styles.errorWrap}><ErrorBanner text="No se pudo cargar las lecciones. Verifica tu red." /></View>}

      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          section.showHeader ? (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBar, { backgroundColor: levelColors[section.title] }]} />
              <Text style={[styles.sectionTitle, { color: levelColors[section.title] }]}>{section.title}</Text>
            </View>
          ) : null
        }
        renderItem={({ item: lesson }) => {
          const prog = getForLesson(lesson.id);
          const level = apiLevelToLabel(lesson.level);
          const color = levelColors[level];
          return (
            <Pressable
              disabled={lesson.locked}
              onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: String(lesson.id) } })}
              style={[glassStyle, styles.lessonCard, { opacity: lesson.locked ? 0.68 : 1 }]}
            >
              <View style={styles.lessonTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.lessonTitle, { color: lesson.locked ? colors.text3 : colors.text1 }]} numberOfLines={1}>
                      {lesson.title}
                    </Text>
                    {prog.completed && <Text style={styles.badge}>✅</Text>}
                    {lesson.locked && <Text style={styles.badge}>🔒</Text>}
                  </View>
                  <Text style={styles.lessonDesc}>{lesson.description}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>⏱ {lesson.duration} min</Text>
                    <Text style={styles.metaText}>📋 {lesson.modules} módulos</Text>
                    <Tag text={level} color={color} />
                  </View>
                  {prog.progress > 0 && <PBar pct={prog.progress} height={5} />}
                </View>
                {!lesson.locked && (
                  <View style={[styles.statusCircle, { backgroundColor: `${color}18` }]}>
                    <Text style={{ fontSize: 16 }}>{prog.completed ? '✅' : prog.progress > 0 ? '▶' : '▷'}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg2,
  },
  tab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  tabText: { fontSize: 12.5, fontWeight: '600' },
  errorWrap: { padding: spacing.md, paddingBottom: 0 },
  listContent: { padding: 14, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9, marginTop: 4 },
  sectionBar: { width: 3, height: 14, borderRadius: 2 },
  sectionTitle: { fontWeight: '700', fontSize: 13 },
  lessonCard: { padding: 14, marginBottom: spacing.sm },
  lessonTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  lessonTitle: { fontWeight: '700', fontSize: 13.5, flexShrink: 1 },
  badge: { fontSize: 13 },
  lessonDesc: { fontSize: 12, color: colors.text3, marginBottom: spacing.sm, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.text3 },
  statusCircle: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
