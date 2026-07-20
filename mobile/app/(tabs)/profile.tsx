import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { BADGES_LIST } from '../../src/data/badges';
import { colors, radius, spacing } from '../../src/theme';
import { glassStyle, StatCard, Tag } from '../../src/components/UI';

// Portado de frontend/src/views/ProfileView.tsx

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[glassStyle, styles.avatarCard]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={{ marginTop: 6 }}>
            <Tag text={`🎓 ${user.level}`} color={colors.teal} />
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard icon="🔥" value={user.streak} label="Días de racha" color={colors.amber} />
        <StatCard icon="📖" value={user.totalSigns} label="Señas aprendidas" color={colors.teal} />
        <StatCard icon="🏆" value={user.badges} label="Insignias" color={colors.violet} />
        <StatCard icon="📅" value={user.joined} label="Miembro desde" color={colors.green} />
      </View>

      <View style={{ marginBottom: spacing.xl }}>
        <Text style={styles.sectionTitle}>Mis insignias</Text>
        <View style={{ gap: spacing.sm }}>
          {BADGES_LIST.map(b => (
            <View key={b.name} style={[glassStyle, styles.badgeRow]}>
              <View style={styles.badgeIcon}>
                <Text style={{ fontSize: 19 }}>{b.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeName}>{b.name}</Text>
                <Text style={styles.badgeDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[glassStyle, styles.teamCard]}>
        <Text style={styles.teamTitle}>Desarrollado por</Text>
        <Text style={styles.teamText}>
          Adrián Gottfried
        </Text>
        <Text style={[styles.teamText, { marginTop: 6 }]}>
          UTSC · Ingeniería en Desarrollo y Gestión de Software · 2026
        </Text>
      </View>

      {/* Administración — función de cuenta, solo para admins. Abre la pantalla
          de gestión de usuarios (la propia pantalla también redirige si el rol
          no es admin, como defensa en profundidad). */}
      {user.role === 'admin' && (
        <Pressable style={styles.adminBtn} onPress={() => router.push('/admin')}>
          <Text style={styles.adminText}>⚙️ Administración</Text>
        </Pressable>
      )}

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  avatarCard: {
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl + 2,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.violet,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#040D14' },
  name: { fontWeight: '800', fontSize: 17, color: colors.text1 },
  email: { fontSize: 12.5, color: colors.text3, marginTop: 3 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionTitle: { fontWeight: '700', fontSize: 14, color: colors.text1, marginBottom: spacing.md },
  badgeRow: {
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  badgeIcon: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.amberBg,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeName: { fontWeight: '600', fontSize: 13.5, color: colors.text1 },
  badgeDesc: { fontSize: 11.5, color: colors.text3, marginTop: 2 },
  teamCard: { padding: 14, marginBottom: spacing.lg + 2 },
  teamTitle: { fontWeight: '700', color: colors.text2, marginBottom: 6, fontSize: 12.5 },
  teamText: { fontSize: 12, color: colors.text3, lineHeight: 19 },
  adminBtn: {
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: `${colors.amber}40`,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  adminText: { color: colors.amber, fontWeight: '700', fontSize: 13.5 },
  logoutBtn: {
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: `${colors.red}40`,
    alignItems: 'center',
  },
  logoutText: { color: colors.red, fontWeight: '600', fontSize: 13.5 },
});
