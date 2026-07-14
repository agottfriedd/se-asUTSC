# SeñasUTSCMX — Prototipo móvil (Expo)

Prototipo de **riesgo** de la app móvil. Objetivo único: validar que un
teléfono con Expo Go puede capturar frames de la cámara, reducirlos y enviarlos
al servicio ML (`ml-service`, `POST /recognize`) para mostrar la letra detectada
en tiempo casi real. **No es la app final**, solo una pantalla.

## Qué hace

1. Pide permiso de cámara (`expo-camera`) y muestra el preview a pantalla completa.
2. Cada ~700 ms captura un frame, lo reduce a ~480 px de ancho y lo comprime a
   JPEG calidad 0.6 (`expo-image-manipulator`).
3. Manda el frame en **base64 puro** (sin prefijo `data:`) a `POST /recognize`.
4. Muestra la **letra** y la **confianza**; maneja los estados: sin permiso,
   sin red, y `hand_found = false`.

## Configuración

En `App.tsx`, arriba del archivo:

```ts
const API_BASE_URL = 'http://10.10.204.127:8000';
```

Cámbiala por la IP del equipo que corre `ml-service` (debe estar en la **misma
red WiFi** que el teléfono). Verifica que el servicio responde con:

```bash
curl http://<IP>:8000/health
```

## Cómo correrlo

```bash
cd mobile
npm install        # solo la primera vez
npx expo start
```

Escanea el QR con la app **Expo Go** (iOS/Android). Todo corre en Expo Go, sin
build nativo.
