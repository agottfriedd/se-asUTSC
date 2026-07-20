// Configuración de Metro para Expo.
//
// unstable_enablePackageExports viene ACTIVADO por defecto en Expo SDK 54. Con
// el SDK de firebase v10 eso provoca el crash de arranque:
//   "Component auth has not been registered yet"  (en initializeAuth)
// Causa: los subpaths del wrapper `firebase` (firebase/app, firebase/auth…) se
// resuelven por su mapa "exports", que carga @firebase/app por dos rutas
// distintas. El build RN de @firebase/auth registra el componente `auth` en una
// instancia de @firebase/app que NO es la que usa initializeAuth → "no
// registered yet".
//
// Al desactivar package exports, Metro usa la resolución clásica (campos
// main/module/browser/react-native). Así @firebase/app queda como UNA sola
// instancia y @firebase/auth (dist/rn/index.js, que incluye
// getReactNativePersistence) registra el componente sobre ella. La persistencia
// con AsyncStorage sigue intacta.
//
// Esto revierte al comportamiento de resolución de Expo SDK ≤52 (el default
// anterior), compatible con el resto de dependencias del proyecto.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;

module.exports = config;
