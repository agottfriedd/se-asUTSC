# ML Service — SeñasUTSCMX

FastAPI + MediaPipe. Clasifica dactilología de LSM a partir de una imagen
(`/recognize`, lo usa el **móvil**) o de landmarks ya extraídos por el navegador
(`/classify`, lo usa la **web**).

Desde la integración del modelo entrenado, la clasificación la hace un **SVM de
scikit-learn**. El clasificador de reglas (`app/classifier.py`) se conserva como
**fallback**: si el modelo no carga, el servicio sigue funcionando con reglas en
vez de caerse.

```bash
uvicorn app.main:app --reload --port 8000
```

`GET /health` dice cuál está activo:

```json
{"status":"ok","classifier":"ml","model_error":null}
```

`"classifier":"rules"` significa que el modelo no cargó; `model_error` dice por qué.

---

## El modelo

`modelo/clasificador_lsm.joblib` — copiado desde `ml-training/modelo/`. Se copia
a propósito: `ml-training/` no se despliega.

| | |
|---|---|
| Algoritmo | `Pipeline(StandardScaler, SVC(kernel="rbf", C=10, probability=True))` |
| Representación | `D · world + distancias` — **78 features** |
| Salida | 22 letras: A B C D E F G H I K L M N O P R S T U V W Y |
| Accuracy CV | 0.9469 (`StratifiedGroupKFold` por sesión de grabación) |
| Entrenado con | 13 339 muestras, 15 sesiones, **1 solo sujeto** |

Se carga **una vez al arrancar** (`app/model.py`), nunca por petición.

### Las 78 features

`app/features.py` construye la entrada. `normalizar()` y `distancias_yemas()`
son **copia exacta** de `ml-training/entrenar_lsm.py`:

```
21 world landmarks (x,y,z)  = 63 valores crudos
  ├─ normalizar()        → 63   centrado en la muñeca, escalado por la palma
  └─ distancias_yemas()  → 15   10 pares de yemas + 5 de cada yema a la muñeca
                          ────
                            78
```

> Si esas funciones cambian en `ml-training/`, hay que **reentrenar el modelo y
> volver a copiarlas aquí**. Si divergen, las features dejan de coincidir con las
> que vio el SVM y las predicciones se degradan **en silencio**, sin lanzar error.
> `app/model.py` comprueba `n_features_in_` al cargar y se niega a usar un modelo
> que espere otro número de features.

Se eligió `D` sobre `C · world crudo` (0.9469 vs 0.9547) porque normaliza escala:
eso la hace inmune a las diferencias entre MediaPipe legacy (web) y Tasks (móvil).

---

## Quiralidad: por qué el servicio espeja la mano

**Es la parte más frágil de la integración. Leer antes de tocar nada.**

`ml-training/collect.py` aplica `cv2.flip(frame, 1)` **antes** de extraer los
landmarks, así que el modelo se entrenó sobre imágenes **espejadas**: 12 909 de
13 339 muestras (96.8 %) tienen handedness `Left` — la mano derecha del sujeto
vista como en un espejo.

En producción **nadie espeja el búfer de píxeles**: el navegador hace
`ctx.drawImage(video,0,0)` sin flip y el móvil manda el JPEG crudo de
`takePictureAsync`. La misma mano llega con la `x` de signo contrario.

Medido sobre una sesión no vista en entrenamiento (20 letras):

| | accuracy | confianza media |
|---|---|---|
| Orientación de entrenamiento | **0.9951** | 0.953 |
| Espejada (sin corregir) | **0.2826** | 0.437 |

Es un fallo **silencioso**: no lanza error, simplemente acierta 1 de cada 4.

`app/features.py` lo corrige: si la handedness recibida es `Right`, niega la `x`
para llevar la mano al espacio en que se entrenó. Sin handedness asume `Right`
(el caso de producción). Esto también funciona para una persona **zurda**: su
mano izquierda sin espejar equivale a una mano derecha espejada.

### ⚠️ Legacy y Tasks reportan handedness OPUESTA

Verificado sobre la **misma foto** de una mano derecha sin espejar:

| Librería | Quién la usa | Reporta |
|---|---|---|
| MediaPipe **Tasks** (Python) | `/recognize` — móvil | `Right` |
| MediaPipe **legacy** (CDN JS) | `/classify` — web | `Left` (score 0.996) |

Legacy invierte la **etiqueta** porque asume que la imagen viene espejada, pero
**no** invierte las coordenadas world, que llegan en la misma orientación física.

Por eso el frontend traduce la etiqueta antes de enviarla, con
`handednessDesdeLegacy()` en `frontend/src/lib/api.ts`. Mandarla sin traducir
clasificaba mal — para esa foto daba `P` (0.392) en vez de `V` (0.642).

**El ml-service espera siempre la convención de Tasks.** Cualquier cliente nuevo
que use legacy debe traducir la etiqueta antes de mandarla.

---

## Contrato de la API

Las **respuestas no cambiaron**: `{letter, confidence}`. Web y móvil siguen
funcionando sin tocar nada.

### `POST /recognize` — móvil

```json
{"image": "<base64 sin prefijo data URI>", "include_landmarks": false}
→ {"letter": "V", "confidence": 0.94, "hand_found": true, "landmarks": null}
```

Extrae los landmarks en el servidor. Ya tenía los world landmarks disponibles;
antes simplemente no se leían.

### `POST /classify` — web

```jsonc
{
  "landmarks":       [ ...21 puntos {x,y,z}... ],  // obligatorio
  "world_landmarks": [ ...21 puntos {x,y,z}... ],  // opcional → activa el modelo
  "handedness":      "Right"                        // opcional, convención Tasks
}
→ {"letter": "V", "confidence": 0.94}
```

`world_landmarks` y `handedness` son **opcionales a propósito**: la PWA se sirve
tras un service worker, así que hay clientes con la versión vieja cacheada que
solo mandan `landmarks`. Con esto siguen funcionando (con reglas) en lugar de
romperse con un **422**. No los hagas obligatorios.

Sin `world_landmarks` → reglas. Con ellos y con el modelo cargado → modelo.

---

## La confianza y el gate de 0.72

`confidence` ya **no** es el margen heurístico de las reglas: es `predict_proba`
del SVM, una probabilidad real. Es mucho más alta. Medido en una sesión no vista:

```
p5 0.844 · p25 0.956 · mediana 0.971 · p95 0.986
aciertos: media 0.955    errores: media 0.575
```

| umbral | frames que pasan | accuracy de los que pasan |
|---|---|---|
| 0.60 | 99.2 % | 0.9970 |
| **0.72** | **97.7 %** | **0.9990** |
| 0.80 | 96.0 % | 1.0000 |
| 0.90 | 92.5 % | 1.0000 |

> **PENDIENTE: recalibrar el gate de 0.72.** Se eligió para el clasificador de
> reglas y con el modelo ya casi no filtra (deja pasar el 97.7 %). Un valor
> razonable sería ~0.90.
>
> Se mantiene en 0.72 **a propósito** para no desalinear web y móvil: `mobile/`
> usa el mismo valor y su flujo no cambia en esta integración. Subirlo hay que
> hacerlo en **ambas plataformas a la vez**, con datos de uso real y con **más de
> un sujeto** — el modelo se entrenó con uno solo, así que con otras manos la
> confianza bajará.
>
> En web está como constante nombrada: `ML_CONFIDENCE_GATE` en
> `frontend/src/lib/api.ts`.

---

## Diferencias conocidas entre el modelo y el fallback de reglas

El repertorio de letras **no es el mismo**:

| | Letras |
|---|---|
| Modelo (22) | A B C D E F G H I K L M N O P R S T U V W **Y** |
| Reglas (20) | A B C D E F G H I K L O P S T U V W **X** Y |

- El modelo añade **M, N, R**; las reglas no las tienen.
- Las reglas tienen **X**; **el modelo nunca emitirá X**.
- `SIGN_DESCRIPTIONS` en `frontend/src/views/PracticeView.tsx` sigue listando
  **X** aunque el modelo no la produzca. Queda pendiente de decidir.
- Ninguno de los dos cubre letras con movimiento (J, Ñ, Q, Z).

Al caer al fallback, el repertorio cambia bajo los pies de la app.

---

## Dependencias: cuidado con numpy

```
scikit-learn==1.9.0
scipy==1.17.1
joblib==1.5.3
```

Versiones **exactas** del entorno de entrenamiento (conda `senias-ml`): un
pipeline serializado con una versión de sklearn puede fallar al deserializarse
con otra.

> **NO añadir pandas.** Arrastra numpy 2.x y **mediapipe 0.10.14 solo funciona
> con numpy 1.x**. Ya rompió el servicio una vez. pandas solo hace falta para
> entrenar, no para servir.

Instalar en el env `senias` sin romper mediapipe (pinear numpy en el mismo
comando hace que pip resuelva todo junto en vez de subirlo):

```bash
pip install "scikit-learn==1.9.0" "scipy==1.17.1" "joblib==1.5.3" "numpy==1.26.4"
```

Comprobar después:

```bash
python -c "import mediapipe; import numpy; print(mediapipe.__version__, numpy.__version__)"
# 0.10.14 1.26.4
```

Nota: el `Dockerfile` usa `python:3.11-slim` mientras que el modelo se entrenó
con Python 3.12. El pickle es portable entre esas versiones, pero si algún día
falla al cargar en Docker, ese es el primer sitio donde mirar — `/health` lo
dirá con `"classifier":"rules"` y el error en `model_error`.
