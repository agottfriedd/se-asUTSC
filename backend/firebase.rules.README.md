# Reglas de Realtime Database — SeñasUTSCMX

Pega el contenido de [`firebase.rules.json`](./firebase.rules.json) en
**Firebase Console → Realtime Database → Reglas → Publicar**.

> El archivo `.json` es JSON estricto (sin comentarios) para que la consola lo
> acepte. No se despliega automáticamente desde el repo; es una referencia que
> copias/pegas a mano.

## Por qué estas reglas

**Escalada de privilegios (el hueco que cierran):** el cliente escribe su propio
`/users/{uid}` al registrarse. Sin reglas, cualquiera podría abrir la consola del
navegador y hacer `set('/users/<miuid>/role', 'admin')` para volverse admin.

**La clave está en `role` + `.validate`, no en `.write`:** en Realtime Database
las reglas de escritura **cascadean** — si `.write` es `true` en `/users/$uid`,
un `set()` de todo el nodo (incluido `role`) queda autorizado aunque un hijo
tenga `.write: false`. Por eso `role` se protege con **`.validate`**:

```
"role": { ".validate": "(newData.val() === 'student' && !data.exists()) || newData.val() === data.val()" }
```

Esto permite que un **cliente** escriba `role: 'student'` UNA sola vez, al crear
su perfil (`!data.exists()`), y a partir de ahí exige que el valor **no cambie**
(`newData.val() === data.val()`). En consecuencia:

- Registrarse crea el perfil con `role: 'student'` visible. ✔
- Intentar crear/escribir `role: 'admin'` desde el cliente → **rechazado**. ✔
- Intentar cambiar `student → admin` después → **rechazado**. ✔

Es imposible auto-asignarse admin desde el navegador. Promover/degradar solo lo
hace el backend con el Admin SDK.

**El backend sí puede:** el Firebase Admin SDK **ignora por completo** estas
reglas (`.write` y `.validate`), así que los endpoints de administración
(`PATCH /api/users/:uid/role`, etc.) escriben `role` sin problema. El rol vive
en RTDB y su única vía de escritura legítima es el backend.

## Bootstrap del primer admin

Como aún no hay ningún admin, promueve tu cuenta **a mano una sola vez** desde
la consola de Firebase (Realtime Database → `users/<tu-uid>` → añade `role` =
`"admin"`). La consola/Admin SDK ignoran las reglas, así que sí te deja. De ahí
en adelante, todo se gestiona desde el panel Admin de la app.
