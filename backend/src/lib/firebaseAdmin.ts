import 'dotenv/config'; // carga backend/.env antes de leer process.env (orden garantizado)
import admin from 'firebase-admin';

// Inicializa el Firebase Admin SDK una sola vez, con credenciales leídas de
// variables de entorno (nunca hardcodeadas). La service account se descarga
// desde Firebase Console → Configuración → Cuentas de servicio → Generar nueva
// clave privada, y sus 3 campos se copian a backend/.env:
//   FIREBASE_PROJECT_ID   → project_id
//   FIREBASE_CLIENT_EMAIL → client_email
//   FIREBASE_PRIVATE_KEY  → private_key (entre comillas; los \n van escapados)
// Además FIREBASE_DATABASE_URL para poder leer/escribir el rol en Realtime DB.

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_DATABASE_URL,
} = process.env;

let initialized = false;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  // No detenemos el servidor (las rutas públicas siguen funcionando), pero las
  // rutas que usan el Admin SDK responderán 503 hasta configurar el .env.
  console.warn(
    '[firebase-admin] Faltan credenciales (FIREBASE_PROJECT_ID / ' +
    'FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY). Las funciones de ' +
    'administración de usuarios estarán deshabilitadas hasta configurarlas.'
  );
} else {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // En .env la private key va en una sola línea con "\n" literales; hay que
      // convertirlos de vuelta a saltos de línea reales.
      privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: FIREBASE_DATABASE_URL,
  });
  initialized = true;
}

/** true si el Admin SDK quedó inicializado (credenciales presentes). */
export const isAdminReady = () => initialized;

export { admin };
