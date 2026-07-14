import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, type SignFromAPI } from '../../src/lib/api';
import { useAuth } from '../../src/hooks/useAuth';
import { useFavorites } from '../../src/hooks/useFavorites';
import { colors, radius, spacing } from '../../src/theme';
import { LoadingView, ErrorBanner } from '../../src/components/UI';
import { SignCard } from '../../src/components/SignCard';

// Portado de frontend/src/views/DictionaryView.tsx

const CATS = ['Todos', 'Abecedario', 'Saludos', 'Respuestas', 'Frases útiles', 'Especiales'] as const;

export default function DictionaryScreen() {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites(user.uid);

  const [signs, setSigns]     = useState<SignFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [q, setQ]             = useState('');
  const [cat, setCat]         = useState<typeof CATS[number]>('Todos');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.dictionary.getAll()
      .then(data => { setSigns(data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => signs.filter(s => {
    const matchQ = s.name.toLowerCase().includes(q.toLowerCase()) ||
                   s.description.toLowerCase().includes(q.toLowerCase());
    const matchC = cat === 'Todos' || s.category === cat;
    return matchQ && matchC;
  }), [signs, q, cat]);

  if (loading) return <LoadingView label="Cargando diccionario…" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {error && <ErrorBanner text="No se pudo cargar el diccionario. Verifica tu red." />}

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar seña o descripción…"
            placeholderTextColor={colors.text3}
            value={q}
            onChangeText={setQ}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Text style={styles.clearIcon}>×</Text>
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {CATS.map(c => {
            const active = cat === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCat(c)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
              >
                <Text style={[styles.chipText, { color: active ? '#040D14' : colors.text2 }]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Text style={styles.countLine}>
        {filtered.length} seña{filtered.length !== 1 ? 's' : ''} · {signs.length} en total
      </Text>

      <FlatList
        data={filtered}
        key="grid-2"
        numColumns={2}
        keyExtractor={item => item.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => (
          <SignCard
            sign={item}
            selected={selected === item.id}
            favorite={isFavorite(item.id)}
            onPress={() => setSelected(prev => (prev === item.id ? null : item.id))}
            onToggleFavorite={() => toggle(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤷</Text>
            <Text style={styles.emptyText}>No se encontraron señas</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchIcon: { fontSize: 14, marginRight: spacing.sm, color: colors.text3 },
  searchInput: { flex: 1, color: colors.text1, fontSize: 14, paddingVertical: 11 },
  clearIcon: { color: colors.text3, fontSize: 18, paddingHorizontal: 4 },
  chipsRow: { gap: 7 },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipInactive: { backgroundColor: colors.card, borderColor: colors.border },
  chipText: { fontSize: 12, fontWeight: '600' },
  countLine: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    fontSize: 11.5,
    color: colors.text3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg2,
  },
  row: { gap: spacing.sm },
  gridContent: { padding: 14, gap: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 32, marginBottom: spacing.md },
  emptyText: { fontWeight: '600', color: colors.text2 },
});
