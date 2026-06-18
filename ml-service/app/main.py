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
from pydantic import BaseModel

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

@app.get("/health")
def health():
    return {"status": "ok", "service": "SeñasUTSCMX ML"}

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
    letter, confidence = classify(lm_list)

    response = RecognizeResponse(
        letter=letter, confidence=round(confidence, 3), hand_found=True
    )
    if req.include_landmarks:
        response.landmarks = lm_list

    return response

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