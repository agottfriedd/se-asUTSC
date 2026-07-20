import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
import { AuthProvider } from '../src/hooks/useAuth';
import { ProgressProvider } from '../src/hooks/useProgress';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* AuthProvider decide qué se ve: splash mientras carga la sesión,
          pantalla de login/registro sin sesión, o los tabs con sesión.
          ProgressProvider va DENTRO (necesita el uid) y da un progreso único y
          compartido a Inicio, Lecciones y el detalle de lección. */}
      <AuthProvider>
        <ProgressProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ProgressProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
