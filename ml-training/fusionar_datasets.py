"""
Fusiona las secuencias dinamicas al dataset estatico.
SenasUTSCMX · Adrian Gottfried · UTSC 2026

POR QUE
  El experimento con senas dinamicas mostro que "solo forma" clasifica J, N~, Q,
  X y Z al 100%, mientras que "solo trayectoria" se queda en 0.80. Es decir: la
  configuracion de la mano ya las separa. Si la pose basta, no hace falta montar
  la infraestructura de secuencias en el ml-service ni en las apps: basta con
  anadir estas 5 letras al modelo estatico y reentrenar.

EL PROBLEMA A CORREGIR
  Los dos recolectores grabaron en espacios distintos:
    collect.py            hacia cv2.flip(frame, 1)  -> imagen espejada
    collect_dinamicas.py  NO espeja                 -> imagen tal cual
  Por eso el CSV estatico es ~97% handedness Left y el dinamico ~99% Right: es
  la misma mano derecha, vista al reves. Fusionarlos sin corregir metería ruido.

  Este script lleva las dinamicas al espacio del estatico (espejado), que es en
  el que ya esta entrenado y desplegado el modelo en produccion. Espejar =
  negar la coordenada x e invertir la etiqueta de handedness.

QUE HACE
  1. Lee data/secuencias_raw.csv (dinamicas) y data/landmarks_raw.csv (estatico)
  2. Espeja las dinamicas para alinearlas con el estatico
  3. Submuestrea las secuencias: de ~55 frames por secuencia toma unos pocos
     repartidos, para no inundar el dataset con frames casi identicos
  4. Escribe data/landmarks_fusionado.csv con las 27 letras

USO
    conda activate senias-ml
    cd ~/Desktop/senias-v2/ml-training
    python fusionar_datasets.py
"""

import csv
from pathlib import Path

import numpy as np
import pandas as pd

EST = "data/landmarks_raw.csv"
DIN = "data/secuencias_raw.csv"
OUT = "data/landmarks_fusionado.csv"

# Frames que se toman de cada secuencia. Con ~55 frames por secuencia y 154
# secuencias habria 8879 frames, que desbalancearia el dataset (las estaticas
# tienen ~600 por letra). Tomando 12 repartidos por secuencia quedan ~370 por
# letra dinamica: comparable, y sin frames redundantes.
FRAMES_POR_SECUENCIA = 12

# La N-tilde se guardo como "NT" en el recolector dinamico para evitar problemas
# de codificacion. Aqui se mantiene asi: el modelo la aprendera con esa etiqueta
# y el ml-service la traducira al mostrarla.
RENOMBRAR = {}


def espejar(df, cols_img, cols_wld):
    """Espeja horizontalmente: niega la x e invierte la etiqueta de handedness.

    Lleva las muestras del espacio "sin espejo" (dinamicas) al espacio
    "espejado" (estaticas), que es en el que ya vive el modelo en produccion.
    """
    out = df.copy()
    for c in cols_img + cols_wld:
        if c.endswith("_x"):
            out[c] = -out[c]

    # Las coordenadas de imagen van de 0 a 1, asi que espejar es 1 - x, no -x.
    for c in cols_img:
        if c.endswith("_x"):
            out[c] = 1.0 + out[c]      # 1 - x_original

    out["handedness"] = out["handedness"].map(
        {"Right": "Left", "Left": "Right"}).fillna(out["handedness"])
    return out


def main():
    if not Path(EST).exists():
        raise SystemExit(f"No encuentro {EST}")
    if not Path(DIN).exists():
        raise SystemExit(f"No encuentro {DIN}")

    print("Cargando datasets...")
    est = pd.read_csv(EST)
    din = pd.read_csv(DIN)

    cols_img = [f"img_{i}_{c}" for i in range(21) for c in "xyz"]
    cols_wld = [f"wld_{i}_{c}" for i in range(21) for c in "xyz"]

    print(f"\nEstatico : {len(est):6d} filas | {est['label'].nunique()} letras "
          f"| {est['sesion'].nunique()} sesiones")
    print(f"Dinamico : {len(din):6d} filas | {din['label'].nunique()} letras "
          f"| {din['sesion'].nunique()} sesiones | "
          f"{din['secuencia_id'].nunique()} secuencias")

    print("\nHandedness antes de corregir:")
    print(f"  estatico: {dict(est['handedness'].value_counts())}")
    print(f"  dinamico: {dict(din['handedness'].value_counts())}")

    # --- 1. Submuestrear las secuencias ------------------------------------
    print(f"\nSubmuestreando: {FRAMES_POR_SECUENCIA} frames por secuencia...")
    trozos = []
    for sid, sub in din.groupby("secuencia_id"):
        sub = sub.sort_values("frame_idx")
        n = len(sub)
        if n <= FRAMES_POR_SECUENCIA:
            trozos.append(sub)
        else:
            # Indices repartidos uniformemente a lo largo de la secuencia, para
            # cubrir todo el movimiento y no solo el principio.
            idx = np.linspace(0, n - 1, FRAMES_POR_SECUENCIA).astype(int)
            trozos.append(sub.iloc[idx])
    din_sub = pd.concat(trozos, ignore_index=True)
    print(f"  {len(din)} -> {len(din_sub)} filas")

    # --- 2. Espejar para alinear con el estatico ---------------------------
    print("\nEspejando las dinamicas para alinearlas con el estatico...")
    din_esp = espejar(din_sub, cols_img, cols_wld)
    print(f"  handedness despues: {dict(din_esp['handedness'].value_counts())}")

    # --- 3. Adaptar columnas ------------------------------------------------
    # El CSV dinamico tiene secuencia_id y frame_idx, que el estatico no. Se
    # descartan: a partir de aqui cada fila es una muestra independiente.
    # La sesion se prefija para que no colisione con las del estatico.
    din_esp = din_esp.copy()
    din_esp["sesion"] = "din_" + din_esp["sesion"].astype(str)
    if RENOMBRAR:
        din_esp["label"] = din_esp["label"].replace(RENOMBRAR)

    columnas_finales = list(est.columns)
    faltan = [c for c in columnas_finales if c not in din_esp.columns]
    if faltan:
        raise SystemExit(f"Al dinamico le faltan columnas del estatico: {faltan}")
    din_esp = din_esp[columnas_finales]

    # --- 4. Fusionar --------------------------------------------------------
    fusion = pd.concat([est, din_esp], ignore_index=True)
    fusion.to_csv(OUT, index=False)

    print(f"\nEscrito {OUT}")
    print(f"  filas    : {len(fusion)}")
    print(f"  letras   : {fusion['label'].nunique()}")
    print(f"  sesiones : {fusion['sesion'].nunique()}")

    print("\nMuestras por letra:")
    conteo = fusion["label"].value_counts().sort_index()
    for L, n in conteo.items():
        marca = "  <- nueva" if L in set(din["label"]) else ""
        print(f"  {L:3s}: {n:5d}{marca}")

    print(f"\nDesbalance: {conteo.max() / conteo.min():.2f}x")

    ses = fusion.groupby("label")["sesion"].nunique().sort_values()
    riesgo = ses[ses < 3]
    if len(riesgo):
        print(f"\nAVISO: letras en menos de 3 sesiones: {list(riesgo.index)}")
        print("  Su evaluacion sera menos fiable.")
    else:
        print("\nTodas las letras estan en 3+ sesiones.")

    print("""
SIGUIENTE PASO
  Entrena con el dataset fusionado. En entrenar_lsm.py cambia la linea:

      df = pd.read_csv("data/landmarks_raw.csv")

  por:

      df = pd.read_csv("data/landmarks_fusionado.csv")

  y ejecuta:  python entrenar_lsm.py""")


if __name__ == "__main__":
    main()
