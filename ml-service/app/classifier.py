"""
SeñasUTSCMX — Clasificador LSM v2
====================================
Algebra vectorial sobre los 21 landmarks de MediaPipe.
Elimina falsos positivos por rotacion de mano.

Indices MediaPipe:
  WRIST=0  THUMB:1-4  INDEX:5-8  MIDDLE:9-12  RING:13-16  PINKY:17-20
"""
from typing import Dict, List, Tuple
import numpy as np

def _norm(v): return v / (np.linalg.norm(v) + 1e-8)
def _dist(a, b): return float(np.linalg.norm(a - b))
def _dot(a, b): return float(np.dot(a, b))

def _extract(lm: np.ndarray) -> Dict:
    wrist=lm[0]; index_mcp=lm[5]; middle_mcp=lm[9]; ring_mcp=lm[13]; pinky_mcp=lm[17]
    palm_up   = _norm(middle_mcp - wrist)
    palm_lat  = _norm(index_mcp  - pinky_mcp)
    palm_size = _dist(wrist, middle_mcp) + 1e-6

    joints = {
        'thumb': [1,2,3,4], 'index':[5,6,7,8],
        'middle':[9,10,11,12], 'ring':[13,14,15,16], 'pinky':[17,18,19,20],
    }
    ext = {}
    for name,(mcp_i,pip_i,_,tip_i) in joints.items():
        mcp=lm[mcp_i]; pip=lm[pip_i]; tip=lm[tip_i]
        cos_pip = float(np.clip(_dot(_norm(pip-mcp), _norm(tip-pip)), -1, 1))
        elevation = _dot(tip - mcp, palm_up) / palm_size
        ext[name] = float(np.clip(((cos_pip+1)/2) * max(0.0, elevation), 0, 1))

    thumb_tip    = lm[4]
    palm_center  = (index_mcp+middle_mcp+ring_mcp+pinky_mcp)/4
    v_i1=_norm(lm[6]-lm[5]); v_i2=_norm(lm[7]-lm[6])

    return dict(
        ext=ext,
        thumb_side    = _dot(thumb_tip-wrist, palm_lat) / palm_size,
        thumb_up      = _dot(thumb_tip-wrist, palm_up)  / palm_size,
        thumb_forward = _dot(thumb_tip-palm_center, palm_up) / palm_size,
        d_thumb_index  = _dist(lm[4], lm[8])  / palm_size,
        d_thumb_middle = _dist(lm[4], lm[12]) / palm_size,
        d_index_middle = _dist(lm[8], lm[12]) / palm_size,
        span_tips      = _dist(lm[8], lm[20]) / palm_size,
        index_pip_cos  = float(np.clip(_dot(v_i1, v_i2), -1, 1)),
        palm_size=palm_size,
    )

def _flags(f: Dict) -> Dict:
    e = f['ext']
    EXT=0.55; FOLD=0.30
    return dict(
        idx=e['index']>EXT,  mid=e['middle']>EXT,
        rng=e['ring']>EXT,   pky=e['pinky']>EXT,
        idx_f=e['index']<FOLD, mid_f=e['middle']<FOLD,
        rng_f=e['ring']<FOLD,  pky_f=e['pinky']<FOLD,
        idx_b=FOLD<e['index']<EXT, mid_b=FOLD<e['middle']<EXT, rng_b=FOLD<e['ring']<EXT,
        thumb_abducted = f['thumb_side']    >  0.35,
        thumb_up       = f['thumb_up']      >  0.45,
        thumb_over     = f['thumb_forward'] < -0.15,
        thumb_touch_idx= f['d_thumb_index'] <  0.35,
        thumb_touch_mid= f['d_thumb_middle']<  0.35,
        idx_mid_close  = f['d_index_middle']<  0.18,
        idx_mid_spread = f['d_index_middle']>  0.28,
        index_hooked   = f['index_pip_cos'] <  0.30,
    )

def _classify(f: Dict, g: Dict) -> Tuple[str, float]:
    idx=g['idx']; mid=g['mid']; rng=g['rng']; pky=g['pky']
    idx_f=g['idx_f']; mid_f=g['mid_f']; rng_f=g['rng_f']; pky_f=g['pky_f']

    # Puños (ningun dedo extendido)
    if idx_f and mid_f and rng_f and pky_f:
        if g['thumb_over']:                                return 'S', 0.90
        if f['d_thumb_index'] < 0.20:                     return 'T', 0.85
        if g['thumb_abducted'] and g['thumb_up']:         return 'A', 0.87
        return 'A', 0.80

    # Solo indice
    if idx and mid_f and rng_f and pky_f:
        if g['thumb_abducted'] and g['thumb_up']:         return 'L', 0.93
        if g['thumb_abducted']:                           return 'G', 0.86
        if g['index_hooked']:                             return 'X', 0.82
        return 'D', 0.88

    # Solo menique
    if idx_f and mid_f and rng_f and pky:
        if g['thumb_abducted'] and g['thumb_up']:         return 'Y', 0.93
        return 'I', 0.91

    # Indice + menique
    if idx and mid_f and rng_f and pky:                   return 'P', 0.86

    # Indice + medio
    if idx and mid and rng_f and pky_f:
        if g['thumb_abducted']:                           return 'K', 0.87
        if g['idx_mid_close']:                            return 'U', 0.89
        if g['idx_mid_spread']:                           return 'V', 0.89
        return 'H', 0.81

    # Indice + medio + anular
    if idx and mid and rng and pky_f:                     return 'W', 0.88

    # Todos extendidos
    if idx and mid and rng and pky:                       return 'B', 0.91

    # Curvas
    all_bent = all(0.20 < f['ext'][d] < 0.62 for d in ['index','middle','ring','pinky'])
    all_low  = all(f['ext'][d] < 0.62 for d in ['index','middle','ring','pinky'])

    if all_bent and f['d_thumb_index'] < 0.28:           return 'O', 0.85
    if all_bent:                                          return 'C', 0.81
    if all_low and g['thumb_touch_idx'] and not g['thumb_over']:  return 'F', 0.79
    if all_low and all(f['ext'][d] < 0.45 for d in ['index','middle','ring','pinky']):
        if g['thumb_over']:                               return 'S', 0.75
        return 'E', 0.77

    # Indice enganchado
    if g['index_hooked'] and mid_f and rng_f and pky_f:  return 'X', 0.83

    # Fallback por cantidad de dedos extendidos
    n = sum([idx, mid, rng, pky])
    if n == 0: return ('S' if g['thumb_over'] else 'A'), 0.55
    if n == 1: return 'D', 0.52
    if n == 2: return 'U', 0.48
    if n == 3: return 'W', 0.48
    if n == 4: return 'B', 0.55
    return '?', 0.25

def classify(landmarks: List[dict]) -> Tuple[str, float]:
    """
    Entrada publica.
    landmarks: lista de 21 dicts {'x','y','z'} normalizados.
    Retorna (letra_LSM, confianza).
    """
    if len(landmarks) < 21:
        return '?', 0.0
    lm = np.array([[p['x'],p['y'],p['z']] for p in landmarks], dtype=np.float32)
    f  = _extract(lm)
    g  = _flags(f)
    letter, conf = _classify(f, g)
    size_ok = min(1.0, f['palm_size'] / 0.12)
    return letter, round(conf * size_ok, 3)
