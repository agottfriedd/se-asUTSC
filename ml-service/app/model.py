"""
SeñasUTSCMX — Clasificador ML (SVM RBF entrenado con scikit-learn)
=================================================================
Carga el modelo UNA SOLA VEZ al importar el módulo (al arrancar el servicio),
nunca por petición: joblib.load() sobre este pipeline tarda ~100 ms y hacerlo
en cada frame mataría el throughput.

Si la carga falla POR CUALQUIER MOTIVO (archivo ausente, sklearn incompatible,
pickle corrupto), MODELO queda en None y el servicio sigue vivo: main.py cae al
clasificador de reglas de classifier.py. El servicio nunca debe caerse por el
modelo.

El modelo se lee de ml-service/modelo/ — copiado, no leído desde ml-training/,
que no se despliega.
"""

import json
import os
from typing import Optional, Tuple

from .features import construir_features, N_FEATURES

_DIR         = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "modelo")
MODELO_PATH  = os.path.join(_DIR, "clasificador_lsm.joblib")
METADATA_PATH = os.path.join(_DIR, "metadata.json")

MODELO   = None
METADATA = {}
ERROR_CARGA: Optional[str] = None

try:
    import joblib

    MODELO = joblib.load(MODELO_PATH)

    # Un modelo que espera otro número de features es un modelo equivocado:
    # mejor no cargarlo que servir predicciones basura.
    n_esperado = getattr(MODELO, "n_features_in_", None)
    if n_esperado is not None and n_esperado != N_FEATURES:
        raise ValueError(
            f"El modelo espera {n_esperado} features pero features.py construye "
            f"{N_FEATURES}. ¿Se reentrenó con otra representación?"
        )

    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, encoding="utf-8") as f:
            METADATA = json.load(f)

    print(
        f"[ml] Modelo cargado: {METADATA.get('modelo', 'desconocido')} · "
        f"{METADATA.get('representacion', '?')} · {N_FEATURES} features · "
        f"{len(getattr(MODELO, 'classes_', []))} letras · "
        f"accuracy_cv {METADATA.get('accuracy_cv', '?')}"
    )
except Exception as exc:                                    # noqa: BLE001
    ERROR_CARGA = f"{type(exc).__name__}: {exc}"
    MODELO = None
    print(f"[ml] AVISO: no se pudo cargar el modelo ({ERROR_CARGA}).")
    print("[ml] El servicio seguirá funcionando con el clasificador de reglas (classifier.py).")


def disponible() -> bool:
    return MODELO is not None


def predict(world_landmarks, handedness=None) -> Optional[Tuple[str, float]]:
    """Clasifica 21 world landmarks. Devuelve (letra, confianza) o None.

    None significa "no pude, usa el fallback": no hay modelo, no llegaron world
    landmarks, o la inferencia falló. El caller decide qué hacer — así un fallo
    aquí nunca tumba la petición.

    La confianza es predict_proba: una probabilidad real de la clase ganadora,
    no el margen heurístico de classifier.py. Ver README para su rango típico.
    """
    if MODELO is None or not world_landmarks:
        return None
    try:
        feats = construir_features(world_landmarks, handedness)
        probas = MODELO.predict_proba(feats)[0]
        i = int(probas.argmax())
        return str(MODELO.classes_[i]), round(float(probas[i]), 3)
    except Exception as exc:                                # noqa: BLE001
        print(f"[ml] Error en inferencia, se usará el fallback de reglas: {exc}")
        return None
