"""
Clasificador LSM — entrenamiento y comparacion de modelos  (v2)
SenasUTSCMX · Adrian Gottfried · UTSC 2026

CAMBIOS RESPECTO A LA v1
  · Diagnostico de COBERTURA: que letras aparecen en que sesiones. En la v1, al
    apartar sesiones enteras para test, se apartaban letras enteras: la R quedo
    solo en test y el modelo nunca la vio en entrenamiento (recall 0.000).
  · StratifiedGroupKFold en vez de GroupKFold: sigue respetando los grupos (sin
    fuga) pero ademas reparte las clases entre folds.
  · La evaluacion final avisa si alguna letra falta en train o en test.

USO
    conda activate senias-ml
    cd ~/Desktop/senias-v2/ml-training
    python entrenar_lsm.py
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

from sklearn.model_selection import (train_test_split, GroupShuffleSplit,
                                     cross_val_score, StratifiedGroupKFold,
                                     StratifiedKFold)
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


def titulo(txt):
    print("\n" + "=" * 70)
    print(txt)
    print("=" * 70)


# ══════════════════════════════════════════════════════ 1. CARGAR Y EXPLORAR
titulo("1. CARGAR Y EXPLORAR")

df = pd.read_csv("data/landmarks_raw.csv")
n_ses = df["sesion"].nunique()

print(f"Muestras totales : {len(df)}")
print(f"Letras distintas : {df['label'].nunique()}")
print(f"Sujetos          : {df['sujeto'].unique().tolist()}")
print(f"Sesiones         : {n_ses}")
print(f"Valores nulos    : {df.isna().sum().sum()}")

conteo = df["label"].value_counts().sort_index()
print(f"\nMuestras por letra: min {conteo.min()} | max {conteo.max()} "
      f"| desbalance {conteo.max()/conteo.min():.2f}x")

fig, ax = plt.subplots(figsize=(12, 4))
conteo.plot(kind="bar", ax=ax, color="#FF8300")
ax.axhline(conteo.mean(), color="#0C7669", ls="--", label=f"media {conteo.mean():.0f}")
ax.set_title("Muestras por letra"); ax.set_xlabel(""); ax.legend()
plt.tight_layout(); plt.savefig("figuras/01_distribucion.png", dpi=130); plt.close()


# ══════════════════════════════════════════════════════ 1b. COBERTURA
titulo("1b. COBERTURA: QUE LETRAS HAY EN CADA SESION")

print("""Esto decide si se puede evaluar bien. Si una letra vive en pocas sesiones,
al apartar sesiones para test esa letra puede quedar solo de un lado: o el modelo
nunca la aprende, o nunca se le evalua. Ambos casos distorsionan el resultado.
""")

cobertura = pd.crosstab(df["label"], df["sesion"])
ses_por_letra = (cobertura > 0).sum(axis=1).sort_values()

print("Sesiones distintas en que aparece cada letra:")
for letra, n in ses_por_letra.items():
    aviso = "  <-- riesgo" if n < 3 else ""
    print(f"  {letra}: {n}{aviso}")

riesgo = ses_por_letra[ses_por_letra < 3]
print(f"\nLetras en menos de 3 sesiones: {len(riesgo)} de {len(ses_por_letra)}")
if len(riesgo):
    print(f"  -> {', '.join(riesgo.index)}")
    print("""
RECOMENDACION: graba una tanda corta (unas 30 muestras por letra) pasando por
TODAS las letras seguidas, en otro momento. Con eso cada letra existe en varias
sesiones y la evaluacion deja de estar distorsionada. Son ~15 minutos.""")

fig, ax = plt.subplots(figsize=(10, 7))
sns.heatmap((cobertura > 0).astype(int), cmap="YlOrBr", cbar=False,
            linewidths=.5, linecolor="white", ax=ax)
ax.set_title("Cobertura letra x sesion (naranja = grabada)")
ax.set_xlabel("sesion"); ax.set_ylabel("")
plt.tight_layout(); plt.savefig("figuras/01b_cobertura.png", dpi=130); plt.close()


# ══════════════════════════════════════════════════════ 2. FEATURES
titulo("2. CONSTRUIR LAS REPRESENTACIONES")

IMG = [f"img_{i}_{c}" for i in range(21) for c in "xyz"]
WLD = [f"wld_{i}_{c}" for i in range(21) for c in "xyz"]


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
    """Distancias entre las 5 yemas + de cada yema a la muneca (20 valores)."""
    P = a_puntos(X)
    yemas = P[:, [4, 8, 12, 16, 20], :]
    out = []
    for i in range(5):
        for j in range(i + 1, 5):
            out.append(np.linalg.norm(yemas[:, i] - yemas[:, j], axis=1))
    for i in range(5):
        out.append(np.linalg.norm(yemas[:, i] - P[:, 0], axis=1))
    return np.stack(out, axis=1)


X_img = df[IMG].to_numpy(dtype=np.float32)
X_wld = df[WLD].to_numpy(dtype=np.float32)
y = df["label"].to_numpy()
grupos = df["sesion"].to_numpy()

REPRESENTACIONES = {
    "A · img crudo":          X_img,
    "B · img normalizado":    normalizar(X_img),
    "C · world crudo":        X_wld,
    "D · world + distancias": np.hstack([normalizar(X_wld), distancias_yemas(X_wld)]),
}

for nombre, X in REPRESENTACIONES.items():
    print(f"  {nombre:24s} -> {X.shape[1]:3d} features")


# ══════════════════════════════════════════════════════ 3. LA PARTICION
titulo("3. LA PARTICION: POR SESION, NO ALEATORIA")

print("""Las muestras se capturaron a 10 por segundo, asi que dos consecutivas son
casi identicas. Con un split aleatorio, un frame y su gemelo caen uno en train y
otro en test: el modelo "acierta" porque ya vio la respuesta.
""")

X_demo = REPRESENTACIONES["D · world + distancias"]
demo = make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5))

Xtr, Xte, ytr, yte = train_test_split(X_demo, y, test_size=0.25,
                                      random_state=42, stratify=y)
acc_ingenua = demo.fit(Xtr, ytr).score(Xte, yte)
print(f"Particion ALEATORIA (inflada) : {acc_ingenua:.4f}")

if n_ses > 1:
    gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    itr, ite = next(gss.split(X_demo, y, groups=grupos))
    acc_honesta = demo.fit(X_demo[itr], y[itr]).score(X_demo[ite], y[ite])
    print(f"Particion POR SESION (honesta): {acc_honesta:.4f}")
    print(f"\nDiferencia: {(acc_ingenua - acc_honesta)*100:.1f} puntos de accuracy "
          f"fantasma.\nEse hueco es la fuga de informacion.")
else:
    print("\nSolo hay UNA sesion: no se puede partir por sesion. El numero de "
          "arriba esta inflado.")


# ══════════════════════════════════════════════════════ 4. COMPARAR
titulo("4. COMPARAR REPRESENTACIONES Y MODELOS")

MODELOS = {
    "k-NN": lambda: make_pipeline(
        StandardScaler(), KNeighborsClassifier(n_neighbors=5, weights="distance")),
    "Random Forest": lambda: RandomForestClassifier(
        n_estimators=300, random_state=42, n_jobs=-1),
    "SVM (RBF)": lambda: make_pipeline(
        StandardScaler(),
        SVC(kernel="rbf", C=10, gamma="scale", probability=True, random_state=42)),
    "MLP": lambda: make_pipeline(
        StandardScaler(),
        MLPClassifier(hidden_layer_sizes=(256, 128), max_iter=600,
                      early_stopping=True, random_state=42)),
}

if n_ses > 1:
    # StratifiedGroupKFold: respeta las sesiones (sin fuga) y ademas intenta que
    # todas las letras esten en todos los folds. Esto arregla el problema de la
    # v1, donde apartar sesiones enteras dejaba letras fuera del entrenamiento.
    cv = StratifiedGroupKFold(n_splits=min(5, n_ses), shuffle=True, random_state=42)
    grupos_cv = grupos
    print(f"StratifiedGroupKFold agrupado por sesion ({cv.get_n_splits()} particiones).")
    print("Respeta los grupos y reparte las clases entre folds.\n")
else:
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    grupos_cv = None
    print("AVISO: una sola sesion -> CV estratificada. Numeros optimistas.\n")

print("Esto tarda unos minutos...\n")

filas = []
for nombre_rep, X in REPRESENTACIONES.items():
    for nombre_mod, constructor in MODELOS.items():
        scores = cross_val_score(constructor(), X, y, cv=cv,
                                 groups=grupos_cv, n_jobs=-1)
        filas.append({"representacion": nombre_rep, "modelo": nombre_mod,
                      "accuracy": scores.mean(), "desv": scores.std()})
        print(f"  {nombre_rep:24s} | {nombre_mod:14s} | "
              f"{scores.mean():.4f} +/- {scores.std():.4f}")

res = pd.DataFrame(filas).sort_values("accuracy", ascending=False)

tabla = res.pivot(index="modelo", columns="representacion", values="accuracy")
fig, ax = plt.subplots(figsize=(11, 4))
sns.heatmap(tabla, annot=True, fmt=".3f", cmap="YlOrBr", ax=ax,
            cbar_kws={"label": "accuracy"})
ax.set_title("Accuracy por modelo y representacion")
plt.tight_layout(); plt.savefig("figuras/02_comparacion.png", dpi=130); plt.close()

mejor = res.iloc[0]
print(f"\nGANADOR: {mejor['modelo']} sobre \"{mejor['representacion']}\" "
      f"-> {mejor['accuracy']:.4f}")
res.to_csv("figuras/comparacion_modelos.csv", index=False)


# ══════════════════════════════════════════════════════ 5. EVALUAR
titulo("5. EVALUAR AL GANADOR")

X_mejor = REPRESENTACIONES[mejor["representacion"]]
clf = MODELOS[mejor["modelo"]]()

if n_ses > 1:
    sgkf = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=7)
    itr, ite = next(sgkf.split(X_mejor, y, groups=grupos))
else:
    itr, ite = train_test_split(np.arange(len(y)), test_size=0.25,
                                random_state=7, stratify=y)

letras_train = set(y[itr])
letras_test = set(y[ite])
faltan_train = sorted(letras_test - letras_train)
faltan_test = sorted(letras_train - letras_test)

if faltan_train:
    print(f"AVISO: {faltan_train} estan en test pero NO en train.")
    print("       El modelo no puede acertarlas: nunca las vio.\n")
if faltan_test:
    print(f"AVISO: {faltan_test} estan en train pero NO en test.")
    print("       No se pueden evaluar en esta particion.\n")
if not faltan_train and not faltan_test:
    print("Cobertura correcta: todas las letras estan en train y en test.\n")

clf.fit(X_mejor[itr], y[itr])
pred = clf.predict(X_mejor[ite])

reporte = classification_report(y[ite], pred, digits=3, zero_division=0)
print(reporte)
with open("figuras/reporte_clasificacion.txt", "w", encoding="utf-8") as f:
    f.write(reporte)

letras = sorted(np.unique(y))
cm = confusion_matrix(y[ite], pred, labels=letras)

fig, ax = plt.subplots(figsize=(11, 9))
with np.errstate(invalid="ignore", divide="ignore"):
    cm_pct = np.nan_to_num(cm / cm.sum(axis=1, keepdims=True))
sns.heatmap(cm_pct, annot=cm, fmt="d", cmap="YlOrBr",
            xticklabels=letras, yticklabels=letras, ax=ax, cbar=False)
ax.set_xlabel("predicho"); ax.set_ylabel("real")
ax.set_title(f"Matriz de confusion — {mejor['modelo']}")
plt.tight_layout(); plt.savefig("figuras/03_matriz_confusion.png", dpi=130); plt.close()

errores = []
for i, real in enumerate(letras):
    for j, pl in enumerate(letras):
        if i != j and cm[i, j] > 0:
            errores.append({"real": real, "predicho": pl, "veces": int(cm[i, j]),
                            "pct": round(cm[i, j] / max(cm[i].sum(), 1) * 100, 1)})

print("\nTop confusiones:")
if errores:
    err = pd.DataFrame(errores).sort_values("veces", ascending=False)
    print(err.head(15).to_string(index=False))
    err.to_csv("figuras/confusiones.csv", index=False)
    print("\nSi un par aparece arriba, vuelve a grabarlo exagerando la diferencia.")
else:
    print("  Sin errores en el conjunto de prueba.")


# ══════════════════════════════════════════════════════ 6. GUARDAR
titulo("6. GUARDAR EL MODELO")

final = MODELOS[mejor["modelo"]]()
final.fit(X_mejor, y)
joblib.dump(final, "modelo/clasificador_lsm.joblib")

meta = {
    "creado": datetime.datetime.now().isoformat(timespec="seconds"),
    "modelo": mejor["modelo"],
    "representacion": mejor["representacion"],
    "accuracy_cv": round(float(mejor["accuracy"]), 4),
    "particion": ("StratifiedGroupKFold por sesion" if n_ses > 1
                  else "estratificada (INFLADA)"),
    "letras": [str(l) for l in letras],
    "n_muestras": int(len(df)),
    "n_sesiones": int(n_ses),
    "sujetos": df["sujeto"].unique().tolist(),
    "n_features": int(X_mejor.shape[1]),
    "letras_en_menos_de_3_sesiones": list(riesgo.index),
}
with open("modelo/metadata.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)

print(json.dumps(meta, indent=2, ensure_ascii=False))

print("""
─────────────────────────────────────────────────────────────────────
ARCHIVOS GENERADOS

  modelo/clasificador_lsm.joblib     el modelo entrenado
  modelo/metadata.json               que modelo es y como se evaluo
  figuras/01_distribucion.png        muestras por letra
  figuras/01b_cobertura.png          letra x sesion
  figuras/02_comparacion.png         heatmap modelo x representacion
  figuras/03_matriz_confusion.png    matriz de confusion
  figuras/comparacion_modelos.csv    la tabla completa
  figuras/confusiones.csv            que letras se confunden
  figuras/reporte_clasificacion.txt  precision/recall por letra
─────────────────────────────────────────────────────────────────────""")
