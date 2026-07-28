// Medidor de fuerza + checklist de requisitos (RN). Extraído de AuthScreen para
// reutilizarlo en el registro Y en el admin (crear usuario / cambiar contraseña),
// sin duplicar la UI. La lógica vive en lib/passwordPolicy.ts.
import { StyleSheet, Text, View } from 'react-native';
import {
  checkPassword, passwordStrength, REQUIREMENT_ITEMS,
} from '../lib/passwordPolicy';
import type { PasswordStrength } from '../lib/passwordPolicy';
import { colors, fonts } from '../theme';

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Débil', medium: 'Media', strong: 'Fuerte',
};
const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: colors.red, medium: colors.amber, strong: colors.green,
};
const STRENGTH_BARS: Record<PasswordStrength, number> = {
  weak: 1, medium: 2, strong: 3,
};

export function PasswordStrengthMeter({ pw }: { pw: string }) {
  const pwChecks = checkPassword(pw);
  const strength = passwordStrength(pw);
  return (
    <View style={{ marginTop: 9 }}>
      <View style={styles.strengthRow}>
        <View style={styles.strengthBars}>
          {[0, 1, 2].map(i => {
            const on = pw.length > 0 && i < STRENGTH_BARS[strength];
            return (
              <View
                key={i}
                style={[styles.strengthBar, { backgroundColor: on ? STRENGTH_COLOR[strength] : colors.border2 }]}
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
  );
}

const styles = StyleSheet.create({
  strengthRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:{ fontSize: 11, fontFamily: fonts.bold, fontWeight: '700', minWidth: 38, textAlign: 'right' },
  reqRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqIcon: { fontSize: 11, fontFamily: fonts.regular },
  reqText: { fontSize: 11.5, fontFamily: fonts.regular },
});
