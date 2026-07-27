"""
Recolector de landmarks para el clasificador LSM de SeñasUTSCMX.

Captura los 21 landmarks de la mano con MediaPipe y los guarda CRUDOS en un CSV.
Se guardan los dos juegos que da MediaPipe:
  - image landmarks : normalizados 0-1 respecto al cuadro (para dibujar)
  - world landmarks : metros, origen en la muñeca (mejores para clasificar)
La normalizacion se decide despues, en el notebook. Aqui NO se procesa nada.

USO
    conda activate senias
    python collect.py --sujeto adrian

CONTROLES (sobre la ventana de video)
    A-Z        selecciona la letra objetivo
    ESPACIO    inicia / detiene la grabacion continua
    BACKSPACE  borra la ultima muestra guardada (por si sale mal)
    TAB        muestra el conteo por letra en la terminal
    ESC / Q    salir

El CSV se escribe en modo append: si el script se cae, no pierdes lo grabado.
"""

import argparse
import csv
import os
import sys
import time
from collections import Counter
from datetime import datetime

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# --- Configuracion -----------------------------------------------------------

# Ruta al modelo de MediaPipe. Es el mismo que ya usa tu ml-service.
MODEL_PATH = os.path.join("..", "ml-service", "hand_landmarker.task")

OUT_DIR = "data"
OUT_CSV = os.path.join(OUT_DIR, "landmarks_raw.csv")

# Cada cuanto se guarda una muestra mientras grabas.
# 0.10s = ~10 muestras/segundo. Mas rapido genera frames casi identicos
# (redundantes, no aportan variedad al modelo).
CAPTURE_INTERVAL = 0.10

# Letras estaticas del abecedario LSM que este modelo va a aprender.
# Se excluyen las que llevan movimiento (J, M, N, Ñ, Q, Z): esas necesitan
# analisis de secuencia, no de una sola pose.
LETRAS = list("ABCDEFGHIKLMNOPRSTUVWY")

# Conexiones entre landmarks, solo para dibujar el esqueleto de la mano.
CONEXIONES = [
    (0, 1), (1, 2), (2, 3), (3, 4),           # pulgar
    (0, 5), (5, 6), (6, 7), (7, 8),           # indice
    (0, 9), (9, 10), (10, 11), (11, 12),      # medio
    (0, 13), (13, 14), (14, 15), (15, 16),    # anular
    (0, 17), (17, 18), (18, 19), (19, 20),    # menique
    (5, 9), (9, 13), (13, 17),                # palma
]


def construir_header():
    """Columnas del CSV: metadatos + 63 coords de imagen + 63 coords world."""
    cols = ["timestamp", "sujeto", "sesion", "label", "handedness", "score"]
    for i in range(21):
        cols += [f"img_{i}_x", f"img_{i}_y", f"img_{i}_z"]
    for i in range(21):
        cols += [f"wld_{i}_x", f"wld_{i}_y", f"wld_{i}_z"]
    return cols


def contar_por_letra(path):
    """Lee el CSV existente y devuelve cuantas muestras hay de cada letra."""
    if not os.path.exists(path):
        return Counter()
    conteo = Counter()
    with open(path, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            conteo[fila["label"]] += 1
    return conteo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sujeto", required=True,
                    help="Quien graba (ej. adrian, kevin). Sirve para medir "
                         "despues si el modelo generaliza a otras manos.")
    ap.add_argument("--camara", type=int, default=0,
                    help="Indice de la camara (0 = la de la Mac).")
    args = ap.parse_args()

    if not os.path.exists(MODEL_PATH):
        sys.exit(f"No encuentro el modelo en {MODEL_PATH}\n"
                 f"Corre este script desde la carpeta ml-training/")

    os.makedirs(OUT_DIR, exist_ok=True)

    # Escribe el header solo si el CSV es nuevo.
    nuevo = not os.path.exists(OUT_CSV)
    csv_file = open(OUT_CSV, "a", newline="", encoding="utf-8")
    writer = csv.writer(csv_file)
    if nuevo:
        writer.writerow(construir_header())
        csv_file.flush()

    sesion = datetime.now().strftime("%Y%m%d_%H%M%S")
    conteo = contar_por_letra(OUT_CSV)
    print(f"Sesion {sesion} | sujeto: {args.sujeto}")
    print(f"Muestras ya existentes en el CSV: {sum(conteo.values())}")

    # --- MediaPipe -----------------------------------------------------------
    opciones = vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    landmarker = vision.HandLandmarker.create_from_options(opciones)

    cap = cv2.VideoCapture(args.camara)
    if not cap.isOpened():
        sys.exit("No pude abrir la camara. Revisa permisos en Ajustes del "
                 "sistema > Privacidad y seguridad > Camara.")

    letra = LETRAS[0]
    grabando = False
    ultimo_guardado = 0.0
    ultima_fila = None       # para poder deshacer con BACKSPACE
    t0 = time.time()

    print("\nListo. ESPACIO para grabar, A-Z para cambiar de letra, ESC para salir.\n")

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        # Espejo: te ves como en un espejo, es mas natural para posar la mano.
        # OJO: esto solo afecta lo que VES; los landmarks se calculan sobre
        # el frame ya volteado, asi que es consistente con lo que grabas.
        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        ts_ms = int((time.time() - t0) * 1000)
        resultado = landmarker.detect_for_video(mp_image, ts_ms)

        h, w = frame.shape[:2]
        hay_mano = bool(resultado.hand_landmarks)

        if hay_mano:
            lms = resultado.hand_landmarks[0]
            wlms = resultado.hand_world_landmarks[0]
            info = resultado.handedness[0][0]

            # Dibuja el esqueleto para que veas que la deteccion es buena.
            for a, b in CONEXIONES:
                pa = (int(lms[a].x * w), int(lms[a].y * h))
                pb = (int(lms[b].x * w), int(lms[b].y * h))
                cv2.line(frame, pa, pb, (0, 210, 184), 2)
            for lm in lms:
                cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 4,
                           (157, 123, 248), -1)

            # Guarda una muestra si estas grabando y ya paso el intervalo.
            ahora = time.time()
            if grabando and (ahora - ultimo_guardado) >= CAPTURE_INTERVAL:
                fila = [
                    datetime.now().isoformat(timespec="milliseconds"),
                    args.sujeto,
                    sesion,
                    letra,
                    info.category_name,      # "Left" / "Right"
                    round(info.score, 4),
                ]
                for lm in lms:
                    fila += [round(lm.x, 6), round(lm.y, 6), round(lm.z, 6)]
                for lm in wlms:
                    fila += [round(lm.x, 6), round(lm.y, 6), round(lm.z, 6)]

                writer.writerow(fila)
                csv_file.flush()          # escribe a disco ya, no en buffer
                conteo[letra] += 1
                ultima_fila = fila
                ultimo_guardado = ahora

        # --- HUD -------------------------------------------------------------
        cv2.rectangle(frame, (0, 0), (w, 90), (20, 20, 30), -1)
        cv2.putText(frame, f"LETRA: {letra}", (16, 38),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 210, 184), 3)
        cv2.putText(frame, f"muestras: {conteo[letra]}", (16, 72),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

        if grabando:
            cv2.circle(frame, (w - 40, 40), 14, (0, 0, 255), -1)
            cv2.putText(frame, "REC", (w - 110, 48),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        else:
            cv2.putText(frame, "ESPACIO = grabar", (w - 260, 48),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1)

        if not hay_mano:
            cv2.putText(frame, "NO SE DETECTA LA MANO", (16, h - 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        cv2.imshow("Recoleccion LSM  |  ESC para salir", frame)

        # --- Teclado ---------------------------------------------------------
        k = cv2.waitKey(1) & 0xFF
        if k in (27, ord("q")):                      # ESC o Q
            break
        elif k == 32:                                # ESPACIO
            grabando = not grabando
            print(f"{'▶ grabando' if grabando else '⏸ pausa'} — letra {letra}")
        elif k in (8, 127):                          # BACKSPACE / DELETE
            if ultima_fila is not None:
                # Reescribe el CSV sin la ultima fila.
                with open(OUT_CSV, newline="", encoding="utf-8") as f:
                    filas = list(csv.reader(f))
                if len(filas) > 1:
                    filas.pop()
                    csv_file.close()
                    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
                        csv.writer(f).writerows(filas)
                    csv_file = open(OUT_CSV, "a", newline="", encoding="utf-8")
                    writer = csv.writer(csv_file)
                    conteo[ultima_fila[3]] -= 1
                    ultima_fila = None
                    print("↩ ultima muestra borrada")
        elif k == 9:                                 # TAB
            print("\n--- muestras por letra ---")
            for L in LETRAS:
                barra = "█" * (conteo[L] // 10)
                print(f"  {L}: {conteo[L]:4d} {barra}")
            print(f"  TOTAL: {sum(conteo.values())}\n")
        elif 97 <= k <= 122:                         # a-z minuscula
            candidata = chr(k).upper()
            if candidata in LETRAS:
                letra = candidata
                grabando = False
                print(f"→ letra {letra} ({conteo[letra]} muestras)")
        elif 65 <= k <= 90:                          # A-Z mayuscula
            candidata = chr(k)
            if candidata in LETRAS:
                letra = candidata
                grabando = False
                print(f"→ letra {letra} ({conteo[letra]} muestras)")

    cap.release()
    cv2.destroyAllWindows()
    csv_file.close()

    print("\n=== RESUMEN DE LA SESION ===")
    for L in LETRAS:
        print(f"  {L}: {conteo[L]}")
    print(f"  TOTAL acumulado en el CSV: {sum(conteo.values())}")
    print(f"  Archivo: {os.path.abspath(OUT_CSV)}")


if __name__ == "__main__":
    main()
