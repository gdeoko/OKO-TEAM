# -*- coding: utf-8 -*-
"""Второй проход по рукам: чинить адресно, а не ждать удачного зерна.

Замер показал, что доля шагов с гайдом на руки почти не влияет (чистых
5-6 из 10 при любой настройке), то есть ломает их сама модель, а не
карта глубины. Лотерея по зёрнам такие кадры чинит медленно: на
`un_close` и `ph_side` чистыми выходили три кадра из двенадцати.

Руки чинятся тем же приёмом, что лицо: область перерисовывается по
маске, остальной кадр не трогается вовсе. Маска строится по скелету -
от локтя до кисти с запасом, - поэтому правка идёт ровно туда, где
рука, и не задевает ни тело, ни комнату.
"""
import os
import uuid

ЗДЕСЬ = os.path.dirname(os.path.abspath(__file__))

import cv2
import numpy as np
import runware

FILL = "runware:102@1"
ЛОКТИ = ((7, 9), (8, 10))                 # локоть -> запястье
ПЛЕЧИ = ((5, 7), (6, 8))
ТЕКСТ = ("A natural human arm and hand in correct anatomy: one forearm, "
         "one wrist, one hand with exactly five fingers, skin matching the "
         "body, soft natural light. The hand is whole and joined to the arm.")
НЕГ = ("extra fingers, six fingers, fused fingers, missing fingers, "
       "deformed hand, claw, stump, floating hand, second arm, blurry")


def маска_рук(кадр, скелеты, запас=0.55):
    """Полосы вдоль предплечий с запасом: туда и пойдёт правка."""
    в, ш = кадр.shape[:2]
    м = np.zeros((в, ш), np.uint8)
    есть = False
    for точки in скелеты:
        for a, b in ЛОКТИ + ПЛЕЧИ:
            A, B = точки[a], точки[b]
            if A[2] < 0.35 or B[2] < 0.35:
                continue
            длина = float(np.hypot(B[0] - A[0], B[1] - A[1]))
            if длина < 12:
                continue
            толщина = max(18, int(длина * запас))
            cv2.line(м, (int(A[0]), int(A[1])), (int(B[0]), int(B[1])),
                     255, толщина, cv2.LINE_AA)
            # Кисть дальше запястья: дорисовываем круг на конце.
            cv2.circle(м, (int(B[0]), int(B[1])), int(длина * 0.5), 255, -1)
            есть = True
    if not есть:
        return None
    return cv2.GaussianBlur(м, (31, 31), 0)


def починить(кадр, скелеты, рв, сила=0.85, шаги=26, зерно=101):
    м = маска_рук(кадр, скелеты)
    if м is None:
        return кадр, "рук на скелете не видно"
    в, ш = кадр.shape[:2]
    т = {"taskType": "imageInference", "taskUUID": str(uuid.uuid4()),
         "model": FILL, "positivePrompt": ТЕКСТ, "negativePrompt": НЕГ,
         "width": ш, "height": в, "steps": шаги, "CFGScale": 3.5,
         "numberResults": 1, "seed": int(зерно), "strength": сила,
         "outputType": "URL", "outputFormat": "PNG",
         "seedImage": runware._дата_ури(cv2.imencode(".png", кадр)[1].tobytes()),
         "maskImage": runware._дата_ури(cv2.imencode(".png", м)[1].tobytes())}
    о = рв._зов([т])
    б = рв._скачать(о[0]["imageURL"])
    нов = cv2.imdecode(np.frombuffer(б, np.uint8), cv2.IMREAD_COLOR)
    if нов.shape[:2] != (в, ш):
        нов = cv2.resize(нов, (ш, в))
    # Вне маски кадр остаётся прежним байт в байт: правим руки, а не
    # переснимаем кнопку.
    а = (м.astype(np.float32) / 255.0)[..., None]
    return (нов * а + кадр * (1 - а)).astype(np.uint8), None
