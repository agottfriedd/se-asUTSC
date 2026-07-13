"""
SeñasUTSCMX — Clasificador LSM v3
=================================
Reconocimiento de dactilología (alfabeto manual) a partir de los 21
landmarks de MediaPipe Hands.

Por qué v3 detecta mucho mejor que v2
-------------------------------------
v2 medía la extensión de cada dedo como (rectitud * elevación) donde la
elevación se proyectaba sobre un eje FIJO (muñeca->nudillo medio). Eso
hacía que TODO dependiera de cómo estuviera rotada la mano: al inclinarla,
un dedo estirado "perdía" elevación y su score caía, disparando letras
equivocadas o el fallback '?'.

v3 corrige la raíz del problema con 5 cambios:

  1. MARCO CANÓNICO de la mano (ejes x=radial, y=distal, z=normal de la
     palma) construido con productos cruz. Todos los ángulos y posiciones
     se miden DENTRO de ese marco -> invariante a rotación 3D y a mano
     izquierda/derecha.

  2. EXTENSIÓN por RECTITUD = cuerda/longitud del dedo
     (|mcp-tip| / (|mcp-pip|+|pip-dip|+|dip-tip|)). Un dedo recto da ~1.0,
     uno cerrado ~0.5, SIN importar la orientación. Es la señal más fuerte
     y estable que existe para landmarks de mano.

  3. ESTADOS SUAVES por dedo (extendido / curvo / plegado) en [0,1] en vez
     de booleanos con umbral duro: degrada con gracia cerca de los límites.

  4. CLASIFICACIÓN POR PLANTILLAS: cada letra es un prototipo de estados de
     dedo + configuración del pulgar + geometría. Se puntúan TODAS y se
     elige la de mayor score. La confianza sale del margen sobre el 2° lugar.

  5. SUAVIZADO TEMPORAL opcional (LSMSmoother) para vídeo en vivo: estabiliza
     la predicción sobre una ventana de frames y elimina el parpadeo.

API pública (100% compatible con v2)
------------------------------------
  classify(landmarks) -> (letra, confianza)
    landmarks: list[dict] de 21 puntos {'x','y','z'} normalizados de MediaPipe.

Notas sobre el alfabeto LSM
---------------------------
Este módulo reconoce configuraciones ESTÁTICAS de mano. En LSM las letras
J, K, Ñ, Q, RR, X, Z llevan movimiento y NO pueden resolverse con un solo
frame: para ésas necesitas una ventana temporal (ver LSMSmoother.trajectory).
Se incluye la forma estática de X como aproximación.
"""

from typing import Dict, List, Tuple, Optional
from collections import deque, Counter
import numpy as np

# ---------------------------------------------------------------------------
# Utilidades vectoriales
# ---------------------------------------------------------------------------
def _norm(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v) + 1e-9)

def _dist(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))

def _dot(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))

def _smooth(x: float, lo: float, hi: float) -> float:
    """Rampa suave (smoothstep) de 0 en lo a 1 en hi."""
    if hi == lo:
        return 1.0 if x >= hi else 0.0
    t = min(1.0, max(0.0, (x - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)

def _band(x: float, center: float, half: float) -> float:
    """1.0 en el centro, cae a 0 a distancia `half`."""
    return max(0.0, 1.0 - abs(x - center) / (half + 1e-9))

# Índices MediaPipe
_FINGERS = {
    'index':  [5, 6, 7, 8],
    'middle': [9, 10, 11, 12],
    'ring':   [13, 14, 15, 16],
    'pinky':  [17, 18, 19, 20],
}
_THUMB = [1, 2, 3, 4]
_ORDER = ['index', 'middle', 'ring', 'pinky']

# ---------------------------------------------------------------------------
# 1. Marco canónico de la mano
# ---------------------------------------------------------------------------
def _hand_frame(lm: np.ndarray):
    """
    Devuelve (origen, R, escala).
      x = eje radial   (meñique -> índice), en el plano de la palma
      y = eje distal   (muñeca  -> nudillo medio)
      z = normal de la palma (x cruz y)
    R (3x3) transforma un vector del mundo al marco de la mano: R @ v.
    El pulgar queda del lado +x para AMBAS manos (invariante a lateralidad).
    """
    wrist = lm[0]
    idx_mcp, mid_mcp, pky_mcp = lm[5], lm[9], lm[17]
    y = _norm(mid_mcp - wrist)
    radial = idx_mcp - pky_mcp
    x = _norm(radial - _dot(radial, y) * y)   # ortonormaliza contra y
    z = np.cross(x, y)
    R = np.stack([x, y, z])
    scale = 0.5 * _dist(wrist, mid_mcp) + 0.5 * _dist(idx_mcp, pky_mcp) + 1e-6
    return wrist, R, scale

def _straightness(lm: np.ndarray, ids: List[int]) -> float:
    """cuerda / longitud recorrida. ~1.0 recto, ~0.45 totalmente cerrado."""
    p = [lm[i] for i in ids]
    seg = sum(_dist(p[k], p[k + 1]) for k in range(3))
    chord = _dist(p[0], p[3])
    return chord / (seg + 1e-9)

# ---------------------------------------------------------------------------
# 2 y 3. Extracción de rasgos + estados suaves
# ---------------------------------------------------------------------------
def _features(lm: np.ndarray) -> Dict:
    wrist, R, scale = _hand_frame(lm)
    def tf(p):  # a coordenadas canónicas, normalizadas por tamaño de mano
        return R @ (p - wrist) / scale

    ext, fold, curved, updir = {}, {}, {}, {}
    for name, ids in _FINGERS.items():
        s = _straightness(lm, ids)
        mcp, tip = lm[ids[0]], lm[ids[3]]
        fdir = R @ _norm(tip - mcp)          # dirección del dedo en el marco
        up = float(fdir[1])                  # +1 = apunta lejos de la palma
        s01 = min(1.0, max(0.0, (s - 0.60) / 0.32))   # 0 cerrado .. 1 recto
        ext[name]    = s01 * _smooth(up, 0.15, 0.55)  # recto Y apuntando fuera
        fold[name]   = min(1.0, max(0.0, (0.66 - s) / 0.20))
        curved[name] = _band(s, 0.72, 0.16) * _smooth(up, -0.10, 0.45)
        updir[name]  = up

    # Pulgar
    th_s = _straightness(lm, _THUMB)
    th_tip = tf(lm[4])
    th_x, th_y, th_z = float(th_tip[0]), float(th_tip[1]), float(th_tip[2])

    return dict(
        ext=ext, fold=fold, curved=curved, up=updir,
        th_s=th_s, th_x=th_x, th_y=th_y, th_z=th_z,
        # distancias (normalizadas) para pellizcos/contactos
        d_ti=_dist(lm[4], lm[8]) / scale,    # pulgar-índice (punta)
        d_tm=_dist(lm[4], lm[12]) / scale,   # pulgar-medio
        d_im=_dist(lm[8], lm[12]) / scale,   # índice-medio (apertura)
        d_ti_pip=_dist(lm[4], lm[6]) / scale,
        scale=scale,
        # rasgos derivados del pulgar
        th_abd=_smooth(th_x, 0.55, 0.85),        # muy abducido (A, L)
        th_mid=_band(th_x, 0.50, 0.22),          # abducción media (Y, K)
        th_across=_smooth(0.20 - th_x, 0.0, 0.28),  # cruzado sobre la palma (S)
        th_up=_smooth(th_y, 0.80, 1.05),         # apunta hacia arriba (Y)
        th_tuck=_band(th_x, 0.35, 0.20),         # pegado / en reposo (D, I)
    )

# ---------------------------------------------------------------------------
# 4. Plantillas de letras y puntuación
# ---------------------------------------------------------------------------
# Patrón de dedos: 'E'=extendido, 'F'=plegado, 'C'=curvo, 'H'=gancho, '.'=ignora
_TEMPLATES = {
    # letra : (patrón[idx,med,anu,men], función_de_ajuste(pulgar/geometría))
    'B': ('EEEE', lambda f: 1.0 - 0.4 * f['th_across']),
    'A': ('FFFF', lambda f: 0.35 + 0.65 * f['th_abd'] * (1 - f['th_across'])),
    'S': ('FFFF', lambda f: 0.30 + 0.70 * f['th_across']),
    'T': ('FFFF', lambda f: 0.25 + 0.75 * f['th_tuck'] * _smooth(0.55 - f['d_ti'], 0, 0.35)),
    'E': ('FFFF', lambda f: 0.20 + 0.55 * (1 - f['th_abd']) * (1 - f['th_across']) * _smooth(0.9 - f['th_y'], 0, 0.4)),
    'D': ('EFFF', lambda f: 0.30 + 0.70 * f['th_tuck']),
    'L': ('EFFF', lambda f: 0.20 + 0.80 * f['th_abd']),
    'G': ('EFFF', lambda f: 0.15 + 0.75 * f['th_mid'] * (1 - f['th_up'])),
    'X': ('HFFF', lambda f: 0.6 + 0.4 * (1 - f['th_abd'])),
    'I': ('FFFE', lambda f: 0.30 + 0.70 * (1 - f['th_abd']) * (1 - f['th_mid'])),
    'Y': ('FFFE', lambda f: 0.20 + 0.80 * (f['th_abd'] + f['th_mid'] * f['th_up']) / 1.0),
    'P': ('EFFE', lambda f: 0.7),
    'U': ('EEFF', lambda f: (0.3 + 0.7 * _smooth(0.52 - f['d_im'], 0, 0.20)) * (1 - f['th_abd'])),
    'V': ('EEFF', lambda f: (0.3 + 0.7 * _smooth(f['d_im'] - 0.60, 0, 0.20)) * (1 - f['th_abd'])),
    'H': ('EEFF', lambda f: (0.3 + 0.7 * _band(f['d_im'], 0.55, 0.12)) * (1 - f['th_abd'])),
    'K': ('EEFF', lambda f: 0.15 + 0.85 * f['th_up'] * (f['th_abd'] + f['th_mid'])),
    'W': ('EEEF', lambda f: 1.0),
    'F': ('FEEE', lambda f: 0.20 + 0.80 * _smooth(0.40 - f['d_ti'], 0, 0.30)),
    'C': ('CCCC', lambda f: 0.35 + 0.65 * _smooth(f['d_ti'] - 0.45, 0, 0.35)),
    'O': ('CCCC', lambda f: 0.30 + 0.70 * _smooth(0.45 - f['d_ti'], 0, 0.30)),
}

_MEMBER = {'E': 'ext', 'F': 'fold', 'C': 'curved'}

def _pattern_score(pat: str, f: Dict) -> float:
    total, n = 0.0, 0
    for ch, name in zip(pat, _ORDER):
        if ch == '.':
            continue
        if ch == 'H':  # gancho: rectitud media en el índice (dedo semiplegado)
            s = 1.0 - abs(f['ext'][name] - 0.45) / 0.45
            total += max(0.0, s)
        else:
            total += f[_MEMBER[ch]][name]
        n += 1
    return total / max(1, n)

def _classify(f: Dict) -> Tuple[str, float, float]:
    scores = {}
    for letter, (pat, adjust) in _TEMPLATES.items():
        base = _pattern_score(pat, f)
        scores[letter] = base * float(adjust(f))
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    (l1, s1), (l2, s2) = ranked[0], ranked[1]
    if s1 < 0.42:
        return '?', s1, s2
    return l1, s1, s2

# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------
def classify(landmarks: List[dict]) -> Tuple[str, float]:
    """
    landmarks: lista de 21 dicts {'x','y','z'} (salida de MediaPipe Hands).
    Retorna (letra_LSM, confianza in [0,1]).
    """
    if landmarks is None or len(landmarks) < 21:
        return '?', 0.0
    try:
        lm = np.array([[p['x'], p['y'], p['z']] for p in landmarks[:21]], dtype=np.float32)
    except (KeyError, TypeError, ValueError):
        return '?', 0.0

    f = _features(lm)
    letter, s1, s2 = _classify(f)
    if letter == '?':
        return '?', round(float(s1), 3)

    margin = _smooth(s1 - s2, 0.0, 0.15)          # separación sobre el 2° lugar
    quality = min(1.0, f['scale'] / 0.12)          # penaliza manos diminutas/ruido
    conf = min(1.0, s1) * (0.55 + 0.45 * margin) * (0.4 + 0.6 * quality)
    return letter, round(float(conf), 3)

def classify_topk(landmarks: List[dict], k: int = 3) -> List[Tuple[str, float]]:
    """Diagnóstico: las k letras más probables con su score crudo."""
    if landmarks is None or len(landmarks) < 21:
        return [('?', 0.0)]
    lm = np.array([[p['x'], p['y'], p['z']] for p in landmarks[:21]], dtype=np.float32)
    f = _features(lm)
    scores = {}
    for letter, (pat, adjust) in _TEMPLATES.items():
        scores[letter] = _pattern_score(pat, f) * float(adjust(f))
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:k]

# ---------------------------------------------------------------------------
# 5. Suavizado temporal para vídeo en vivo
# ---------------------------------------------------------------------------
class LSMSmoother:
    """
    Estabiliza la clasificación sobre una ventana de frames.

    Uso:
        sm = LSMSmoother(window=8, min_conf=0.5, min_frames=5)
        for frame in stream:
            letter, conf = sm.update(landmarks)   # None si aún no hay consenso
    """
    def __init__(self, window: int = 8, min_conf: float = 0.5, min_frames: int = 5):
        self.window = window
        self.min_conf = min_conf
        self.min_frames = min_frames
        self.buf = deque(maxlen=window)
        self.locked: Optional[str] = None

    def update(self, landmarks: List[dict]) -> Tuple[Optional[str], float]:
        letter, conf = classify(landmarks)
        self.buf.append((letter, conf))
        # vota solo entre frames con confianza suficiente
        votes = [l for l, c in self.buf if c >= self.min_conf and l != '?']
        if len(votes) < self.min_frames:
            return None, 0.0
        winner, count = Counter(votes).most_common(1)[0]
        if count < self.min_frames:
            return None, 0.0
        avg = np.mean([c for l, c in self.buf if l == winner])
        self.locked = winner
        return winner, round(float(avg), 3)

    def reset(self):
        self.buf.clear()
        self.locked = None
