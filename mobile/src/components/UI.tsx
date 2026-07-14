import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

// Portado de frontend/src/components/UI.tsx — mismos átomos, sin CSS.

// ─── Loading / Error (patrón repetido en las pantallas con fetch) ──
export function LoadingView({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.teal} size="large" />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorBanner({ text }: { text: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>⚠️ {text}</Text>
    </View>
  );
}

// ─── Glass card (equivalente a .glass, sin backdrop-blur) ─────
export const glassStyle: ViewStyle = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.lg,
};

// ─── Progress Bar ──────────────────────────────────────────────
interface PBarProps {
  pct: number; // 0–100
  height?: number;
}
export function PBar({ pct, height = 6 }: PBarProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped}%`, borderRadius: height / 2 }]} />
    </View>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────
interface StatCardProps {
  icon:  string; // emoji
  value: string | number;
  label: string;
  color: string;
}
export function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <View style={[glassStyle, styles.statCard]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
          <Text style={{ fontSize: 17 }}>{icon}</Text>
        </View>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ─── Tag ───────────────────────────────────────────────────────
interface TagProps {
  text:  string;
  color: string;
}
export function Tag({ text, color }: TagProps) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  loadingLabel: {
    fontSize: 13,
    color: colors.text3,
  },
  errorBanner: {
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: `${colors.red}40`,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.red,
    fontSize: 12.5,
    lineHeight: 18,
  },
  track: {
    backgroundColor: colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.teal,
  },
  statCard: {
    padding: spacing.lg,
    flexBasis: '47%',
    flexGrow: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11.5,
    color: colors.text3,
    fontWeight: '500',
    flexShrink: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text1,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
