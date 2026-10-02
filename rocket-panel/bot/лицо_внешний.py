# -*- coding: utf-8 -*-
"""Распознавание лиц отдельным процессом, когда в этом оно не живёт.

InsightFace тянет onnx, которому нужен protobuf 6 и новее. Приёмке кадра
нужен mediapipe, которому нужен protobuf младше 5. В одном окружении
уживается только одно из двух: второе падает на импорте с
`cannot import name 'runtime_version'`.

Выход простой: распознавание зовётся в своём питоне, путь к нему лежит в
`OKO_FACE_PY` (там стоит insightface), а в основном процессе остаётся
mediapipe. Переменной нет - функции честно отдают пустоту, и вызывающий
код идёт прежним путём, а не падает.

    OKO_FACE_PY=/opt/oko/venv_face/bin/python
"""
import json
import os
import subprocess
import tempfile

ПИТОН = os.environ.get("OKO_FACE_PY") or ""
_жив = None

_СКРИПТ = r'''
import json, sys, cv2, numpy as np
from insightface.app import FaceAnalysis
а = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
а.prepare(ctx_id=-1, det_size=(640, 640))
зад = json.load(open(sys.argv[1]))
из = {}
for имя, путь in зад["кадры"].items():
    к = cv2.imread(путь)
    если = []
    if к is not None:
        for л in (а.get(к) or []):
            x1, y1, x2, y2 = [float(v) for v in л.bbox]
            в = л.normed_embedding
            если.append({"рамка": [x1, y1, x2, y2],
                         "пол": getattr(л, "sex", None),
                         "возраст": getattr(л, "age", None),
                         "вектор": (в / (np.linalg.norm(в) or 1.0)).tolist()})
    если.sort(key=lambda d: -(d["рамка"][2] - d["рамка"][0]))
    из[имя] = если
print(json.dumps(из))
'''


def доступен():
    """Можно ли звать внешний распознаватель. Проверяется один раз."""
    global _жив
    if _жив is None:
        _жив = bool(ПИТОН) and os.path.exists(ПИТОН)
    return _жив


def лица(кадры):
    """{имя: [лица]} для набора {имя: кадр}. Пусто, если звать нечем."""
    if not доступен() or not кадры:
        return {}
    import cv2
    with tempfile.TemporaryDirectory() as пап:
        зад = {"кадры": {}}
        for имя, к in кадры.items():
            п = os.path.join(пап, "%s.png" % имя)
            cv2.imwrite(п, к)
            зад["кадры"][имя] = п
        файл = os.path.join(пап, "зад.json")
        json.dump(зад, open(файл, "w"))
        скрипт = os.path.join(пап, "лица.py")
        open(скрипт, "w").write(_СКРИПТ)
        try:
            о = subprocess.run([ПИТОН, скрипт, файл], capture_output=True,
                               timeout=180)
            строки = о.stdout.decode("utf-8", "ignore").strip().splitlines()
            return json.loads(строки[-1]) if строки else {}
        except Exception as e:                              # noqa: BLE001
            print("ЛИЦО внешнее: не вышло: %s" % str(e)[:140], flush=True)
            return {}


def рамка(кадр):
    """Рамка самого крупного лица или None."""
    из = лица({"к": кадр}).get("к") or []
    return из[0]["рамка"] if из else None
