import base64
import io
import urllib.request
import os
from typing import Optional

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field

from . import model as ml_model
from .classifier import classify

MODEL_PATH = "hand_landmarker.task"
MODEL_URL  = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

if not os.path.exists(MODEL_PATH):
    print("Descargando modelo HandLandmarker...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("Modelo descargado.")

app = FastAPI(title="SeñasUTSCMX ML Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
options      = mp_vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=1,
    min_hand_detection_confidence=0.65,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)
detector = mp_vision.HandLandmarker.create_from_options(options)

class RecognizeRequest(BaseModel):
    image:             str
    include_landmarks: bool = False

class RecognizeResponse(BaseModel):
    letter:     str
    confidence: float
    hand_found: bool
    landmarks:  Optional[list] = None

class Landmark(BaseModel):
    x: float
    y: float
    z: float

class ClassifyRequest(BaseModel):
    # Landmarks de imagen (normalizados a [0,1]). Siguen siendo obligatorios:
    # son lo único que necesita el fallback de reglas.
    landmarks: list[Landmark] = Field(min_length=21, max_length=21)
    # Campos OPCIONALES, añadidos para el modelo ML. Son opcionales a propósito:
    # la PWA se sirve tras un service worker, así que hay clientes con la
    # versión vieja cacheada que siguen mandando solo `landmarks`. Con esto
    # siguen funcionando (con reglas) en vez de romperse con un 422.
    world_landmarks: Optional[list[Landmark]] = Field(default=None, min_length=21, max_length=21)
    handedness:      Optional[str] = None

class ClassifyResponse(BaseModel):
    letter:     str
    confidence: float

def _clasificar(world_landmarks, handedness, landmarks_imagen):
    """Modelo ML si se puede; reglas si no. Única vía de decisión, compartida
    por /recognize y /classify para que ambos se comporten igual."""
    pred = ml_model.predict(world_landmarks, handedness)
    if pred is not None:
        return pred
    return classify(landmarks_imagen)

@app.get("/health")
def health():
    return {
        "status":  "ok",
        "service": "SeñasUTSCMX ML",
        # Para saber de un vistazo si está clasificando con el modelo o
        # degradado a reglas, sin tener que leer los logs del proceso.
        "classifier":  "ml" if ml_model.disponible() else "rules",
        "model_error": ml_model.ERROR_CARGA,
    }

@app.post("/recognize", response_model=RecognizeResponse)
def recognize(req: RecognizeRequest):
    try:
        image_bytes = base64.b64decode(req.image)
        pil_image   = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_image    = np.array(pil_image)
        mp_image    = mp.Image(image_format=mp.ImageFormat.SRGB, data=np_image)
    except Exception:
        raise HTTPException(status_code=400, detail="Imagen inválida")

    result = detector.detect(mp_image)

    if not result.hand_landmarks:
        return RecognizeResponse(letter="?", confidence=0.0, hand_found=False)

    lm_list = [
        {"x": lm.x, "y": lm.y, "z": lm.z}
        for lm in result.hand_landmarks[0]
    ]
    # World landmarks (metros, origen en la muñeca): es lo que come el modelo.
    # detect() ya los devolvía; hasta ahora simplemente no se leían.
    world_list = [
        {"x": lm.x, "y": lm.y, "z": lm.z}
        for lm in result.hand_world_landmarks[0]
    ] if result.hand_world_landmarks else []

    handedness = (
        result.handedness[0][0].category_name
        if result.handedness and result.handedness[0] else None
    )

    letter, confidence = _clasificar(world_list, handedness, lm_list)

    response = RecognizeResponse(
        letter=letter, confidence=round(confidence, 3), hand_found=True
    )
    if req.include_landmarks:
        response.landmarks = lm_list

    return response

@app.post("/classify", response_model=ClassifyResponse)
def classify_landmarks(req: ClassifyRequest):
    """Clasifica 21 landmarks de MediaPipe ya extraídos (sin imagen).

    Si llegan `world_landmarks` usa el modelo ML; si no, cae a las reglas. Un
    cliente viejo que solo manda `landmarks` sigue funcionando igual que antes.
    """
    world = [lm.model_dump() for lm in req.world_landmarks] if req.world_landmarks else []
    letter, confidence = _clasificar(
        world, req.handedness, [lm.model_dump() for lm in req.landmarks]
    )
    return ClassifyResponse(letter=letter, confidence=confidence)

@app.post("/landmarks")
def get_landmarks(req: RecognizeRequest):
    try:
        image_bytes = base64.b64decode(req.image)
        pil_image   = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_image    = np.array(pil_image)
        mp_image    = mp.Image(image_format=mp.ImageFormat.SRGB, data=np_image)
    except Exception:
        raise HTTPException(status_code=400, detail="Imagen inválida")

    result = detector.detect(mp_image)
    if not result.hand_landmarks:
        return {"hand_found": False, "landmarks": []}

    return {
        "hand_found": True,
        "landmarks": [
            {"x": lm.x, "y": lm.y, "z": lm.z}
            for lm in result.hand_landmarks[0]
        ],
    }