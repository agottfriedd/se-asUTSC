/**
 * Panel de administración de USUARIOS (móvil). Portado de la sección de usuarios
 * de frontend/src/views/AdminView.tsx, rediseñado para teléfono: tarjetas +
 * bottom sheet de acciones (no la tabla de web).
 *
 * Acceso: se abre desde Perfil con el botón "Administración" (solo admins). Aquí
 * hay defensa en profundidad: si alguien llega a la ruta sin rol admin, se
 * redirige a Perfil.
 *
 * El CRUD real vive en el backend (requireAdmin + Firebase Admin SDK); api.ts ya
 * adjunta el ID token. Los guardrails anti-lockout los aplica el servidor y su
 * mensaje en español se muestra tal cual.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { api, type AdminUser, type UserRoleAPI } from '../src/lib/api';
import { colors, fonts, pressedStyle, radius, spacing } from '../src/theme';
import { glassStyle, LoadingView, ErrorBanner } from '../src/components/UI';
import { UserActionSheet, CreateUserModal, PasswordModal } from '../src/components/admin/UserAdminUI';

type RoleFilter   = 'all' | 'student' | 'admin';
type StatusFilter = 'all' | 'active' | 'disabled';

const screenOptions = {
  title: 'Administración',
  headerShown: true,
  headerStyle: { backgroundColor: colors.bg2 },
  headerTintColor: colors.text1,
  headerShadowVisible: false,
};

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user.role === 'admin';

  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Overlays
  const [sheetUser,  setSheetUser]  = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwUser,     setPwUser]     = useState<AdminUser | null>(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    setError('');
    api.users.list()
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  // Ejecuta una acción sobre una fila: busy + refresco + error (como en web).
  const runAction = useCallback(async (uid: string, fn: () => Promise<unknown>) => {
    setBusyUid(uid);
    setError('');
    try {
      await fn();
      const list = await api.users.list();
      setUsers(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyUid(null);
    }
  }, []);

  // Defensa en profundidad: sin rol admin no se ve nada, se redirige a Perfil.
  if (!isAdmin) return <Redirect href="/(tabs)/profile" />;

  const q = search.trim().toLowerCase();
  const filtered = users.filter(u => {
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = roleFilter === 'all'   || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? !u.disabled : u.disabled);
    return matchQ && matchRole && matchStatus;
  });

  const confirmDelete = (u: AdminUser) => {
    setSheetUser(null);
    Alert.alert(
      'Eliminar usuario',
      `¿Eliminar definitivamente a ${u.name || u.email}? Se borra de Firebase Auth y de la base de datos. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => runAction(u.uid, () => api.users.remove(u.uid)) },
      ],
    );
  };

  const confirmDisable = (u: AdminUser) => {
    setSheetUser(null);
    Alert.alert(
      'Desactivar usuario',
      `¿Desactivar a ${u.name || u.email}? No podrá iniciar sesión hasta reactivarlo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desactivar', style: 'destructive', onPress: () => runAction(u.uid, () => api.users.setDisabled(u.uid, true)) },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={styles.container}>

        {/* Cabecera: título + añadir + búsqueda + filtros */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Gestión de usuarios</Text>
              <Text style={styles.subtitle}>{users.length} registrados · {filtered.length} en vista</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && pressedStyle]} onPress={() => setCreateOpen(true)}>
              <Text style={styles.addBtnText}>➕ Añadir</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            placeholder="🔎 Buscar por nombre o correo…"
            placeholderTextColor={colors.text3}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ChipRow<RoleFilter>
            value={roleFilter}
            onChange={setRoleFilter}
            options={[['all', 'Todos'], ['admin', 'Admin'], ['student', 'Student']]}
          />
          <ChipRow<StatusFilter>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[['all', 'Todos'], ['active', 'Activos'], ['disabled', 'Inactivos']]}
          />
        </View>

        {!!error && <View style={styles.errorWrap}><ErrorBanner text={error} /></View>}

        {loading && users.length === 0 ? (
          <LoadingView label="Cargando usuarios…" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={u => u.uid}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadUsers} tintColor={colors.teal} />}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {users.length === 0
                  ? 'No hay usuarios (o el Admin SDK aún no está configurado en el servidor).'
                  : 'Ningún usuario coincide con los filtros.'}
              </Text>
            }
            renderItem={({ item: u }) => {
              const isSelf = u.uid === user.uid;
              const busy   = busyUid === u.uid;
              return (
                <Pressable
                  style={({ pressed }) => [glassStyle, styles.card, busy && { opacity: 0.5 }, pressed && pressedStyle]}
                  disabled={busy}
                  onPress={() => setSheetUser(u)}
                >
                  <View style={styles.avatar}><Text style={styles.avatarText}>{(u.name || u.email || '?').slice(0, 2).toUpperCase()}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{u.name || '(sin nombre)'}</Text>
                      {isSelf && <Text style={styles.youChip}>tú</Text>}
                    </View>
                    <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                    <View style={styles.badges}>
                      <Badge
                        text={u.role === 'admin' ? '⚙️ admin' : '🎓 student'}
                        color={u.role === 'admin' ? colors.amber : colors.violet}
                      />
                      <Badge
                        text={u.disabled ? '🚫 inactivo' : '✅ activo'}
                        color={u.disabled ? colors.red : colors.green}
                      />
                    </View>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {/* Bottom sheet de acciones */}
      {sheetUser && (
        <UserActionSheet
          user={sheetUser}
          isSelf={sheetUser.uid === user.uid}
          onClose={() => setSheetUser(null)}
          onToggleRole={() => {
            const u = sheetUser;
            setSheetUser(null);
            runAction(u.uid, () => api.users.setRole(u.uid, u.role === 'admin' ? 'student' : 'admin'));
          }}
          onToggleDisabled={() => {
            const u = sheetUser;
            if (u.disabled) { setSheetUser(null); runAction(u.uid, () => api.users.setDisabled(u.uid, false)); }
            else confirmDisable(u);
          }}
          onChangePassword={() => { setPwUser(sheetUser); setSheetUser(null); }}
          onDelete={() => confirmDelete(sheetUser)}
        />
      )}

      {/* Crear usuario */}
      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onSubmit={async (data: { name: string; email: string; password: string; role: UserRoleAPI }) => {
            await api.users.create(data);
            loadUsers();
          }}
        />
      )}

      {/* Cambiar contraseña */}
      {pwUser && (
        <PasswordModal
          userName={pwUser.name || pwUser.email}
          onClose={() => setPwUser(null)}
          onSubmit={async (password: string) => { await api.users.setPassword(pwUser.uid, password); }}
        />
      )}
    </>
  );
}

// ─── Chips de filtro ───────────────────────────────────────────────
function ChipRow<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: [T, string][];
}) {
  return (
    <View style={styles.chipRow}>
      {options.map(([val, label]) => {
        const active = value === val;
        return (
          <Pressable key={val} onPress={() => onChange(val)}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && pressedStyle]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1F`, borderColor: `${color}40` }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.text1 },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.text3, marginTop: 2 },
  addBtn: { backgroundColor: colors.pri, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: colors.onPri, fontWeight: '700', fontSize: 13, fontFamily: fonts.bold },

  search: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 9,
    fontSize: 13.5, fontFamily: fonts.regular, color: colors.text1,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: 5, paddingHorizontal: 13, borderRadius: radius.pill,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.pri, borderColor: colors.priActive },
  chipText: { fontSize: 12, fontFamily: fonts.semibold, fontWeight: '600', color: colors.text2 },
  chipTextActive: { color: colors.onPri },

  errorWrap: { padding: spacing.md, paddingBottom: 0 },

  listContent: { padding: spacing.lg, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.text3, fontSize: 13, fontFamily: fonts.regular, paddingVertical: 40 },

  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
    backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.onFill },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontFamily: fonts.bold, fontWeight: '700', color: colors.text1, flexShrink: 1 },
  youChip: {
    fontSize: 9.5, fontFamily: fonts.bold, fontWeight: '700', color: colors.teal,
    backgroundColor: colors.tealBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  email: { fontSize: 12, fontFamily: fonts.regular, color: colors.text3, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 7 },
  badge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontFamily: fonts.bold, fontWeight: '700' },
  chevron: { fontSize: 22, fontFamily: fonts.regular, color: colors.text3, marginLeft: spacing.xs },
});
