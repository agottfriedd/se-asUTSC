"""
Recolector de SECUENCIAS para las senas dinamicas de LSM.
SenasUTSCMX · Adrian Gottfried · UTSC 2026

DIFERENCIA CON collect.py
  collect.py graba frames sueltos: cada frame es una muestra (pose estatica).
  Este graba SECUENCIAS: mantienes ESPACIO mientras haces el movimiento completo
  y toda esa secuencia de frames es UNA sola muestra.

  Se usa para las letras que llevan movimiento y no se pueden clasificar desde
  una sola pose: J, N-tilde, Q, X, Z.

USO
    conda activate senias-ml
    cd ~/Desktop/senias-v2/ml-training
    python collect_dinamicas.py --sujeto adrian

CONTROLES (sobre la ventana de video)
    J N Q X Z  selecciona la letra
    ESPACIO    mantenlo presionado mientras haces el movimiento; al soltarlo
               se guarda la secuencia
    BACKSPACE  borra la ultima secuencia guardada
    TAB        conteo por letra
    ESC        salir

COMO GRABAR BIEN
  1. Coloca la mano en la posicion INICIAL de la sena
  2. Manten ESPACIO
  3. Haz el movimiento completo, sin prisa (1-2 segundos)
  4. Suelta ESPACIO al terminar
  Repite ~60 veces por letra, variando un poco velocidad y posicion.

FORMATO DEL CSV
  Una fila por FRAME, pero con una columna secuencia_id que agrupa los frames de
  un mismo movimiento. El entrenamiento reconstruye las secuencias con ese id.
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

MODEL_PATH = os.path.join("..", "ml-service", "hand_landmarker.task")
OUT_DIR = "data"
OUT_CSV = os.path.join(OUT_DIR, "secuencias_raw.csv")

# Letras dinamicas del abecedario LSM. La N-tilde se escribe "NT" en el CSV
# para no tener problemas de codificacion; se muestra como N~ en pantalla.
LETRAS = ["J", "NT", "Q", "X", "Z"]
ETIQUETA = {"J": "J", "NT": "N~", "Q": "Q", "X": "X", "Z": "Z"}
TECLA = {ord("j"): "J", ord("n"): "NT", ord("q"): "Q", ord("x"): "X", ord("z"): "Z"}

# Minimo de frames para que una secuencia cuente. Menos que esto es un toque
# accidental, no un movimiento.
MIN_FRAMES = 8

CONEXIONES = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (0, 9), (9, 10), (10, 11), (11, 12),
    (0, 13), (13, 14), (14, 15), (15, 16),
    (0, 17), (17, 18), (18, 19), (19, 20),
    (5, 9), (9, 13), (13, 17),
]


def construir_header():
    cols = ["secuencia_id", "frame_idx", "timestamp", "sujeto", "sesion",
            "label", "handedness", "score"]
    for i in range(21):
        cols += [f"img_{i}_x", f"img_{i}_y", f"img_{i}_z"]
    for i in range(21):
        cols += [f"wld_{i}_x", f"wld_{i}_y", f"wld_{i}_z"]
    return cols


def contar_secuencias(path):
    """Cuenta secuencias (no frames) por letra."""
    if not os.path.exists(path):
        return Counter(), 0
    vistos = set()
    conteo = Counter()
    max_id = 0
    with open(path, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            sid = int(fila["secuencia_id"])
            max_id = max(max_id, sid)
            if sid not in vistos:
                vistos.add(sid)
                conteo[fila["label"]] += 1
    return conteo, max_id


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sujeto", required=True)
    ap.add_argument("--camara", type=int, default=0)
    args = ap.parse_args()

    if not os.path.exists(MODEL_PATH):
        sys.exit(f"No encuentro el modelo en {MODEL_PATH}\n"
                 f"Corre este script desde la carpeta ml-training/")

    os.makedirs(OUT_DIR, exist_ok=True)

    nuevo = not os.path.exists(OUT_CSV)
    csv_file = open(OUT_CSV, "a", newline="", encoding="utf-8")
    writer = csv.writer(csv_file)
    if nuevo:
        writer.writerow(construir_header())
        csv_file.flush()

    sesion = datetime.now().strftime("%Y%m%d_%H%M%S")
    conteo, ultimo_id = contar_secuencias(OUT_CSV)
    siguiente_id = ultimo_id + 1

    print(f"Sesion {sesion} | sujeto: {args.sujeto}")
    print(f"Secuencias ya existentes: {sum(conteo.values())}")
    print("\nMANTEN ESPACIO mientras haces el movimiento. Al soltarlo se guarda.\n")

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
    buffer = []              # frames de la secuencia en curso
    ultima_secuencia = None  # para deshacer con BACKSPACE
    t0 = time.time()

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        # OJO: NO espejamos el frame. En collect.py se hacia cv2.flip y eso
        # invirtio la quiralidad respecto a produccion. Aqui se graba tal cual
        # llega, igual que lo ve la app.
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

            for a, b in CONEXIONES:
                pa = (int(lms[a].x * w), int(lms[a].y * h))
                pb = (int(lms[b].x * w), int(lms[b].y * h))
                cv2.line(frame, pa, pb, (0, 210, 184), 2)
            for lm in lms:
                cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 4,
                           (157, 123, 248), -1)

            # Estela del indice mientras grabas, para que veas el trazo.
            if grabando and buffer:
                pts = [(int(f["img"][8].x * w), int(f["img"][8].y * h))
                       for f in buffer[-40:]]
                for i in range(1, len(pts)):
                    cv2.line(frame, pts[i - 1], pts[i], (0, 100, 255), 3)

            if grabando:
                buffer.append({"img": list(lms), "wld": list(wlms),
                               "hand": info.category_name,
                               "score": round(info.score, 4)})

        # --- HUD ---
        cv2.rectangle(frame, (0, 0), (w, 96), (20, 20, 30), -1)
        cv2.putText(frame, f"LETRA: {ETIQUETA[letra]}", (16, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 210, 184), 3)
        cv2.putText(frame, f"secuencias: {conteo[letra]}", (16, 76),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

        if grabando:
            cv2.circle(frame, (w - 40, 40), 14, (0, 0, 255), -1)
            cv2.putText(frame, f"REC {len(buffer)}", (w - 160, 48),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        else:
            cv2.putText(frame, "MANTEN ESPACIO", (w - 250, 48),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1)

        if not hay_mano:
            cv2.putText(frame, "NO SE DETECTA LA MANO", (16, h - 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        cv2.imshow("Senas dinamicas  |  ESC para salir", frame)

        # --- Teclado ---
        k = cv2.waitKey(1) & 0xFF

        # ESPACIO sostenido: mientras se detecte, grabamos.
        if k == 32:
            if not grabando:
                grabando = True
                buffer = []
            ultimo_espacio = time.time()
        elif grabando and k == 255:
            # waitKey devuelve 255 cuando no hay tecla. Si pasan >150 ms sin
            # ESPACIO, damos la secuencia por terminada.
            if time.time() - ultimo_espacio > 0.15:
                grabando = False
                if len(buffer) >= MIN_FRAMES:
                    for idx, f in enumerate(buffer):
                        fila = [siguiente_id, idx,
                                datetime.now().isoformat(timespec="milliseconds"),
                                args.sujeto, sesion, letra, f["hand"], f["score"]]
                        for lm in f["img"]:
                            fila += [round(lm.x, 6), round(lm.y, 6), round(lm.z, 6)]
                        for lm in f["wld"]:
                            fila += [round(lm.x, 6), round(lm.y, 6), round(lm.z, 6)]
                        writer.writerow(fila)
                    csv_file.flush()
                    conteo[letra] += 1
                    ultima_secuencia = siguiente_id
                    print(f"  guardada #{conteo[letra]} de {ETIQUETA[letra]} "
                          f"({len(buffer)} frames)")
                    siguiente_id += 1
                else:
                    print(f"  descartada: solo {len(buffer)} frames "
                          f"(minimo {MIN_FRAMES})")
                buffer = []

        if k in (27, ord("\x1b")):
            break
        elif k in (8, 127):                       # BACKSPACE
            if ultima_secuencia is not None:
                with open(OUT_CSV, newline="", encoding="utf-8") as f:
                    filas = list(csv.reader(f))
                header = filas[0]
                datos = [r for r in filas[1:] if int(r[0]) != ultima_secuencia]
                csv_file.close()
                with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
                    w_ = csv.writer(f); w_.writerow(header); w_.writerows(datos)
                csv_file = open(OUT_CSV, "a", newline="", encoding="utf-8")
                writer = csv.writer(csv_file)
                conteo[letra] = max(0, conteo[letra] - 1)
                print(f"  borrada la ultima secuencia de {ETIQUETA[letra]}")
                ultima_secuencia = None
        elif k == 9:                              # TAB
            print("\n--- secuencias por letra ---")
            for L in LETRAS:
                print(f"  {ETIQUETA[L]}: {conteo[L]}")
            print(f"  TOTAL: {sum(conteo.values())}\n")
        elif k in TECLA and not grabando:
            letra = TECLA[k]
            print(f"-> letra {ETIQUETA[letra]} ({conteo[letra]} secuencias)")

    cap.release()
    cv2.destroyAllWindows()
    csv_file.close()

    print("\n=== RESUMEN DE LA SESION ===")
    for L in LETRAS:
        print(f"  {ETIQUETA[L]}: {conteo[L]} secuencias")
    print(f"  TOTAL: {sum(conteo.values())}")
    print(f"  Archivo: {os.path.abspath(OUT_CSV)}")


if __name__ == "__main__":
    main()
