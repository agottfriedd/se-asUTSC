import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Import por subruta a propósito: importar desde la raíz del paquete arrastra
// las 18 variantes de Poppins (~3 MB, cursivas incluidas) al bundle, porque
// su index.js hace un require() de cada una. Así solo entran estas cinco.
import { Poppins_400Regular }   from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium }    from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold }  from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold }      from '@expo-google-fonts/poppins/700Bold';
import { Poppins_800ExtraBold } from '@expo-google-fonts/poppins/800ExtraBold';
import { colors } from '../src/theme';
import { AuthProvider } from '../src/hooks/useAuth';
import { ProgressProvider } from '../src/hooks/useProgress';

export default function RootLayout() {
  // Poppins es la fuente institucional de la UTSC. A propósito NO bloqueamos el
  // render con el resultado de useFonts: si las fuentes tardan o fallan, la app
  // arranca igual con la del sistema y AuthProvider monta sin retraso. React
  // Native cae al sistema solo si el fontFamily aún no está registrado, así que
  // lo único que se ve es la fuente cambiando al terminar la carga.
  useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      {/* Tema claro: iconos oscuros en la barra de estado. */}
      <StatusBar style="dark" />
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
