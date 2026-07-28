"""
SeñasUTSCMX — Features del clasificador ML
==========================================
Construye la representación "D · world + distancias" (78 features) que espera
clasificador_lsm.joblib.

  63  normalizar()        world landmarks centrados en la muñeca y escalados
                          por el tamaño de la palma
+ 15  distancias_yemas()  10 distancias entre pares de yemas + 5 de cada yema
                          a la muñeca
────
  78

CRÍTICO: normalizar() y distancias_yemas() son COPIA EXACTA de
ml-training/entrenar_lsm.py. Si allí cambian, hay que reentrenar el modelo y
volver a copiarlas aquí. Si divergen, las features dejan de coincidir con las
que vio el SVM y las predicciones se degradan EN SILENCIO (sin excepción).
"""

import numpy as np

N_FEATURES = 78

# ─── Copia exacta de ml-training/entrenar_lsm.py ──────────────────────────

def a_puntos(X):
    return X.reshape(len(X), 21, 3)


def normalizar(X):
    """Centra en la muneca y escala por el tamano de la palma."""
    P = a_puntos(X).copy()
    P -= P[:, 0:1, :]
    escala = np.linalg.norm(P[:, 9, :], axis=1, keepdims=True)
    escala[escala == 0] = 1e-8
    P /= escala[:, :, None]
    return P.reshape(len(P), -1)


def distancias_yemas(X):
    """Distancias entre las 5 yemas + de cada yema a la muneca (15 valores)."""
    P = a_puntos(X)
    yemas = P[:, [4, 8, 12, 16, 20], :]
    out = []
    for i in range(5):
        for j in range(i + 1, 5):
            out.append(np.linalg.norm(yemas[:, i] - yemas[:, j], axis=1))
    for i in range(5):
        out.append(np.linalg.norm(yemas[:, i] - P[:, 0], axis=1))
    return np.stack(out, axis=1)


# ─── Quiralidad ───────────────────────────────────────────────────────────
# Los datos de entrenamiento se grabaron con ml-training/collect.py, que aplica
# cv2.flip(frame, 1) ANTES de extraer los landmarks. Sobre ese frame espejado
# MediaPipe reportó handedness "Left" en 12909 de 13339 muestras (96.8%): es la
# mano derecha del sujeto vista como en un espejo.
#
# En producción NADIE espeja el búfer de píxeles. El navegador hace
# ctx.drawImage(video,0,0) sin flip y el móvil manda el JPEG crudo de
# takePictureAsync. La misma mano física llega entonces con la x de signo
# contrario al entrenamiento.
#
# El coste medido de ignorarlo (test = sesión 20260728_145019, 20 letras, nunca
# vista en entrenamiento): accuracy 0.9951 -> 0.2826, confianza media 0.95 ->
# 0.44. Es un fallo SILENCIOSO: no lanza error, simplemente acierta 1 de cada 4.
#
# Solución: llevar toda entrada al espacio en que se entrenó. Si MediaPipe
# reporta "Right", se niega la x.
MANO_ENTRENAMIENTO = "Left"


def aplicar_quiralidad(X, handedness):
    """Espeja la mano si viene en la quiralidad contraria a la de entrenamiento.

    X: (n, 63) world landmarks crudos.
    handedness: "Left" | "Right" | None. Si es None se asume "Right", que es lo
    que reporta MediaPipe Tasks para la mano derecha en un frame SIN espejar
    (el caso de producción). Negar la x es exactamente reflejar la mano.
    """
    etiqueta = (handedness or "Right").strip().capitalize()
    if etiqueta == MANO_ENTRENAMIENTO:
        return X
    P = a_puntos(X).copy()
    P[:, :, 0] *= -1
    return P.reshape(len(P), -1)


# ─── API pública ──────────────────────────────────────────────────────────

def construir_features(world_landmarks, handedness=None):
    """21 world landmarks -> vector (1, 78) listo para el pipeline de sklearn.

    world_landmarks: list[dict] de 21 puntos {'x','y','z'} en METROS (los
    hand_world_landmarks de MediaPipe, NO los de imagen normalizados a [0,1]).
    """
    if len(world_landmarks) != 21:
        raise ValueError(f"Se esperaban 21 world landmarks, llegaron {len(world_landmarks)}")

    X = np.array(
        [[p["x"], p["y"], p["z"]] for p in world_landmarks], dtype=np.float32
    ).reshape(1, 63)

    X = aplicar_quiralidad(X, handedness)
    feats = np.hstack([normalizar(X), distancias_yemas(X)])

    if feats.shape[1] != N_FEATURES:
        raise ValueError(f"Se construyeron {feats.shape[1]} features, se esperaban {N_FEATURES}")
    return feats
