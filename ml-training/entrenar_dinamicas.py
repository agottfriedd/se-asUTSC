"""
Clasificador de senas DINAMICAS de LSM — entrenamiento
SenasUTSCMX · Adrian Gottfried · UTSC 2026

A diferencia del modelo estatico, aqui cada muestra es una SECUENCIA completa de
frames (un movimiento), no una pose suelta. Las letras J, N-tilde, Q, X y Z se
distinguen por como se mueve la mano, no por como se ve en un instante.

COMO SE REPRESENTA UNA SECUENCIA
  El problema: las secuencias tienen distinta duracion (13 a 287 frames aqui).
  Un modelo necesita vectores del mismo tamano. La solucion es resumir cada
  secuencia en un numero fijo de valores, de tres formas que comparamos:

    A · solo forma        que dedos estan extendidos, promediado en el tiempo.
                          Ignora el movimiento.
    B · solo trayectoria  por donde paso la punta del indice, remuestreada a un
                          numero fijo de puntos. Ignora la forma de la mano.
    C · forma + trayectoria   las dos cosas.

  Comparar las tres dice si estas letras se distinguen por la mano, por el
  movimiento, o hace falta ambos. Ese resultado ya es un hallazgo por si mismo.

USO
    conda activate senias-ml
    cd ~/Desktop/senias-v2/ml-training
    python entrenar_dinamicas.py
"""

import json
import datetime
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import (cross_val_score, StratifiedGroupKFold,
                                     StratifiedKFold, train_test_split)
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import classification_report, confusion_matrix
import joblib

warnings.filterwarnings("ignore")
sns.set_theme(style="whitegrid")
Path("figuras").mkdir(exist_ok=True)
Path("modelo").mkdir(exist_ok=True)

# Puntos a los que se remuestrea cada trayectoria. 8 captura la forma del trazo
# (una Z, un circulo) sin disparar el numero de features: con 154 muestras no
# podemos permitirnos cientos de columnas.
N_PUNTOS = 8

ETIQUETA = {"J": "J", "NT": "N~", "Q": "Q", "X": "X", "Z": "Z"}


def titulo(txt):
    print("\n" + "=" * 70)
    print(txt)
    print("=" * 70)


# ══════════════════════════════════════════════════════ 1. CARGAR
titulo("1. CARGAR Y EXPLORAR")

df = pd.read_csv("data/secuencias_raw.csv")

n_seq = df["secuencia_id"].nunique()
n_ses = df["sesion"].nunique()

print(f"Secuencias totales : {n_seq}")
print(f"Frames totales     : {len(df)}")
print(f"Letras             : {df['label'].nunique()}")
print(f"Sesiones           : {n_ses}")

por_letra = df.groupby("label")["secuencia_id"].nunique().sort_index()
print("\nSecuencias por letra:")
for L, n in por_letra.items():
    print(f"  {ETIQUETA.get(L, L)}: {n}")

largos = df.groupby("secuencia_id").size()
print(f"\nFrames por secuencia: min {largos.min()} | mediana {int(largos.median())} "
      f"| max {largos.max()}")

manos = df["handedness"].value_counts()
print(f"\nHandedness: {dict(manos)}")
print("(el recolector de dinamicas NO espeja el frame, asi que esto deberia")
print(" coincidir con lo que ve la app en produccion)")


# ══════════════════════════════════════════════════════ 2. FEATURES
titulo("2. CONSTRUIR LAS REPRESENTACIONES")

IMG = [f"img_{i}_{c}" for i in range(21) for c in "xyz"]
WLD = [f"wld_{i}_{c}" for i in range(21) for c in "xyz"]

# Indices de las yemas: pulgar, indice, medio, anular, menique
YEMAS = [4, 8, 12, 16, 20]


def normalizar_pose(P):
    """(n,21,3) -> centrada en la muneca y escalada por el tamano de la palma."""
    P = P.copy()
    P -= P[:, 0:1, :]
    escala = np.linalg.norm(P[:, 9, :], axis=1, keepdims=True)
    escala[escala == 0] = 1e-8
    return P / escala[:, :, None]


def distancias_forma(P):
    """(n,21,3) -> (n,20): distancias entre yemas y de cada yema a la muneca.

    Captura QUE FORMA tiene la mano, independiente de donde este.
    """
    yem = P[:, YEMAS, :]
    out = []
    for i in range(5):
        for j in range(i + 1, 5):
            out.append(np.linalg.norm(yem[:, i] - yem[:, j], axis=1))
    for i in range(5):
        out.append(np.linalg.norm(yem[:, i] - P[:, 0], axis=1))
    return np.stack(out, axis=1)


def remuestrear(traj, n=N_PUNTOS):
    """Lleva una trayectoria de largo variable a n puntos, interpolando.

    Asi una secuencia de 13 frames y otra de 287 producen vectores del mismo
    tamano, y la velocidad a la que se hizo la sena deja de importar.
    """
    m = len(traj)
    if m == 1:
        return np.repeat(traj, n, axis=0)
    viejo = np.linspace(0, 1, m)
    nuevo = np.linspace(0, 1, n)
    return np.stack([np.interp(nuevo, viejo, traj[:, d])
                     for d in range(traj.shape[1])], axis=1)


def features_de_secuencia(sub):
    """Devuelve (forma, trayectoria) para una secuencia ya ordenada por frame."""
    W = sub[WLD].to_numpy(dtype=np.float32).reshape(-1, 21, 3)
    I = sub[IMG].to_numpy(dtype=np.float32).reshape(-1, 21, 3)

    # --- FORMA: como esta la mano, promediada en el tiempo -------------------
    Wn = normalizar_pose(W)
    d = distancias_forma(Wn)                  # (frames, 20)
    forma = np.concatenate([d.mean(axis=0), d.std(axis=0)])   # 40 valores

    # --- TRAYECTORIA: por donde paso la punta del indice ---------------------
    # Se usan coordenadas de imagen porque describen el trazo en pantalla, que
    # es justamente lo que dibuja la letra.
    tip = I[:, 8, :2]                          # (frames, 2)  x,y del indice
    centro = tip.mean(axis=0)
    rel = tip - centro
    extension = np.abs(rel).max()
    if extension < 1e-6:
        extension = 1e-6
    rel_norm = rel / extension                 # centrada y escalada

    puntos = remuestrear(rel_norm).ravel()     # 8 puntos x 2 = 16 valores

    # Estadisticos del movimiento
    pasos = np.diff(tip, axis=0)
    largo_camino = np.linalg.norm(pasos, axis=1).sum() if len(pasos) else 0.0
    neto = tip[-1] - tip[0]
    caja = tip.max(axis=0) - tip.min(axis=0)
    stats = np.array([
        largo_camino,
        np.linalg.norm(neto),
        neto[0], neto[1],
        caja[0], caja[1],
        # razon entre lo recorrido y lo avanzado: alta en trazos que van y
        # vienen (X) o dan la vuelta (Q), baja en trazos directos
        largo_camino / (np.linalg.norm(neto) + 1e-6),
    ], dtype=np.float32)

    trayectoria = np.concatenate([puntos, stats])   # 16 + 7 = 23 valores
    return forma, trayectoria


formas, trayectorias, etiquetas, sesiones = [], [], [], []

for sid, sub in df.groupby("secuencia_id"):
    sub = sub.sort_values("frame_idx")
    f, t = features_de_secuencia(sub)
    formas.append(f)
    trayectorias.append(t)
    etiquetas.append(sub["label"].iloc[0])
    sesiones.append(sub["sesion"].iloc[0])

F = np.array(formas, dtype=np.float32)
T = np.array(trayectorias, dtype=np.float32)
y = np.array(etiquetas)
grupos = np.array(sesiones)

REPRESENTACIONES = {
    "A · solo forma":          F,
    "B · solo trayectoria":    T,
    "C · forma + trayectoria": np.hstack([F, T]),
}

for nombre, X in REPRESENTACIONES.items():
    print(f"  {nombre:26s} -> {X.shape[1]:3d} features, {X.shape[0]} muestras")

print(f"\nRelacion muestras/features en la mas grande: "
      f"{len(y) / REPRESENTACIONES['C · forma + trayectoria'].shape[1]:.1f}")
print("(por debajo de ~3 hay riesgo de sobreajuste; los modelos regularizados")
print(" como SVM y Random Forest lo toleran mejor)")


# ══════════════════════════════════════════════════════ 3. COMPARAR
titulo("3. COMPARAR REPRESENTACIONES Y MODELOS")

MODELOS = {
    "k-NN": lambda: make_pipeline(
        StandardScaler(), KNeighborsClassifier(n_neighbors=3, weights="distance")),
    "Random Forest": lambda: RandomForestClassifier(
        n_estimators=400, random_state=42, n_jobs=-1),
    "SVM (RBF)": lambda: make_pipeline(
        StandardScaler(),
        SVC(kernel="rbf", C=10, gamma="scale", probability=True, random_state=42)),
    "MLP": lambda: make_pipeline(
        StandardScaler(),
        MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=1500,
                      early_stopping=True, random_state=42)),
}

min_clase = int(por_letra.min())

# CORRECCION: no se puede partir en mas grupos de los que existen. Si hay 3
# sesiones, el maximo es 3 particiones. Antes esto pedia 5 y reventaba con
# "Cannot have number of splits n_splits=5 greater than the number of groups: 3".
if n_ses > 1:
    n_splits = int(min(5, max(2, min_clase), n_ses))
    cv = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=42)
    grupos_cv = grupos
    print(f"StratifiedGroupKFold por sesion ({n_splits} particiones, "
          f"{n_ses} sesiones disponibles).\n")
else:
    n_splits = int(min(5, max(2, min_clase)))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    grupos_cv = None
    print(f"Una sola sesion -> StratifiedKFold ({n_splits} particiones).")
    print("Los numeros saldran algo optimistas.\n")

filas = []
for nombre_rep, X in REPRESENTACIONES.items():
    for nombre_mod, constructor in MODELOS.items():
        scores = cross_val_score(constructor(), X, y, cv=cv,
                                 groups=grupos_cv, n_jobs=-1)
        filas.append({"representacion": nombre_rep, "modelo": nombre_mod,
                      "accuracy": scores.mean(), "desv": scores.std()})
        print(f"  {nombre_rep:26s} | {nombre_mod:14s} | "
              f"{scores.mean():.4f} +/- {scores.std():.4f}")

res = pd.DataFrame(filas).sort_values("accuracy", ascending=False)

tabla = res.pivot(index="modelo", columns="representacion", values="accuracy")
fig, ax = plt.subplots(figsize=(10, 4))
sns.heatmap(tabla, annot=True, fmt=".3f", cmap="YlOrBr", ax=ax,
            cbar_kws={"label": "accuracy"})
ax.set_title("Senas dinamicas — accuracy por modelo y representacion")
plt.tight_layout(); plt.savefig("figuras/10_dinamicas_comparacion.png", dpi=130)
plt.close()

mejor = res.iloc[0]
print(f"\nGANADOR: {mejor['modelo']} sobre \"{mejor['representacion']}\" "
      f"-> {mejor['accuracy']:.4f}")
res.to_csv("figuras/dinamicas_comparacion.csv", index=False)

# Lectura del resultado: si "solo trayectoria" gana o empata, el movimiento es
# lo que define estas letras. Si "solo forma" compite, es que la pose ya las
# separa bastante.
mejor_por_rep = res.groupby("representacion")["accuracy"].max()
print("\nMejor accuracy por representacion:")
for rep, acc in mejor_por_rep.sort_values(ascending=False).items():
    print(f"  {rep:26s} {acc:.4f}")


# ══════════════════════════════════════════════════════ 4. EVALUAR
titulo("4. EVALUAR AL GANADOR")

X_mejor = REPRESENTACIONES[mejor["representacion"]]
clf = MODELOS[mejor["modelo"]]()

if n_ses > 1:
    # Tambien acotado al numero de sesiones disponibles.
    n_eval = int(min(4, n_splits, n_ses))
    n_eval = max(2, n_eval)
    sgkf = StratifiedGroupKFold(n_splits=n_eval, shuffle=True, random_state=7)
    itr, ite = next(sgkf.split(X_mejor, y, groups=grupos))
else:
    itr, ite = train_test_split(np.arange(len(y)), test_size=0.3,
                                random_state=7, stratify=y)

letras_train = set(y[itr])
letras_test = set(y[ite])
faltan_train = sorted(letras_test - letras_train)
faltan_test = sorted(letras_train - letras_test)

if faltan_train:
    print(f"AVISO: {faltan_train} estan en test pero NO en train.\n")
if faltan_test:
    print(f"AVISO: {faltan_test} estan en train pero NO en test.\n")
if not faltan_train and not faltan_test:
    print("Cobertura correcta: todas las letras en train y en test.\n")

clf.fit(X_mejor[itr], y[itr])
pred = clf.predict(X_mejor[ite])

reporte = classification_report(y[ite], pred, digits=3, zero_division=0)
print(reporte)
with open("figuras/dinamicas_reporte.txt", "w", encoding="utf-8") as f:
    f.write(reporte)

letras = sorted(np.unique(y))
nombres = [ETIQUETA.get(L, L) for L in letras]
cm = confusion_matrix(y[ite], pred, labels=letras)

fig, ax = plt.subplots(figsize=(6, 5))
with np.errstate(invalid="ignore", divide="ignore"):
    cm_pct = np.nan_to_num(cm / cm.sum(axis=1, keepdims=True))
sns.heatmap(cm_pct, annot=cm, fmt="d", cmap="YlOrBr",
            xticklabels=nombres, yticklabels=nombres, ax=ax, cbar=False)
ax.set_xlabel("predicho"); ax.set_ylabel("real")
ax.set_title(f"Senas dinamicas — {mejor['modelo']}")
plt.tight_layout(); plt.savefig("figuras/11_dinamicas_confusion.png", dpi=130)
plt.close()

errores = []
for i, real in enumerate(letras):
    for j, pl in enumerate(letras):
        if i != j and cm[i, j] > 0:
            errores.append({"real": ETIQUETA.get(real, real),
                            "predicho": ETIQUETA.get(pl, pl),
                            "veces": int(cm[i, j]),
                            "pct": round(cm[i, j] / max(cm[i].sum(), 1) * 100, 1)})

print("\nTop confusiones:")
if errores:
    err = pd.DataFrame(errores).sort_values("veces", ascending=False)
    print(err.to_string(index=False))
    err.to_csv("figuras/dinamicas_confusiones.csv", index=False)
else:
    print("  Sin errores en el conjunto de prueba.")


# ══════════════════════════════════════════════════════ 5. GUARDAR
titulo("5. GUARDAR EL MODELO")

final = MODELOS[mejor["modelo"]]()
final.fit(X_mejor, y)
joblib.dump(final, "modelo/clasificador_dinamicas.joblib")

meta = {
    "creado": datetime.datetime.now().isoformat(timespec="seconds"),
    "tipo": "senas dinamicas (secuencias)",
    "modelo": mejor["modelo"],
    "representacion": mejor["representacion"],
    "accuracy_cv": round(float(mejor["accuracy"]), 4),
    "particion": ("StratifiedGroupKFold por sesion" if n_ses > 1
                  else "StratifiedKFold (una sola sesion)"),
    "n_particiones": int(n_splits),
    "letras": [str(l) for l in letras],
    "n_secuencias": int(n_seq),
    "n_sesiones": int(n_ses),
    "sujetos": df["sujeto"].unique().tolist(),
    "n_features": int(X_mejor.shape[1]),
    "n_puntos_trayectoria": N_PUNTOS,
    "nota": ("La etiqueta NT corresponde a la letra N-tilde. El pipeline de "
             "features esta en entrenar_dinamicas.py: features_de_secuencia()."),
}
with open("modelo/metadata_dinamicas.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)

print(json.dumps(meta, indent=2, ensure_ascii=False))

print("""
─────────────────────────────────────────────────────────────────────
ARCHIVOS GENERADOS

  modelo/clasificador_dinamicas.joblib   el modelo
  modelo/metadata_dinamicas.json         detalles del entrenamiento
  figuras/10_dinamicas_comparacion.png   heatmap modelo x representacion
  figuras/11_dinamicas_confusion.png     matriz de confusion
  figuras/dinamicas_comparacion.csv      tabla completa
  figuras/dinamicas_confusiones.csv      que letras se confunden
  figuras/dinamicas_reporte.txt          precision/recall por letra

COMO LEER EL RESULTADO

  Con ~30 secuencias por letra el margen es estrecho: un accuracy alto puede
  deberse a que las 5 clases son muy distintas entre si, no a que el modelo
  generalice. La desviacion entre particiones dice cuanto fiarse.

  Si "solo trayectoria" gana, confirma que estas letras se definen por el
  movimiento — que es justo la razon de existir de este modelo aparte.
─────────────────────────────────────────────────────────────────────""")
