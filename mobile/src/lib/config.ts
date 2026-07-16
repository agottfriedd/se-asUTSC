/**
 * Única fuente de las URLs de los dos servicios backend. Cambia el host
 * (IP de tu máquina en la red WiFi) aquí — el teléfono y el equipo que
 * corre los servicios deben estar en la misma red.
 */
const HOST = '172.20.10.2';

/** ml-service (FastAPI + MediaPipe) — reconocimiento de señas. */
export const ML_URL = `http://${HOST}:8000`;

/** backend (Node + Prisma) — lecciones, diccionario, progreso. */
export const API_URL = `http://${HOST}:3000`;

/**
 * Modo debug del reconocimiento en los bloques de seña: muestra la letra
 * y la confianza CRUDA de cada respuesta del ml-service, aunque estén por
 * debajo del gate. También se alterna en runtime con un tap largo sobre
 * la barra "Detectando". Úsalo para calibrar CONFIDENCE_GATE con el rango
 * real de confianzas que da el teléfono (ver SignPractice.tsx).
 */
export const DEBUG_RECOGNITION = false;
