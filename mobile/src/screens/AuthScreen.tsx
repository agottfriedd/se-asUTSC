/**
 * Portado de frontend/src/views/AuthView.tsx a React Native.
 * Login / registro con email+password. Incluye la validación de contraseña
 * estricta de la web (passwordPolicy): mín 8, mayúscula, minúscula, número,
 * símbolo, no común. El botón "Crear cuenta" queda bloqueado hasta cumplir
 * todos los requisitos y confirmar la contraseña.
 *
 * A diferencia de la web NO hay "Volver al inicio" (mobile no tiene fase
 * landing; arranca directo en auth).
 */
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  checkPassword, passwordStrength, passwordError, allChecksPassed,
  REQUIREMENT_ITEMS,
} from '../lib/passwordPolicy';
import type { PasswordStrength } from '../lib/passwordPolicy';
import { colors, radius, spacing } from '../theme';

interface Props {
  onLogin:    (email: string, pw: string) => Promise<void>;
  onRegister: (name: string, email: string, pw: string) => Promise<void>;
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Débil', medium: 'Media', strong: 'Fuerte',
};
const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: colors.red, medium: colors.amber, strong: colors.green,
};
const STRENGTH_BARS: Record<PasswordStrength, number> = {
  weak: 1, medium: 2, strong: 3,
};

export function AuthScreen({ onLogin, onRegister }: Props) {
  const [isLogin,       setIsLogin]       = useState(true);
  const [name,          setName]          = useState('');
  const [email,         setEmail]         = useState('');
  const [pw,            setPw]            = useState('');
  const [confirmPw,     setConfirmPw]     = useState('');
  const [showPw,        setShowPw]        = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [err,           setErr]           = useState('');
  const [loading,       setLoading]       = useState(false);

  const toggle = (login: boolean) => {
    setIsLogin(login);
    setErr('');
  };

  const pwChecks    = checkPassword(pw);
  const strength    = passwordStrength(pw);
  const confirmOk   = confirmPw.length > 0 && confirmPw === pw;
  const confirmBad  = confirmPw.length > 0 && confirmPw !== pw;
  // Todos los requisitos son obligatorios y bloqueantes: sin esto no se puede
  // ni pulsar "Crear cuenta".
  const canRegister = allChecksPassed(pwChecks) && confirmOk;

  const handleSubmit = async () => {
    setErr('');
    if (!email || !pw) { setErr('Completa todos los campos.'); return; }
    if (!isLogin) {
      if (!name) { setErr('Ingresa tu nombre completo.'); return; }
      // Validación de cliente — más estricta que el mínimo de 6 de Firebase.
      const pwErr = passwordError(pw);
      if (pwErr) { setErr(pwErr); return; }
      if (pw !== confirmPw) { setErr('Las contraseñas no coinciden.'); return; }
    }
    setLoading(true);
    try {
      if (isLogin) await onLogin(email, pw);
      else          await onRegister(name, email, pw);
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const registerDisabled = loading || (!isLogin && !canRegister);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>S</Text>
            </View>
            <Text style={styles.brand}>SeñasUTSCMX</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta gratuita'}
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['Iniciar sesión', 'Crear cuenta'] as const).map((t, i) => {
              const active = (i === 0) === isLogin;
              return (
                <Pressable
                  key={t}
                  onPress={() => toggle(i === 0)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Campos */}
          <View style={{ gap: 13 }}>
            {!isLogin && (
              <View>
                <Text style={styles.label}>Nombre completo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre"
                  placeholderTextColor={colors.text3}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@utsc.edu.mx"
                placeholderTextColor={colors.text3}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.pwWrap}>
                <TextInput
                  style={[styles.input, styles.inputPw]}
                  placeholder={isLogin ? 'Tu contraseña' : 'Crea una contraseña segura'}
                  placeholderTextColor={colors.text3}
                  value={pw}
                  onChangeText={setPw}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable style={styles.eye} onPress={() => setShowPw(v => !v)}>
                  <Text style={styles.eyeText}>{showPw ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>

              {/* Medidor de fortaleza + requisitos — solo en registro */}
              {!isLogin && (
                <View style={{ marginTop: 9 }}>
                  <View style={styles.strengthRow}>
                    <View style={styles.strengthBars}>
                      {[0, 1, 2].map(i => {
                        const on = pw.length > 0 && i < STRENGTH_BARS[strength];
                        return (
                          <View
                            key={i}
                            style={[
                              styles.strengthBar,
                              { backgroundColor: on ? STRENGTH_COLOR[strength] : colors.border2 },
                            ]}
                          />
                        );
                      })}
                    </View>
                    {pw.length > 0 && (
                      <Text style={[styles.strengthLabel, { color: STRENGTH_COLOR[strength] }]}>
                        {STRENGTH_LABEL[strength]}
                      </Text>
                    )}
                  </View>

                  <View style={{ gap: 4 }}>
                    {REQUIREMENT_ITEMS.map(({ key, label }) => {
                      const met       = pwChecks[key];
                      const violated  = key === 'notCommon' && pw.length > 0 && !met;
                      const satisfied = met && pw.length > 0;
                      const color = violated ? colors.red : satisfied ? colors.green : colors.text3;
                      const icon  = violated ? '❌' : satisfied ? '✅' : '⭕';
                      return (
                        <View key={key} style={styles.reqRow}>
                          <Text style={styles.reqIcon}>{icon}</Text>
                          <Text style={[styles.reqText, { color }]}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {!isLogin && (
              <View>
                <Text style={styles.label}>Confirmar contraseña</Text>
                <View style={styles.pwWrap}>
                  <TextInput
                    style={[
                      styles.input, styles.inputPw,
                      confirmBad && { borderColor: colors.red },
                    ]}
                    placeholder="Repite tu contraseña"
                    placeholderTextColor={colors.text3}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    secureTextEntry={!showConfirmPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable style={styles.eye} onPress={() => setShowConfirmPw(v => !v)}>
                    <Text style={styles.eyeText}>{showConfirmPw ? '🙈' : '👁️'}</Text>
                  </Pressable>
                </View>
                {confirmBad && (
                  <Text style={[styles.hint, { color: colors.red }]}>❌ Las contraseñas no coinciden</Text>
                )}
                {confirmOk && (
                  <Text style={[styles.hint, { color: colors.green }]}>✅ Las contraseñas coinciden</Text>
                )}
              </View>
            )}

            {!!err && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{err}</Text>
              </View>
            )}

            <Pressable
              style={[styles.submit, registerDisabled && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={registerDisabled}
            >
              {loading
                ? <ActivityIndicator color="#040D14" />
                : <Text style={styles.submitText}>{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },

  logoWrap:     { alignItems: 'center', marginBottom: 26 },
  logoMark: {
    width: 50, height: 50, borderRadius: 13, marginBottom: 10,
    backgroundColor: colors.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  logoMarkText: { fontSize: 24, color: '#040D14', fontWeight: '900' },
  brand:        { fontWeight: '800', fontSize: 19, color: colors.text1 },
  subtitle:     { color: colors.text3, fontSize: 13, marginTop: 4 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 11, padding: 3, marginBottom: spacing.xl,
  },
  tab:        { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive:  { backgroundColor: colors.teal },
  tabText:    { fontSize: 13, fontWeight: '600', color: colors.text3 },
  tabTextActive: { color: '#040D14' },

  label: { fontSize: 12, color: colors.text3, marginBottom: 5, fontWeight: '500' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: colors.text1,
  },
  inputPw: { paddingRight: 44 },
  pwWrap:  { position: 'relative', justifyContent: 'center' },
  eye:     { position: 'absolute', right: 6, padding: 6 },
  eyeText: { fontSize: 15 },

  strengthRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:{ fontSize: 11, fontWeight: '700', minWidth: 38, textAlign: 'right' },

  reqRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqIcon: { fontSize: 11 },
  reqText: { fontSize: 11.5 },

  hint: { fontSize: 11.5, marginTop: 5 },

  errorBox: {
    backgroundColor: colors.redBg,
    borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  errorText: { fontSize: 12, color: colors.red },

  submit: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  submitDisabled: { opacity: 0.5 },
  submitText:     { color: '#040D14', fontWeight: '700', fontSize: 14 },
});
