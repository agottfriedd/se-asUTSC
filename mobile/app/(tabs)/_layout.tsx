import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors, fonts } from '../../src/theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, fontFamily: fonts.regular, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   colors.teal,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: {
          backgroundColor: colors.bg2,
          borderTopColor:  colors.border,
        },
        // Sin esto las etiquetas de tabs y los títulos de header se quedarían
        // en la fuente del sistema mientras el resto de la app usa Poppins.
        tabBarLabelStyle:  { fontFamily: fonts.medium },
        headerStyle: { backgroundColor: colors.bg2 },
        headerTitleStyle: { fontFamily: fonts.bold },
        headerTintColor: colors.text1,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerTitle: 'Inicio',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{
          title: 'Diccionario',
          headerTitle: 'Diccionario LSM',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="lessons"
        options={{
          title: 'Lecciones',
          headerTitle: 'Lecciones',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎓" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Práctica',
          headerShown: false, // cámara a pantalla completa, igual que el prototipo
          tabBarIcon: ({ focused }) => <TabIcon emoji="📷" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          headerTitle: 'Mi perfil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
