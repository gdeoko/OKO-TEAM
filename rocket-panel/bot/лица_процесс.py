# -*- coding: utf-8 -*-
"""Поиск лиц отдельным процессом: рамка, пол, вектор узнаваемости.

Отдельный процесс нужен не из осторожности, а из несовместимости:
insightface тянет onnx с protobuf шестым, приёмке кадра нужен mediapipe
с protobuf младше пятого. В одном окружении живёт только один, второй
падает на импорте.
"""
import json
import sys

import cv2
import numpy as np
from insightface.app import FaceAnalysis

_пр = None


def _приложение():
    global _пр
    if _пр is None:
        _пр = FaceAnalysis(name="buffalo_l",
                           providers=["CPUExecutionProvider"])
        # Крупнее сетка и ниже порог: на парных кнопках лицо занимает
        # меньше процента кадра или повёрнуто в профиль, и при 640 с
        # порогом по умолчанию его не находило вовсе - лицо клиентки
        # не вставало, а кадр уходил ей чужим.
        _пр.prepare(ctx_id=-1, det_size=(1024, 1024), det_thresh=0.35)
    return _пр


def разобрать(путь):
    к = cv2.imread(путь)
    if к is None:
        return []
    из = []
    for л in _приложение().get(к):
        из.append({"bbox": [float(з) for з in л.bbox],
                   "пол": str(getattr(л, "sex", "") or ""),
                   "возраст": int(getattr(л, "age", 0) or 0)})
    return sorted(из, key=lambda з: -(з["bbox"][2] - з["bbox"][0]))


if __name__ == "__main__":
    print(json.dumps(разобрать(sys.argv[1]), ensure_ascii=False))
