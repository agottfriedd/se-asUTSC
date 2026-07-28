# SeñasUTSCMX — App completa

Plataforma educativa LSM para UTSC. ODS 4 + ODS 10.

## Levantar todo en local

### Requisitos
- Node.js ≥ 18 · npm ≥ 9
- Python 3.10+
- PostgreSQL 15 (o Docker)
- Cuenta de Firebase (gratis)

### 1 — Configura Firebase
1. Ve a https://console.firebase.google.com → Nuevo proyecto → "senias-utscmx"
2. Activa **Authentication** → Email/Password
3. Activa **Firestore** → modo de prueba
4. En Configuración del proyecto → Web → copia los valores a `frontend/.env.local`

### 2 — Variables de entorno
```bash
cp frontend/.env.example   frontend/.env.local
cp backend/.env.example    backend/.env
cp ml-service/.env.example ml-service/.env
```
Llena los valores en cada archivo.

### 3 — Base de datos
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma db seed           # poblar lecciones y diccionario
```

### 4 — Servicios
Terminal 1 — Backend:
```bash
cd backend && npm run dev
```
Terminal 2 — ML Service:
```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Terminal 3 — Frontend:
```bash
cd frontend && npm install && npm run dev
```

Abre http://localhost:5173

## Arquitectura

```
Browser (PWA)
  │  Firebase Auth + Firestore  (auth, progreso, favoritos)
  │  Backend API :3000          (CRUD lecciones/diccionario — admin)
  │  ML Service  :8000          (reconocimiento de señas por imagen)
  └─ MediaPipe JS (en-browser)  (reconocimiento vía cámara, sin backend)
```

## Stack

| Capa         | Tecnología                                    |
|--------------|-----------------------------------------------|
| Frontend     | React 18 + TypeScript + Vite + TailwindCSS    |
| Auth + DB    | Firebase Auth + Firestore                     |
| Backend API  | Node.js + Express + Prisma + PostgreSQL       |
| ML Service   | Python + FastAPI + MediaPipe Hands + scikit-learn |
| ML In-browser| MediaPipe Hands JS (WebAssembly)              |

El reconocimiento de señas lo hace un **SVM entrenado** (`ml-service/modelo/`),
con el clasificador de reglas como fallback. Detalles, contrato de la API y
avisos importantes (quiralidad, versiones de numpy): **[ml-service/README.md](ml-service/README.md)**.

## Pendientes

- **Recalibrar el gate de confianza (0.72)**: se eligió para el clasificador de
  reglas, donde la confianza era un margen heurístico. Ahora sale de
  `predict_proba` del modelo y es una probabilidad real mucho más alta: deja
  pasar el 97.7 % de los frames, así que casi no filtra. Un valor razonable
  sería ~0.90. Se dejó en 0.72 a propósito para no desalinear web y móvil; hay
  que subirlo en **ambas a la vez**, con datos de uso real y con más de un
  sujeto (el modelo se entrenó con uno solo). En web es la constante
  `ML_CONFIDENCE_GATE` en `frontend/src/lib/api.ts`; en móvil está en duro.
- **Letras que no coinciden entre modelo y fallback**: el modelo emite M, N y R
  pero **nunca X**; las reglas tienen X pero no M/N/R. Además
  `SIGN_DESCRIPTIONS` en `frontend/src/views/PracticeView.tsx` sigue listando X
  aunque el modelo no la produzca. Falta decidir qué hacer.

- **Recuperación de contraseña**: el enlace "¿Olvidaste tu contraseña?" está
  comentado en `frontend/src/views/AuthView.tsx` (web); en móvil nunca existió.
  Falta construir en **web y móvil**: una vista que pida el correo →
  `sendPasswordResetEmail` → aviso "revisa tu bandeja", con errores en español
  reutilizando el `AUTH_ERROR_MESSAGES` que ya existe en los `useAuth`.
- **Lección "Decir No"** (`id=16`, `order=13`): quedó *soft-deleted*
  (`active=false`), así que no aparece en la app. Decidir si se purga o se
  restaura. Ojo: su único bloque es de tipo `sign` (no termina en `quiz`), así
  que tal como está no se puede "completar" por el flujo normal si se reactiva.
- **Contenido legacy sin migrar**: `frontend/src/data/content.ts` y
  `frontend/src/data/lessons.ts` ya no se usan (las lecciones vienen del backend
  /Postgres). Pendiente migrar al editor de lecciones / a la BD el contenido que
  siga siendo útil (frases y señas adicionales) y luego borrar esos archivos.
- **Stats de perfil sin calcular**: `badges` y `totalSigns` quedan en `0` en web
  y móvil (no hay forma de calcularlos hoy). Además, el perfil **móvil** no
  deriva `streak` ni el nivel del progreso real (el web sí). Falta calcular estas
  métricas.

## Autor
Adrián Gottfried
UTSC · Ingeniería en Desarrollo y Gestión de Software · 2026
