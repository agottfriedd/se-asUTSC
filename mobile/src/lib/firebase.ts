/**
 * Portado de frontend/src/lib/firebase.ts — mismo proyecto "seniasutsc".
 * firebase v12 (JS SDK). Diferencias con la web:
 *  - La config va hardcodeada (no hay import.meta.env en React Native).
 *    No es secreta: es la misma config pública que el bundle web expone.
 *  - NO se importa getAnalytics: no funciona en React Native.
 *
 * Por qué initializeAuth + getReactNativePersistence y NO getAuth(app):
 * En el build React Native de firebase v12, getAuth(app) llama a
 * initializeAuth SIN persistencia → persistencia en MEMORIA, y hasta imprime un
 * warning ("Auth state will default to memory persistence and will not persist
 * between sessions... install @react-native-async-storage/async-storage and
 * provide it to initializeAuth"). Es decir, con getAuth el usuario se
 * desloguearía al cerrar la app. Para persistir la sesión hay que pasar
 * explícitamente getReactNativePersistence(AsyncStorage), como aquí.
 *
 * El crash de arranque "Component auth has not been registered yet" NO era de
 * este archivo: era resolución de módulos de Metro (package exports) cargando
 * @firebase/app por dos rutas. Se arregla en metro.config.js.
 */
import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence existe en el build React Native de firebase/auth
// (Metro lo resuelve por el campo "react-native" → dist/rn/index.js), pero
// sigue faltando en los .d.ts del paquete wrapper `firebase/auth`, que solo
// declara la API del navegador. Lo tomamos del namespace con un cast puntual
// para no romper el typecheck; en runtime la función sí está.
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

const firebaseConfig = {
  apiKey:            'AIzaSyD0eOwKJgBn-4Sqbo8Fg0M46JJVv9D5_no',
  authDomain:        'seniasutsc.firebaseapp.com',
  databaseURL:       'https://seniasutsc-default-rtdb.firebaseio.com',
  projectId:         'seniasutsc',
  storageBucket:     'seniasutsc.firebasestorage.app',
  messagingSenderId: '254023265895',
  appId:             '1:254023265895:web:cb799f0cb38f8ff7452ec2',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const rtdb = getDatabase(app);
