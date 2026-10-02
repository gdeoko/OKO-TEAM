# -*- coding: utf-8 -*-
"""Выбор лучшего кадра по узнаваемости лица клиентки.

Перенос личности у Klein это лотерея по зерну: на одной кнопке разные
зёрна дают от «спорно» до «уверенно она». Поэтому кадр не берётся
первый попавшийся, а выбирается замером.

ПОЧЕМУ ЗАМЕР ИДЁТ ОТДЕЛЬНЫМ ПРОЦЕССОМ. Распознаватель (insightface) тянет
onnx, которому нужен protobuf 6 и новее, а приёмке кадра нужен mediapipe,
которому нужен protobuf младше 5. В одном процессе уживаются только за
счёт поломки одного из двух: проверено, падает импорт. Поэтому замер
зовётся в отдельном питоне, путь к которому лежит в `OKO_FACE_PY`.

Нет ни того, ни другого - модуль честно отдаёт первый вариант: это не
хуже случайного выбора, а падать из-за отсутствия модели кадр не должен.
"""
import json
import os
import subprocess
import sys
import tempfile

ПИТОН = os.environ.get("OKO_FACE_PY") or ""
_свой = None
_нет_своего = False


def _свой_модуль():
    """Распознаватель прямо здесь, если он в этом же процессе работает."""
    global _свой, _нет_своего
    if _нет_своего:
        return None
    if _свой is None:
        try:
            from insightface.app import FaceAnalysis
            а = FaceAnalysis(name="buffalo_l",
                             providers=["CPUExecutionProvider"])
            а.prepare(ctx_id=-1, det_size=(640, 640))
            _свой = а
        except Exception:                                   # noqa: BLE001
            _нет_своего = True
            return None
    return _свой


_СКРИПТ = r'''
import json, sys, cv2, numpy as np
from insightface.app import FaceAnalysis
а = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
а.prepare(ctx_id=-1, det_size=(640, 640))
def вектор(п):
    к = cv2.imread(п)
    if к is None: return None
    л = а.get(к)
    if not л: return None
    в = max(л, key=lambda f: f.bbox[2] - f.bbox[0]).normed_embedding
    return (в / (np.linalg.norm(в) or 1.0)).tolist()
зад = json.load(open(sys.argv[1]))
эт = [v for v in (вектор(п) for п in зад["эталоны"]) if v]
баллы = []
for п in зад["кадры"]:
    в = вектор(п)
    баллы.append(max(float(np.dot(np.array(э), np.array(в))) for э in эт)
                 if (в and эт) else None)
print(json.dumps(баллы))
'''


def _вектор(апп, кадр):
    import numpy as np
    лица = апп.get(кадр)
    if not лица:
        return None
    в = max(лица, key=lambda f: f.bbox[2] - f.bbox[0]).normed_embedding
    return в / (float(np.linalg.norm(в)) or 1.0)


def _баллы_свои(апп, варианты, эталоны):
    import numpy as np
    вэ = [v for v in (_вектор(апп, к) for к in эталоны) if v is not None]
    if not вэ:
        return None
    из = []
    for к in варианты:
        в = _вектор(апп, к)
        из.append(max(float(np.dot(э, в)) for э in вэ)
                  if в is not None else None)
    return из


def _баллы_процессом(варианты, эталоны):
    if not ПИТОН or not os.path.exists(ПИТОН):
        return None
    import cv2
    with tempfile.TemporaryDirectory() as пап:
        зад = {"кадры": [], "эталоны": []}
        for и, к in enumerate(варианты):
            п = os.path.join(пап, "в%d.png" % и)
            cv2.imwrite(п, к)
            зад["кадры"].append(п)
        for и, к in enumerate(эталоны):
            п = os.path.join(пап, "э%d.png" % и)
            cv2.imwrite(п, к)
            зад["эталоны"].append(п)
        файл = os.path.join(пап, "зад.json")
        json.dump(зад, open(файл, "w"))
        скрипт = os.path.join(пап, "мера.py")
        open(скрипт, "w").write(_СКРИПТ)
        try:
            о = subprocess.run([ПИТОН, скрипт, файл], capture_output=True,
                               timeout=180)
            строки = о.stdout.decode("utf-8", "ignore").strip().splitlines()
            return json.loads(строки[-1]) if строки else None
        except Exception as e:                              # noqa: BLE001
            print("ЛИЦО: замер не вышел: %s" % str(e)[:140], flush=True)
            return None


def лучший(варианты, рефы_кадры=None):
    """Кадр, где лицо клиентки узнаётся увереннее всего."""
    if not варианты:
        return None
    if len(варианты) == 1 or not рефы_кадры:
        return варианты[0]
    апп = _свой_модуль()
    баллы = (_баллы_свои(апп, варианты, рефы_кадры) if апп is not None
             else _баллы_процессом(варианты, рефы_кадры))
    if not баллы or all(б is None for б in баллы):
        return варианты[0]
    лучш, балл = варианты[0], -2.0
    for к, б in zip(варианты, баллы):
        if б is not None and б > балл:
            лучш, балл = к, б
    print("ЛИЦО: выбран вариант с узнаваемостью %.3f из %d"
          % (балл, len(варианты)), flush=True)
    return лучш
