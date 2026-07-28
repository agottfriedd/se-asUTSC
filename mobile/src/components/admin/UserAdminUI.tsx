/**
 * Piezas de UI del panel de administración de usuarios (móvil). Presentacionales:
 * la lógica y las llamadas al backend viven en app/admin.tsx.
 *  - UserActionSheet: bottom sheet de acciones al tocar una tarjeta.
 *  - CreateUserModal / PasswordModal: formularios en modal centrado.
 * Sin dependencias nativas nuevas: se usan el Modal, Pressable y
 * KeyboardAvoidingView de React Native.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { colors, fonts, pressedStyle, radius, spacing } from '../../theme';
import type { AdminUser, UserRoleAPI } from '../../lib/api';
import { checkPassword, passwordError, allChecksPassed } from '../../lib/passwordPolicy';
import { emailError } from '../../lib/emailValidation';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';

function initialsOf(u: AdminUser): string {
  return (u.name || u.email || '?').slice(0, 2).toUpperCase();
}

// ─── Bottom sheet de acciones ──────────────────────────────────────
interface SheetProps {
  user:             AdminUser;
  isSelf:           boolean;
  onClose:          () => void;
  onToggleRole:     () => void;
  onToggleDisabled: () => void;
  onChangePassword: () => void;
  onDelete:         () => void;
}

export function UserActionSheet({
  user, isSelf, onClose, onToggleRole, onToggleDisabled, onChangePassword, onDelete,
}: SheetProps) {
  // Guardrails anti-lockout (mismos que aplica el backend): un admin no puede
  // degradarse / desactivarse / eliminarse a sí mismo.
  const cannotDemote  = isSelf && user.role === 'admin';
  const cannotDisable = isSelf;
  const cannotDelete  = isSelf;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Cabecera del usuario */}
          <View style={styles.sheetHeader}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(user)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName} numberOfLines={1}>{user.name || '(sin nombre)'}</Text>
              <Text style={styles.sheetEmail} numberOfLines={1}>{user.email}</Text>
            </View>
          </View>

          {/* Cambiar rol */}
          <SheetButton
            label={user.role === 'admin' ? '↓ Hacer student' : '↑ Hacer admin'}
            disabled={cannotDemote}
            note={cannotDemote ? 'No puedes quitarte tu propio rol admin.' : undefined}
            onPress={onToggleRole}
          />
          {/* Activar / desactivar */}
          <SheetButton
            label={user.disabled ? '✅ Reactivar' : '🚫 Desactivar'}
            disabled={!user.disabled && cannotDisable}
            note={!user.disabled && cannotDisable ? 'No puedes desactivar tu propia cuenta.' : undefined}
            onPress={onToggleDisabled}
          />
          {/* Cambiar contraseña */}
          <SheetButton label="🔑 Cambiar contraseña" onPress={onChangePassword} />
          {/* Eliminar */}
          <SheetButton
            label="🗑 Eliminar"
            danger
            disabled={cannotDelete}
            note={cannotDelete ? 'No puedes eliminar tu propia cuenta.' : undefined}
            onPress={onDelete}
          />

          <Pressable style={({ pressed }) => [styles.cancelBtn, pressed && pressedStyle]} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SheetButton({ label, onPress, danger, disabled, note }: {
  label: string; onPress: () => void; danger?: boolean; disabled?: boolean; note?: string;
}) {
  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.sheetBtn, disabled && styles.sheetBtnDisabled, pressed && pressedStyle]}
        disabled={disabled}
        onPress={onPress}
      >
        <Text style={[styles.sheetBtnText, danger && { color: colors.red }, disabled && { color: colors.text3 }]}>
          {label}
        </Text>
      </Pressable>
      {note && <Text style={styles.sheetNote}>{note}</Text>}
    </View>
  );
}

// ─── Modal base para formularios ───────────────────────────────────
function FormModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.formRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Crear usuario ─────────────────────────────────────────────────
export function CreateUserModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: { name: string; email: string; password: string; role: UserRoleAPI }) => Promise<void>;
}) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [pw, setPw]             = useState('');
  const [role, setRole]         = useState<UserRoleAPI>('student');
  const [err, setErr]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pwOk = allChecksPassed(checkPassword(pw));

  const submit = async () => {
    setErr('');
    if (!name || !email || !pw) { setErr('Completa todos los campos.'); return; }
    // Formato de email + política de contraseña ESTRICTA (igual que el registro).
    const eErr = emailError(email);
    if (eErr) { setErr(eErr); return; }
    const pwErr = passwordError(pw);
    if (pwErr) { setErr(pwErr); return; }
    setSubmitting(true);
    try {
      await onSubmit({ name, email, password: pw, role });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title="➕ Añadir usuario" onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor={colors.text3}
          value={name} onChangeText={setName} autoCapitalize="words" />
        <TextInput style={styles.input} placeholder="Correo electrónico" placeholderTextColor={colors.text3}
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <TextInput style={styles.input} placeholder="Crea una contraseña segura" placeholderTextColor={colors.text3}
          value={pw} onChangeText={setPw} autoCapitalize="none" autoCorrect={false} />
        <PasswordStrengthMeter pw={pw} />
        {/* Rol: dos chips */}
        <View style={styles.roleRow}>
          {(['student', 'admin'] as const).map(r => (
            <Pressable key={r} onPress={() => setRole(r)}
              style={({ pressed }) => [styles.roleChip, role === r && styles.roleChipActive, pressed && pressedStyle]}>
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                {r === 'admin' ? '⚙️ Admin' : '🎓 Student'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {!!err && <Text style={styles.formErr}>❌ {err}</Text>}
      <FormActions submitting={submitting} disabled={!pwOk} submitLabel="Crear usuario" onCancel={onClose} onSubmit={submit} />
    </FormModal>
  );
}

// ─── Cambiar contraseña ────────────────────────────────────────────
export function PasswordModal({ userName, onClose, onSubmit }: {
  userName: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [pw, setPw]             = useState('');
  const [err, setErr]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]   = useState(false);

  const pwOk = allChecksPassed(checkPassword(pw));

  // Aviso de éxito y auto-cierre tras confirmar.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [success, onClose]);

  const submit = async () => {
    setErr('');
    // MISMA política estricta que el registro (no solo 8 caracteres).
    const pwErr = passwordError(pw);
    if (pwErr) { setErr(pwErr); return; }
    setSubmitting(true);
    try {
      await onSubmit(pw);
      setSuccess(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title="🔑 Cambiar contraseña" onClose={onClose}>
      {success ? (
        <View style={styles.successWrap}>
          <Text style={{ fontSize: 40, fontFamily: fonts.regular }}>✅</Text>
          <Text style={styles.successTitle}>Contraseña actualizada correctamente</Text>
          <Text style={styles.formSub}>Nueva contraseña de {userName}.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.formSub}>Nueva contraseña para <Text style={{ fontWeight: '700', color: colors.text1 }}>{userName}</Text></Text>
          <TextInput style={styles.input} placeholder="Crea una contraseña segura" placeholderTextColor={colors.text3}
            value={pw} onChangeText={setPw} autoCapitalize="none" autoCorrect={false} autoFocus />
          <PasswordStrengthMeter pw={pw} />
          {!!err && <Text style={styles.formErr}>❌ {err}</Text>}
          <FormActions submitting={submitting} disabled={!pwOk} submitLabel="Cambiar" onCancel={onClose} onSubmit={submit} />
        </>
      )}
    </FormModal>
  );
}

function FormActions({ submitting, submitLabel, onCancel, onSubmit, disabled }: {
  submitting: boolean; submitLabel: string; onCancel: () => void; onSubmit: () => void; disabled?: boolean;
}) {
  const blocked = submitting || disabled;
  return (
    <View style={styles.formActions}>
      <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && pressedStyle]} onPress={onCancel} disabled={submitting}>
        <Text style={styles.ghostBtnText}>Cancelar</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.primaryBtn, blocked && { opacity: 0.5 }, pressed && pressedStyle]} onPress={onSubmit} disabled={blocked}>
        {submitting ? <ActivityIndicator color={colors.onPri} /> : <Text style={styles.primaryBtnText}>{submitLabel}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom sheet
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + spacing.md,
    gap: spacing.xs,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.violet,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.onFill },
  sheetName:  { fontSize: 15, fontFamily: fonts.bold, fontWeight: '700', color: colors.text1 },
  sheetEmail: { fontSize: 12, fontFamily: fonts.regular, color: colors.text3, marginTop: 2 },

  sheetBtn: {
    paddingVertical: 13, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  sheetBtnDisabled: { opacity: 0.5 },
  sheetBtnText: { fontSize: 14, fontFamily: fonts.semibold, fontWeight: '600', color: colors.text1 },
  sheetNote: { fontSize: 10.5, fontFamily: fonts.regular, color: colors.text3, marginTop: 3, marginBottom: 2, paddingHorizontal: spacing.xs },

  cancelBtn: { paddingVertical: 13, alignItems: 'center', marginTop: spacing.sm },
  cancelText: { fontSize: 14, fontFamily: fonts.semibold, fontWeight: '600', color: colors.text3 },

  // Form modal
  formRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.scrim },
  formCard: {
    width: '100%', maxWidth: 400,
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.xl,
  },
  formTitle: { fontSize: 16, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.text1, marginBottom: spacing.md },
  formSub:   { fontSize: 12.5, fontFamily: fonts.regular, color: colors.text3, marginBottom: spacing.md },
  successWrap:  { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  successTitle: { fontSize: 15, fontFamily: fonts.extrabold, fontWeight: '800', color: colors.green, textAlign: 'center' },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, fontFamily: fonts.regular, color: colors.text1,
  },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  roleChipActive: { backgroundColor: colors.pri, borderColor: colors.priActive },
  roleChipText: { fontSize: 13, fontFamily: fonts.semibold, fontWeight: '600', color: colors.text2 },
  roleChipTextActive: { color: colors.onPri },

  formErr: { fontSize: 12, fontFamily: fonts.regular, color: colors.red, marginTop: spacing.sm },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  primaryBtn: {
    backgroundColor: colors.pri, borderRadius: radius.md,
    paddingVertical: 11, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minWidth: 110,
  },
  primaryBtnText: { color: colors.onPri, fontWeight: '700', fontSize: 13.5, fontFamily: fonts.bold },
  ghostBtn: {
    borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md,
    paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { color: colors.text1, fontWeight: '600', fontSize: 13.5, fontFamily: fonts.semibold },
});
