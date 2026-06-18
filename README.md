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
| ML Service   | Python + FastAPI + MediaPipe Hands            |
| ML In-browser| MediaPipe Hands JS (WebAssembly)              |

## Equipo
Adrián Gottfried · Karolin Medina · Paola Moreno · Felipe Galván · Brandon González
UTSC · Ingeniería en Desarrollo y Gestión de Software · 2026
